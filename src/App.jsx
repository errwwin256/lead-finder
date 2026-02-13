import { useMemo, useState } from "react";
import "./styles.css";
import spiderLogo from "./assets/spider.png";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:5000";

// ✅ VERY SIMPLE FRONTEND-ONLY LOGIN (change these)
const AUTH = {
  email: "admin@leadfinder.com",
  password: "abcd1234",
};

export default function App() {
  // --- auth ---
  const [isAuthed, setIsAuthed] = useState(
    localStorage.getItem("leadfinder_authed") === "1",
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");

  // --- app state ---
  const [profession, setProfession] = useState("electrician");
  const [city, setCity] = useState("Davao City");
  const [country, setCountry] = useState("Philippines");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const canSearch = useMemo(() => {
    return profession.trim().length > 1 && city.trim().length > 1 && !loading;
  }, [profession, city, loading]);

  const handleLogin = () => {
    setLoginErr("");

    const e = loginEmail.trim().toLowerCase();
    const p = loginPass;

    if (!e || !p) {
      setLoginErr("Please enter email and password.");
      return;
    }

    if (e === AUTH.email.toLowerCase() && p === AUTH.password) {
      localStorage.setItem("leadfinder_authed", "1");
      setIsAuthed(true);
      setLoginEmail("");
      setLoginPass("");
      setLoginErr("");
      return;
    }

    setLoginErr("Invalid email or password.");
  };

  const handleLogout = () => {
    localStorage.removeItem("leadfinder_authed");
    setIsAuthed(false);
    // optional: reset app UI when logging out
    setData(null);
    setErr("");
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profession: profession.trim(),
          city: city.trim(),
          country: country.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setData(json);
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setProfession("");
    setCity("");
    setCountry("");
    setErr("");
    setData(null);
  };

  const onKeyDownSearch = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const onKeyDownLogin = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  // ✅ LOGIN SCREEN
  if (!isAuthed) {
    return (
      <div className="loginPage">
        <div className="loginCard" onKeyDown={onKeyDownLogin}>
          <img src={spiderLogo} alt="Spider Logo" className="loginLogo" />
          <h1 className="loginTitle">
            Lead Finder <span className="badgeMvp">MVP</span>
          </h1>
          <p className="loginSub">
            Find businesses fast and save to Google Sheets via backend.
          </p>

          <label className="field">
            <span>Email</span>
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@leadfinder.com"
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </label>

          <button className="btn" onClick={handleLogin}>
            Login
          </button>

          {loginErr && (
            <div className="alert" role="alert">
              <b>Error:</b> {loginErr}
            </div>
          )}

          <div className="loginHint muted">
            Login To: <b>Unleash the power of spiders</b> /{" "}
            <b>Created by Erwin</b>
          </div>
        </div>
      </div>
    );
  }

  // ✅ MAIN APP
  return (
    <div className="page">
      <header className="topbar">
        <div className="topbarInner centered">
          <div className="brandCentered">
            <img src={spiderLogo} alt="Spider Logo" className="logoImg" />
            <div className="brandTextCentered">
              <h1>
                Lead Finder <span className="badgeMvp">MVP</span>
              </h1>
              <p>Find businesses fast and save to Google Sheets via backend.</p>
            </div>

            <button className="btnGhost logoutBtn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="left">
          <div className="card">
            <div className="cardHead">
              <h2>Search</h2>
              <p className="muted">
                Tip: Use city-level queries (ex: <b>“Phoenix, Arizona”</b>).
              </p>
            </div>

            <div className="form" onKeyDown={onKeyDownSearch}>
              <label className="field">
                <span>Profession</span>
                <input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="e.g. electrician, lawyer, plumber…"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Davao City"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>Country</span>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Philippines"
                  autoComplete="off"
                />
              </label>

              <div className="actions">
                <button
                  className="btn"
                  onClick={handleSearch}
                  disabled={!canSearch}
                >
                  {loading ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Searching…
                    </>
                  ) : (
                    "Search"
                  )}
                </button>

                <button
                  className="btnGhost"
                  onClick={handleClear}
                  disabled={loading}
                  type="button"
                >
                  Clear
                </button>
              </div>

              {err && (
                <div className="alert" role="alert">
                  <b>Error:</b> {err}
                </div>
              )}
            </div>
          </div>

          <div className="hintCard">
            <div className="hintTitle">Workflow</div>
            <ul className="hintList">
              <li>Run search → results saved to Sheets (backend).</li>
              <li>
                Use batch for scaling: <code>/run-batch</code>.
              </li>
              <li>
                Expect duplicates across areas — dedupe by <code>place_id</code>
                .
              </li>
            </ul>
          </div>
        </section>

        <section className="right">
          <div className="card results">
            <div className="cardHead">
              <div className="resultsTop">
                <h2>Results</h2>
                <span className="countPill">{data?.count ?? 0}</span>
              </div>
              <div className="subline">
                {data?.query ? (
                  <span className="muted">
                    <b>Query:</b> {data.query}
                  </span>
                ) : (
                  <span className="muted">
                    No search yet — run one on the left.
                  </span>
                )}
              </div>
            </div>

            {!data && !loading && (
              <div className="empty">
                <div className="emptyIcon" aria-hidden="true">
                  🔎
                </div>
                <div className="emptyTitle">Ready when you are</div>
                <div className="muted">
                  Enter a profession + city, then hit Search.
                </div>
              </div>
            )}

            {data && (
              <>
                {/* Mobile/Tablet Cards */}
                <div className="cards">
                  {data.results.map((r, idx) => (
                    <article className="leadCard" key={r.place_id || idx}>
                      <div className="leadTop">
                        <div className="leadName">{r.name}</div>
                        <div className="leadRating">
                          {r.rating ? (
                            <>
                              <span className="star">★</span> {r.rating}
                            </>
                          ) : (
                            <span className="muted">No rating</span>
                          )}
                        </div>
                      </div>

                      <div className="leadMeta">
                        <div className="metaItem">
                          <span className="metaLabel">Phone</span>
                          {r.phone ? (
                            <a className="metaLink" href={`tel:${r.phone}`}>
                              {r.phone}
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>

                        <div className="metaItem">
                          <span className="metaLabel">Website</span>
                          {r.website ? (
                            <a
                              className="metaLink"
                              href={r.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Visit
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>

                        <div className="metaItem">
                          <span className="metaLabel">Maps</span>
                          {r.maps_url ? (
                            <a
                              className="metaLink"
                              href={r.maps_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </div>

                      {r.address && (
                        <div className="leadAddress">{r.address}</div>
                      )}
                    </article>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="tableWrap">
                  <div className="table">
                    <div className="tRow tHead">
                      <div>Name</div>
                      <div>Phone</div>
                      <div>Website</div>
                      <div>Maps</div>
                      <div>Rating</div>
                    </div>

                    {data.results.map((r, idx) => (
                      <div className="tRow" key={r.place_id || idx}>
                        <div className="cellMain">
                          <div className="cellTitle">{r.name}</div>
                          <div className="cellSub">{r.address || ""}</div>
                        </div>

                        <div>
                          {r.phone ? (
                            <a href={`tel:${r.phone}`}>{r.phone}</a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                        <div>
                          {r.website ? (
                            <a
                              href={r.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Visit
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                        <div>
                          {r.maps_url ? (
                            <a
                              href={r.maps_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                        <div className="ratingCell">
                          {r.rating ? (
                            <>★ {r.rating}</>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="muted">Pistachio • Chocolate • Rose Pink</span>
      </footer>
    </div>
  );
}
