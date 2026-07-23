# Gate 1 — the first 10 paying customers (30/60/90)

> **Status:** ✅ Active | **Purpose:** The execution plan to reach Ordo7's first 10 paying customers — the one requirement that gates all scaling. | **Last Updated:** 2026-07-23

## The gate

**10 paying customers who would be genuinely upset if Ordo7 disappeared.** Not 10 signups, not 10 trials — 10 people paying real money who'd miss it. Until this clears: no paid ad spend, no new features (see the standing constraints), no scaling automation. This is the proof that the funnel converts at all.

**Why 10 and not 100:** 10 is the smallest number that can't be a fluke. It forces you to talk to every one of them by hand, and the transcript of those conversations *is* the sales playbook you automate at customer #50.

## The funnel we now measure

Instrumentation shipped (see `funnel-analytics.md`). Once `GA4_MEASUREMENT_ID` is set in Railway, every stage is visible:

`land → sign_up → schedule_analyzed (activation) → view_pricing → begin_checkout → purchase`

**The whole game is finding the biggest single drop-off and fixing it.** Everything below feeds people into the top; GA4 tells you where they leak out.

---

## Phase 1 — Days 1–30: Foundation & first conversations
**One metric: discovery/demo calls booked with real ICP prospects. Target: 12–15.**

The first customers almost never come from cold self-serve at zero brand — they come from **conversations.** This month is about starting them.

- **Turn measurement on (Day 1–2).** Set `GA4_MEASUREMENT_ID` in Railway. Link Search Console. Without this the rest is guesswork.
- **Nail the ICP to one sentence.** Not "$20M–$500M industrial/engineering firms" — that's a market, not a target. Pick the *person*: e.g. "a project controls lead at an EPC firm who reports schedule status to an owner every month and dreads the ones that are slipping." Write it down. Every outreach and every word on the site speaks to that person.
- **Work the warm network first.** The fastest first 3 customers are people who already trust you. List everyone from 8 years in project controls — ex-colleagues, clients, LinkedIn 1st-degree in the ICP. Personal message, not a pitch: "I built the thing I always wished I had — 15 min to show you?"
- **Point Apollo at the ICP, book calls (not sales).** The sequences already run; the goal of a reply is a 15-minute call, not a close. Offer to run *their* schedule through Ordo7 live on the call.
- **Make the Founding Customer offer.** Leverage the price-lock you already built: first 10 customers get a permanent founding rate + direct line to you, in exchange for a testimonial and honest feedback. Scarcity is real and honest here.
- **Founder Log keeps running** as the distribution flywheel — but treat inbound as a slow compounder this month, not the source of the first 10.

**Exit check:** 12–15 calls booked, ≥5 ICP prospects activated (uploaded a real schedule), 1–3 paying (likely from warm network). If calls aren't booking, the *message/ICP* is wrong — fix that before anything else.

---

## Phase 2 — Days 31–60: Make the conversation repeatable
**One metric: paying customers (cumulative). Target: ~6.**

- **Run the demo → trial → paid motion, the same way every time.** On each call: upload their schedule, show the one thing that's slipping they didn't know about, hand them the Free tier, agree a follow-up. Write down what objection or "aha" recurs.
- **Fix the #1 funnel leak.** By now GA4 has data. Find the worst drop-off and fix only that:
  - Leak at `sign_up` → landing message or signup friction.
  - Leak `sign_up → schedule_analyzed` → the upload/activation experience (the most likely culprit; getting a real schedule in is the hardest step).
  - Leak `view_pricing → purchase` → price framing or checkout friction.
- **Turn the first customers into content.** A Founder Log post: "what analyzing 20 real schedules taught me about how projects actually slip." Real, specific, no fluff — it recruits the next ICP prospects.
- **Ask every happy free user why they haven't paid.** The answer is your roadmap and your objection-handling script.

**Exit check:** ~6 paying, a demo script that's starting to feel repeatable, one identified-and-fixed funnel leak with before/after in GA4.

---

## Phase 3 — Days 61–90: Close the gate
**One metric: paying customers (cumulative). Target: 10.**

- **Convert the trials you started.** Direct, personal follow-up. The founding-customer clock (limited slots) is your honest close.
- **Ask for referrals.** Your happiest customers know others exactly like them — project controls is a small, connected world. The built-in referral bonus makes this frictionless.
- **Write the playbook.** From ~10 real sales conversations, document: who buys, the words that land, the objection that recurs, the "aha" that converts. This artifact is Gate 2's foundation — the thing that lets someone *other than you* make the next sale.
- **Re-check the ICP against reality.** Who actually paid? If it's a narrower or different person than you targeted, that's the real ICP — rewrite the one-sentence definition to match.

**Exit check — Gate 1 cleared:** 10 paying customers, a written sales playbook, and GA4 showing a funnel you understand end to end. *Now* — and only now — "scale to X" becomes a real requirement (Gate 2: repeatability from one channel).

---

## Leading indicators (watch weekly, not just the total)
The customer count is a lagging number. These predict it:
1. **Calls booked / week** — if this is zero, nothing else matters; the message is wrong.
2. **Activation rate** (`schedule_analyzed` ÷ `sign_up`) — are people getting to value?
3. **View-pricing → begin-checkout rate** — is the offer landing?
4. **Time-to-first-value** — how long from signup to a scored schedule.

If the customer count lags but calls are booking and people are activating, you have a *closing* problem (fixable on calls). If calls aren't booking at all, you have a *message/ICP* problem (fix first). Diagnose before you push harder.

## What NOT to do during Gate 1
- No paid ads (LinkedIn/Meta) — pixels can build audiences passively, but don't spend until the funnel converts organically.
- No new features — the standing freeze holds. A feature you build before 10 customers is a guess.
- No scaling automation downstream of a sale — the first 10 are sold by hand, deliberately.

> **Built by:** Team Lead + Owner · aligned to the Musk Algorithm (question → delete → simplify → accelerate → automate) in SOUL.md
> **Related:** funnel-analytics.md · founder-log-calendar.md · cresco-growth-seo-agent.md · ../04-SALES-MARKETING
