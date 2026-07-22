#!/usr/bin/env node
// Renders Founder Log cards (Nocturne design system) from a JSON data file to JPGs.
//
// Usage:
//   node render.js data.json                # renders every entry in data.json
//   node render.js data.json --only=003,007  # renders only the listed episode numbers
//
// data.json is an array of entries:
//   {
//     "day": 3,                                   // required, drives the zero-padded episode number
//     "headline": "Your schedule says green. **Reality says red.**",
//     "body": "Plain body copy.",
//     "footer": "New from the build, every week · ordo7.pro",
//     "portraitSide": "left" | "right",            // default "right"
//     "types": ["feed"] | ["feed","cover"],         // default ["feed"]
//     "headlineSize": 82,                           // optional override (feed default 82, cover default 46)
//     "kicker": "[ FOUNDER LOG — 003 ]"             // optional, derived from `day` if omitted
//   }
//
// Bold markers (**text**) in `headline` are converted to the accent-purple span used
// throughout the design system. `body` and `headline` are otherwise treated as plain text
// (HTML-escaped) so content authors never need to hand-write markup.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RENDER_DIR = __dirname;
const OUT_DIR = path.join(RENDER_DIR, '..', 'renders');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatHeadline(raw) {
  // split on **bold** and wrap survivors in an accent span, escaping everything else
  return escapeHtml(raw).replace(/\*\*(.+?)\*\*/g, (_, inner) => `<span class="accent">${inner}</span>`);
}

function episodeNum(day) {
  return String(day).padStart(3, '0');
}

function fillTemplate(templateStr, entry, { headlineDefault }) {
  const ep = episodeNum(entry.day);
  const kicker = entry.kicker || `[ FOUNDER LOG — ${ep} ]`;
  const portraitSide = entry.portraitSide === 'left' ? 'left' : 'right';
  const headlineSize = entry.headlineSize || headlineDefault;

  return templateStr
    .replace(/\{\{KICKER\}\}/g, kicker)
    .replace(/\{\{HEADLINE\}\}/g, formatHeadline(entry.headline))
    .replace(/\{\{HEADLINE_SIZE\}\}/g, headlineSize)
    .replace(/\{\{BODY\}\}/g, escapeHtml(entry.body))
    .replace(/\{\{FOOTER\}\}/g, escapeHtml(entry.footer || 'New from the build, every week · ordo7.pro'))
    .replace(/\{\{PORTRAIT_LEFT_DISPLAY\}\}/g, portraitSide === 'left' ? 'block' : 'none')
    .replace(/\{\{PORTRAIT_RIGHT_DISPLAY\}\}/g, portraitSide === 'right' ? 'block' : 'none');
}

async function renderCard(browser, html, width, height, outPath) {
  // write the filled template next to the templates so its relative
  // "../assets/..." image paths resolve when loaded via file://
  const tmpPath = path.join(RENDER_DIR, `.tmp-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html);
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(`file://${tmpPath}`, { waitUntil: 'networkidle' });
    await page.locator('#card').screenshot({ path: outPath, type: 'jpeg', quality: 92 });
  } finally {
    await page.close();
    fs.unlinkSync(tmpPath);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dataPath = args[0];
  if (!dataPath) {
    console.error('Usage: node render.js <data.json> [--only=003,007]');
    process.exit(1);
  }
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

  const entries = JSON.parse(fs.readFileSync(path.resolve(dataPath), 'utf8'));
  const feedTemplate = fs.readFileSync(path.join(RENDER_DIR, 'template-feed.html'), 'utf8');
  const coverTemplate = fs.readFileSync(path.join(RENDER_DIR, 'template-cover.html'), 'utf8');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const entry of entries) {
      const ep = episodeNum(entry.day);
      if (only && !only.has(ep)) continue;
      const types = entry.types && entry.types.length ? entry.types : ['feed'];

      if (types.includes('feed')) {
        const html = fillTemplate(feedTemplate, entry, { headlineDefault: 82 });
        const out = path.join(OUT_DIR, `founder-log-${ep}-feed-1200x1500.jpg`);
        await renderCard(browser, html, 1200, 1500, out);
        console.log(`wrote ${out}`);
      }
      if (types.includes('cover')) {
        const html = fillTemplate(coverTemplate, entry, { headlineDefault: 46 });
        const out = path.join(OUT_DIR, `founder-log-${ep}-cover-1200x627.jpg`);
        await renderCard(browser, html, 1200, 627, out);
        console.log(`wrote ${out}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
