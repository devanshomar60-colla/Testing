# Resume Coach: PWA front end

Plain HTML/CSS/JS. No build step, no dependencies.

## Run it
    python3 -m http.server 8000      # then open http://localhost:8000
A service worker (offline + installable) only works on https or localhost, not on file://.

## Pages
- `#/`            Dashboard: readiness ring, stats, score trend, skill bars, recent activity, 12-week heatmap
- `#/interview`   Role picker, then the full-screen live interview (animated ring, typed question, answer box, mic, per-answer scores)
- `#/history`     Every interview and resume report, searchable and filterable
- `#/report/:id`  Interview report (scores, strengths, fix-first, full Q&A) or resume report (before/after, rewrites)
- `#/resume`      Resume enhancer
- `#/settings`    Install, export JSON, remove sample data, reset

## What is real vs demo
- History, dashboard and reports are real: every finished interview is saved in the browser (localStorage) and shows up everywhere.
- 8 interviews + 2 resume reports are SAMPLE data (marked "sample"). Remove them in Settings.
- Question list and scoring run in the browser (`questionsFor`, `mockScore` in app.js). They are rough heuristics for testing the UI, not a real evaluation.

## Connect your FastAPI backend (not done yet)
In app.js, replace only:
- `questionsFor(role)` + the first call in `startLive()`  -> `POST /api/interview/start`
- `mockScore(...)` in `submit()`                          -> `POST /api/interview/answer`
- `mockEnhance(text)`                                     -> `POST /api/resume/analyze`
The saved `session` shape (see `seed()`) matches your backend's rubric: relevance, depth, structure, communication (1-5); overall = average x 20.

## Files
index.html, styles.css, app.js, sw.js, manifest.webmanifest, icons/
Fonts (Sora, Inter) load from Google Fonts when online; system fonts are the fallback.
