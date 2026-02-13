const axios = require("axios");
const cheerio = require("cheerio");

function extractEmail(html) {
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const match = html.match(emailRegex);
  return match ? match[0] : "";
}

function extractFacebook(html) {
  const fbRegex = /https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9._-]+/i;
  const match = html.match(fbRegex);
  return match ? match[0] : "";
}

async function scrapeWebsite(url) {
  if (!url) return { email: "", facebook: "" };

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = response.data;

    const email = extractEmail(html);
    const facebook = extractFacebook(html);

    return { email, facebook };
  } catch (err) {
    return { email: "", facebook: "" };
  }
}

module.exports = { scrapeWebsite };
