# Design notes

Context for anyone extending this prototype: why it looks and behaves the way it does.

## The product thesis

This category (project controls / schedule analysis software) is full of powerful tools that are hard to use: Primavera P6, Acumen Fuse, Primavera Risk Analysis. The differentiation for this product isn't more features — it's being the version of this that a tired analyst can actually use at 4:45pm before a status meeting.

## Principles, in priority order

1. **Zero setup, one action to value.** Drag a file in, see a result. No project setup wizard, no field mapping, no account configuration before the first "aha" moment.
2. **Plain language over jargon, always with the number available.** "You're running about 2 weeks behind schedule" instead of "SPI: 0.87" as the headline — but the underlying number is one click away for analysts who want it. Never force translation in the user's head.
3. **Progressive disclosure.** Default view: health score, top issues, trend direction. Advanced views (DCMA sub-check breakdown, Monte Carlo, portfolio rollup) are one click deeper, not competing for attention on screen one. This is a competitive constraint, not just a preference — competitor review research turned up a recurring complaint against SmartPM specifically about being shown ~35 metrics at once with no guidance on which ones matter, i.e. data overload from skipping this principle. Any new metric added to the default view should be treated as a regression toward that failure mode unless it's the single most decision-relevant number for that screen.
4. **One primary action per screen.** The flow is linear: Upload → Health → Issues → Report. Resist the urge to add a dashboard-with-everything home screen.
5. **The report writes itself.** No formatting decisions left for the user on export — good defaults, one click, done. Writing the status report narrative is the single most-hated recurring task for both analysts and PMs; automating it is probably the highest-leverage single feature in the whole product.
6. **Smart defaults over configuration.** Pick the industry-standard threshold (e.g., 44 workdays for excessive float, per DCMA convention) and let it be changed later in settings for the rare user who cares, rather than asking upfront.

## Visual language

- The health score bar is intentionally a segmented bar, not a gauge or a donut chart — it echoes the Gantt bars analysts already read all day, so the "new" visual vocabulary is actually a familiar one borrowed from their own domain.
- Color always carries meaning (green/amber/red = healthy/at-risk/critical), never decoration.
- Numbers are rounded to what a human would say out loud ("2 weeks behind," not "13.4 days"), with exact figures available on click-through.

## What NOT to do

- Don't add a settings screen before there's a second setting worth exposing.
- Don't compute or display EVM metrics (CPI/SPI/EAC) without real cost data behind them — a fabricated number is worse than an honest "not available yet."
- Don't let the issues list turn into a raw dump of DCMA rule codes. Every issue should read as a sentence about a specific, named activity.
