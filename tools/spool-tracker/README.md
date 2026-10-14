# Foreman Spool Board

A single-page tracker for a pipefitter foreman. It is published as a claude.ai Artifact: https://claude.ai/artifact/LYJnvnbmqKSisMhQ53Kpac

## What it tracks
- **Systems.** Inventory of every piping system you're responsible for (line no., service, spec, area), with its spools listed under it.
- **Spools.** Spool no., size, length (LF) and field welds. Each spool moves through these stages: At fab shop → On trailer → Offloaded → Staged → Ready to fly → Installed. The tracker records the trailer no., offload time, staging location and the timestamp of each stage. Use **Bulk add** to paste a spool list from a spreadsheet.
- **Welds.** Required vs. completed for each spool. Tap **+1 weld** to log a weld; it's timestamped so the daily report can count today's welds.
- **Bottlenecks.** Cause, crew size, start and clear times. Open ones show a running timer. Totals are shown as time lost and crew-hours lost, broken down by cause.
- **Materials.** A Needed / Ordered list with need-by dates (overdue items are flagged), plus a received log with storage location.
- **Daily report.** Plain text you can copy, built for any date: LF installed, welds, offloads, staging, crane queue, bottlenecks and materials.

## How data is stored
Records live in the artifact's shared database (`db` capability). Collections: `systems`, `spools`, `bottlenecks`, `materials`, `activity`, `meta/job`. Anyone the artifact is shared with as a Contributor or higher can update it. Viewers see live, read-only data.

To update the page, edit `index.html` and republish it to the same artifact URL. Republishing keeps the data.
