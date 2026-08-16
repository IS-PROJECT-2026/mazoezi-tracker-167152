# Mazoezi — Training Log

A static web system that turns logged workouts into something worth looking at:
weekly volume against a target, a 30-day effort strip, a day streak, and
personal bests that update as you log.

**Live deployment:** https://is-project-2026.github.io/fitness-tracker-<ADMISSION>/

> Replace `<ADMISSION>` with your admission number once the repository is named.

---

## What it does

| Area | Behaviour |
|---|---|
| Logging | Add a session with date, activity, duration, distance, intensity, and a note; the distance field appears only for activities measured in kilometres |
| Validation | Rejects empty durations, missing dates, and dates in the future, with a message that says what to fix |
| Weekly volume | An SVG bar chart of the last eight Monday-to-Sunday weeks, with the current week highlighted and your target drawn as a reference line |
| Goal | Editable weekly minute target with a live progress bar and a "minutes to go" readout |
| Effort strip | 30-day grid shaded by the hardest session logged that day |
| Streak | Consecutive days with at least one session, counting back from today |
| Personal bests | Longest session, furthest distance, and biggest training week, recomputed on every change |
| History | Filter by activity, delete any session |

## Technologies

- **HTML5** — semantic markup, native form validation attributes, ARIA live region for status messages
- **CSS3** — custom properties, CSS Grid, graph-paper background built from layered gradients, `prefers-reduced-motion` support
- **Vanilla JavaScript (ES6+)** — no framework and no build step; every figure on screen is derived from one `sessions` array
- **Inline SVG** — the bar chart is generated in JavaScript rather than pulled from a charting library
- **Google Fonts** — Archivo, Barlow, JetBrains Mono
- **GitHub Actions** — CI/CD pipeline that publishes to GitHub Pages on every push to `main`
- **GitHub Pages** — hosting

## Running it locally

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

```
.
├── index.html          # entry point — GitHub Pages serves this from the repo root
├── css/styles.css      # visual system
├── js/data.js          # activity types, defaults, and the seeded session history
├── js/app.js           # state, analytics, and rendering
├── evidence/           # merge conflict screenshots
├── submission.md       # written assessment
└── .github/workflows/deploy-pages.yml
```

## Data and persistence

The log seeds itself with roughly nine weeks of sample sessions so the charts
have something to say on first load. State is in memory for the session; the
comment at the top of `js/app.js` marks the two places to change if you want it
stored.

## Notes

The seeded history is generated from a fixed seed, so the demo looks the same
every time it loads.
