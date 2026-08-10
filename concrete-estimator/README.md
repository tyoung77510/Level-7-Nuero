# Concrete Estimator — BoxxedOut

> **Status:** ✅ Active | **Purpose:** Quote a concrete slab in seconds from the field, using phone GPS to measure square footage. | **Last Updated:** 2026-08-08

A self-contained, installable mobile web app (PWA). Open it on your phone, walk the slab to measure it with GPS, and get an itemized cost + a customer-facing quote instantly. Works offline once loaded — good for remote job sites with no signal.

## What it does

1. **Measure the area** three ways:
   - **📍 GPS Walk** — stand on each corner, tap *Add corner*. The app computes area (shoelace formula) and perimeter from the GPS points. Shows live accuracy (±m) so you know the reading is good.
   - **▭ L×W** — type dimensions for a simple rectangle.
   - **⊞ Sections** — add a length × width box for each rectangle of the pour (L-shapes, separate pads); areas are summed automatically. Tick **Subtract** on a box to remove a cutout you're not pouring.
   - **✎ Sq Ft** — enter a known area (and optional perimeter) directly.
2. **Set job details** — slab thickness, gravel base depth, crew size, days, and toggles for rebar, pump, demo, dirt haul-off, site prep, plus any extra equipment rental.
3. **Get the quote** — a full itemized breakdown (your cost, contingency, markup, margin) — **your eyes only**.
4. **Send it to the customer** — the app builds a clean, branded quote sheet showing only the scope of work and the total price (never your cost or margin). Send it straight from your phone:
   - **📤 Send** — opens your phone's share sheet (text, email, WhatsApp, AirDrop…).
   - **💬 Text** — opens Messages pre-filled to the customer's number.
   - **✉️ Email** — opens your email app pre-filled to the customer.
   - **🖨 PDF** — prints/saves the branded quote sheet as a PDF.
   - **📋 Copy** — copies the customer quote text to paste anywhere.

   Fill in your business name, phone, email, license #, and quote-valid days once (⚙︎ **Your business info**) and they print on every quote. Add the customer's name, phone, email, and job address per job.

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
| **Rebar** | #5 grid ≈ 24 × area ÷ spacing, +10% laps, × $/lin ft |
| **Equipment** | concrete pump $650/job (toggle) + any extra rental |
| **Allowances** | known-unknowns (over-excavation, etc.), bid as an explicit direct-cost line |
| **Contingency** | unknown-unknowns, % of direct cost, set by **Risk profile** |
| **Target gross margin** | price is **cost ÷ (1 − margin)**, not cost × markup |
| **Minimum charge** | price floor for small jobs |
| **Overhead** | % of price, used to show estimated **net** profit |

### Risk-based contingency, allowances, and exclusions
Contingency is **sized to risk**, not a flat number. A **Risk profile** selector sets it: new pour/open access 4%, tear-out & replace 9%, stamped/colored 13%, unknown subgrade/clay/tight access 17%, pump/can't-see-under-slab 22% (all editable). **Allowances** (known-unknowns with a quantifiable range) are bid as their own explicit line, separate from contingency. Order of operations: **direct costs → + allowances → + contingency → ÷ (1 − margin) → price**. Contingency and allowances live only in your cost buildup — the customer never sees them.

A per-job **Exclusions** list (unsuitable soils/over-excavation, buried obstructions, undisclosed utilities, drainage/engineering not shown, permits, weather re-mobilization, change-order clause) prints on the customer quote sheet — the real margin protector alongside a defined scope.

### Pricing off margin (not markup)
The price is computed as **Price = Total job cost ÷ (1 − target gross margin)** — never cost × markup. A finish-type selector presets the target margin (broom 30%, commercial/repair 35%, stamped/colored 40%) and it's editable. The "your view" breakdown shows direct cost, total job cost, customer price, **gross profit + gross %**, overhead, and **estimated net profit + net %**. A minimum charge floors small jobs and flags when it's applied. None of this reaches the customer sheet — they only ever see scope + total price.

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
