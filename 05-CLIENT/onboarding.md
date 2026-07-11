# Client Onboarding Process
> **Source:** SOP-001 (Client Onboarding) | **Last Updated:** 2026-07-11

## Process Flow
```
Lead Captured → Discovery Call → Proposal → SOW Signed → Kickoff → Team Assignment → Engagement
```

## Step-by-Step

### 1. Lead Intake
- **Sources:** Website contact form, LinkedIn response, referral, inbound inquiry
- **Response SLA:** Within 4 business hours
- **Action:** Acknowledge, confirm availability for discovery call, send introductory materials
- **Storage:** `/home/team/shared/contact-submissions/`

### 2. Discovery Call (30 min)
- **Attendees:** Client decision-maker + relevant Level 7 delivery agent
- **Agenda:** Understand current state (pain points, systems, team, budget) → Identify scope → Determine readiness
- **Output:** Discovery Call Notes → `/home/team/shared/client-work/[client-name]/discovery-notes.md`

### 3. Proposal
- Based on discovery call insights
- **Contents:** Executive summary, scope, methodology, timeline, pricing, terms
- **Review:** Team Lead reviews before sending
- **Format:** PDF via email or shared link

### 4. Statement of Work (SOW)
- Detailed scope, deliverables, timeline, assumptions, exclusions, payment terms
- **Must include:** Success criteria, acceptance criteria, change order process
- **Signed by:** Client authorized representative + Level 7 Team Lead

### 5. Kickoff (60 min)
- **Attendees:** Full client team + Full Level 7 delivery team
- **Agenda:** Project charter review, roles & responsibilities, communication cadence, access provisioning
- **Output:** Kickoff Summary + Project Charter → client work directory

### 6. Client Work Directory Setup
```
/home/team/shared/client-work/[client-name]/
├── discovery-notes.md
├── proposal.md
├── sow.md
├── project-charter.md
├── communications/
├── deliverables/
└── closeout.md
```

## SLAs
| Activity | SLA |
|----------|:---:|
| Response to new lead | 4 hours |
| Proposal after discovery call | 48 hours |
| No engagement starts without signed SOW | ⛔ Non-negotiable |

## Obsidian Cross-References
- [[04-SALES-MARKETING/outreach-playbook.md]] — Lead handoff from sales
- [[05-CLIENT/relationship-management.md]] — Client management after onboarding
- [[05-CLIENT/quick-wins.md]] — Quick wins delivered in week 1
- [[03-DELIVERY/engagement-lifecycle.md]] — Onboarding flows into Discovery phase
- [[07-INFRASTRUCTURE/directory-structure.md]] — Client directory structure
- [[03-DELIVERY/quality-standards.md]] — Quality standards apply to proposals
- [[IDENTITY.md]] — Brand voice in client communications

> **Source file:** `/home/team/shared/sops/SOP-001-client-onboarding.md`