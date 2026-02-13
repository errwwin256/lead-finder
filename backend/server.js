const { scrapeWebsite } = require("./services/scraperService");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("ENV CHECK:", {
  SHEET_ID: process.env.SHEET_ID,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "SET" : "MISSING",
  GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
});

const express = require("express");
const cors = require("cors");

const {
  appendRowsToResults,
  readInputRows,
  updateInputRow,
  readExistingPlaceIds,
  appendInputRows,
} = require("./services/sheetsService");

const {
  searchPlacesText,
  getPlaceDetails,
} = require("./services/placesService");

const app = express();
app.use(cors());
app.use(express.json());

function extractSubArea(address, city) {
  if (!address) return "";
  const first = address.split(",")[0].trim();
  if (!first) return "";
  const lowerFirst = first.toLowerCase();
  const lowerCity = (city || "").toLowerCase();
  if (lowerFirst === lowerCity) return "";
  if (lowerFirst.includes(lowerCity)) return "";
  return first;
}

function makeInputKey(profession, city, country) {
  return `${(profession || "").trim().toLowerCase()}|${(city || "")
    .trim()
    .toLowerCase()}|${(country || "").trim().toLowerCase()}`;
}

function ensureEnv(res) {
  if (!process.env.GOOGLE_API_KEY)
    return res.status(500).json({ error: "Missing GOOGLE_API_KEY in .env" });

  if (!process.env.SHEET_ID)
    return res.status(500).json({ error: "Missing SHEET_ID in .env" });

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_PATH)
    return res
      .status(500)
      .json({ error: "Missing GOOGLE_SERVICE_ACCOUNT_PATH in .env" });

  return null;
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/search", async (req, res) => {
  try {
    const envErr = ensureEnv(res);
    if (envErr) return;

    const { profession, city, country } = req.body;

    if (!profession || !city) {
      return res
        .status(400)
        .json({ error: "profession and city are required" });
    }

    const query = country
      ? `${profession} in ${city}, ${country}`
      : `${profession} in ${city}`;

    const basicResults = await searchPlacesText({
      query,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const limited = basicResults.slice(0, 60);

    const enriched = await Promise.all(
      limited.map(async (r) => {
        let details = {};
        try {
          details = await getPlaceDetails({
            placeId: r.place_id,
            apiKey: process.env.GOOGLE_API_KEY,
          });
        } catch (e) {
          console.log("Details error for:", r.place_id, e.message);
        }

        const { email, facebook } = await scrapeWebsite(details.website || "");

        return {
          name: r.name || details.name || "",
          address: r.formatted_address || details.formatted_address || "",
          phone:
            details.formatted_phone_number ||
            details.international_phone_number ||
            "",
          website: details.website || "",
          maps_url: details.url || "",
          place_id: r.place_id || "",
          rating: r.rating ?? "",
          email,
          facebook,
        };
      }),
    );

    // Deduplicate (based on existing place_id in RESULTS)
    const existing = await readExistingPlaceIds();
    const uniqueEnriched = enriched.filter(
      (r) => r.place_id && !existing.has(r.place_id),
    );

    const now = new Date().toISOString();
    const rows = uniqueEnriched.map((r) => [
      profession,
      city,
      country || "",
      r.name,
      r.phone || "",
      r.email || "",
      r.website || "",
      r.facebook || "",
      r.address || "",
      r.maps_url || "",
      r.rating || "",
      "google_places",
      now,
      r.place_id || "", // ✅ for dedupe
    ]);

    if (rows.length > 0) {
      await appendRowsToResults(rows);
    }

    res.json({
      query,
      count: uniqueEnriched.length,
      results: uniqueEnriched,
      skipped_duplicates: enriched.length - uniqueEnriched.length,
    });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/run-batch", async (req, res) => {
  try {
    const envErr = ensureEnv(res);
    if (envErr) return;

    const limit = Number(req.body?.limit ?? 5);

    const inputRows = await readInputRows();

    const queued = inputRows.filter(
      (r) =>
        r.profession && r.city && (r.status === "QUEUED" || r.status === ""),
    );

    const toRun = queued.slice(0, Math.max(1, limit));

    if (toRun.length === 0) {
      return res.json({ ok: true, message: "No queued rows", processed: 0 });
    }

    let processed = 0;

    for (const job of toRun) {
      const { rowNumber, profession, city, country } = job;

      await updateInputRow({
        rowNumber,
        status: "RUNNING",
        note: "Starting...",
      });

      try {
        const query = country
          ? `${profession} in ${city}, ${country}`
          : `${profession} in ${city}`;

        const basicResults = await searchPlacesText({
          query,
          apiKey: process.env.GOOGLE_API_KEY,
        });

        const limited = basicResults.slice(0, 60);

        const enriched = await Promise.all(
          limited.map(async (r) => {
            let details = {};
            try {
              details = await getPlaceDetails({
                placeId: r.place_id,
                apiKey: process.env.GOOGLE_API_KEY,
              });
            } catch (e) {}

            const { email, facebook } = await scrapeWebsite(
              details.website || "",
            );

            return {
              name: r.name || details.name || "",
              address: r.formatted_address || details.formatted_address || "",
              phone:
                details.formatted_phone_number ||
                details.international_phone_number ||
                "",
              website: details.website || "",
              maps_url: details.url || "",
              place_id: r.place_id || "",
              rating: r.rating ?? "",
              email,
              facebook,
            };
          }),
        );

        // ✅ DEDUPE
        const existing = await readExistingPlaceIds();
        const uniqueEnriched = enriched.filter(
          (r) => r.place_id && !existing.has(r.place_id),
        );

        // ✅ AUTO-EXPAND (from enriched addresses)
        const currentInputs = await readInputRows();
        const inputKeySet = new Set(
          currentInputs.map((r) =>
            makeInputKey(r.profession, r.city, r.country),
          ),
        );

        const areas = new Set();
        for (const r of enriched) {
          const area = extractSubArea(r.address, city);
          if (area) areas.add(area);
        }

        const maxNew = 10;
        const newRows = [];

        for (const area of Array.from(areas).slice(0, maxNew)) {
          const derivedCityQuery = `${area}, ${city}`;
          const key = makeInputKey(profession, derivedCityQuery, country || "");
          if (inputKeySet.has(key)) continue;

          newRows.push([
            profession,
            derivedCityQuery,
            country || "",
            "QUEUED",
            "",
            "Auto-added from results",
          ]);

          inputKeySet.add(key);
        }

        if (newRows.length > 0) {
          await appendInputRows(newRows);
        }

        // ✅ Write only new/deduped rows
        const now = new Date().toISOString();
        const rows = uniqueEnriched.map((r) => [
          profession,
          city,
          country || "",
          r.name,
          r.phone || "",
          r.email || "",
          r.website || "",
          r.facebook || "",
          r.address || "",
          r.maps_url || "",
          r.rating || "",
          "google_places",
          now,
          r.place_id || "",
        ]);

        if (rows.length > 0) {
          await appendRowsToResults(rows);
        }

        await updateInputRow({
          rowNumber,
          status: "DONE",
          note: `Saved ${rows.length} new (deduped), added ${newRows.length} jobs`,
        });

        processed++;
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e) {
        await updateInputRow({
          rowNumber,
          status: "FAILED",
          note: e.message || "Failed",
        });
      }
    }

    res.json({ ok: true, processed, totalQueued: queued.length });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: "Batch run failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`),
);
