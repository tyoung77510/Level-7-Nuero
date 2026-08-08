# Concrete Estimator — BoxxedOut

> **Status:** ✅ Active | **Purpose:** Quote a concrete slab in seconds from the field, using phone GPS to measure square footage. | **Last Updated:** 2026-08-08

A self-contained, installable mobile web app (PWA). Open it on your phone, walk the slab to measure it with GPS, and get an itemized cost + a customer-facing quote instantly. Works offline once loaded — good for remote job sites with no signal.

## What it does

1. **Measure the area** three ways:
   - **📍 GPS Walk** — stand on each corner, tap *Add corner*. The app computes area (shoelace formula) and perimeter from the GPS points. Shows live accuracy (±m) so you know the reading is good.
   - **▭ Length × Width** — type dimensions for a simple rectangle.
   - **✎ Sq Ft** — enter a known area (and optional perimeter) directly.
2. **Set job details** — slab thickness, gravel base depth, crew size, days, and toggles for rebar, pump, demo, dirt haul-off, site prep, plus any extra equipment rental.
3. **Get the quote** — a full itemized breakdown (your cost) plus the marked-up **customer quote** and price per ft². Print/Save-PDF or copy to text to send in seconds.

## Line items covered (everything you asked for)

| Item | How it's estimated |
|---|---|
| **Concrete (yd³)** | area × thickness ÷ 27, + waste % |
| **Aggregate / gravel base** | area × base depth ÷ 27 → tons (1.35 t/yd³) |
| **Site prep / grading** | $ per ft² |
| **Demo existing slab** | $ per ft² (toggle) |
| **Dirt removal / haul-off** | excavation volume × 1.25 swell, $ per yd³ (toggle) |
| **15% contingency** | % of subtotal (editable) |
| **Labor** | crew × days × $500/day per guy (editable) |
| **Lumber (forming)** | perimeter × $ per lin ft |
| **Rebar** | #4 grid ≈ 24 × area ÷ spacing, +10% laps, × $/lin ft |
| **Equipment** | concrete pump $650/job (toggle) + any extra rental |
| **Markup / margin** | % added on top of your cost → the customer quote |

## Your prices are saved

All unit prices live in the **⚙︎ Your unit prices & rates** panel and are stored on your device (localStorage). Set them once; every future quote uses them. Defaults are reasonable placeholders — **update them to your real numbers** (concrete $/yd³, gravel $/ton, etc.) before quoting live jobs.

## Run it on your phone

GPS requires **HTTPS** (or `localhost`). Easiest option — **GitHub Pages**:

1. In the repo settings → Pages, serve from the branch, folder `/concrete-estimator`.
2. Open the published URL on your phone (e.g. `https://<user>.github.io/<repo>/concrete-estimator/`).
3. Tap the browser share menu → **Add to Home Screen**. It installs as a standalone app and works offline afterward.

Local testing on a computer:

```bash
cd concrete-estimator
python3 -m http.server 8080
# open http://localhost:8080
```

(GPS won't work over plain `http://` on a phone — it needs HTTPS. Use the Length × Width tab for desktop testing.)

## Files

- `index.html` — the entire app (UI + estimating engine, no dependencies)
- `manifest.webmanifest` — PWA install metadata
- `sw.js` — service worker for offline use
- `icons/` — app icons

## Notes & accuracy

- GPS area is only as good as the fix — aim for **±8 m or better** (shown in green). Walk to open sky, away from buildings/trees. For small or high-precision pours, measure with a tape and use the Length × Width tab.
- Concrete volume is a field estimate. **Confirm with your ready-mix supplier before ordering.**
- The 1.25 excavation swell factor and 1.35 t/yd³ gravel density are standard rules of thumb; adjust prices to match your local suppliers.

> **Built for:** BoxxedOut
