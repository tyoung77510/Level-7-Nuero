# Technology Stack
> **Source:** INFRA-002 (Technology Stack) | **Last Updated:** 2026-07-19

## Core Platform
| System | Purpose | Access |
|--------|---------|--------|
| cto.new | Business HQ, team management, task board, plan, finance | Owner + Team Lead |
| GitHub (via cto.new) | Version control for code and documentation | Owner-configured repos |

## Website
| Component | Detail |
|-----------|--------|
| Framework | TanStack Start (React + Vite + Tailwind) |
| Hosting | cto.new platform (port 3000) |
| URL | https://level7dc.ctonew.app |
| Domain redirect | level7data.com → Cloudflare 301 |
| Source | `/home/team/shared/site/` |
| Publish | `bun run publish` from site directory |

## Data & Storage
| System | Purpose | Location |
|--------|---------|----------|
| Shared filesystem | Team file sharing | `/home/team/shared/` |
| Turso database (team-db) | Coordination database | Managed by cto.new |
| Contact submissions | Website inquiries | `/home/team/shared/contact-submissions/` |
| Client work | Deliverables | `/home/team/shared/client-work/` |

## Communication
| Channel | Purpose | Status |
|---------|---------|:------:|
| cto.new chat | Team coordination | ✅ Active |
| Email (admin@level7data.com) | Client communication | ✅ Live (Google Workspace) |
| LinkedIn | Networking and content | ✅ Active |

## Finance
| System | Purpose | Status |
|--------|---------|:------:|
| Stripe (via cto.new) | Payment processing | ✅ Active |

## Notifications
| System | Purpose | Status |
|--------|---------|:------:|
| Knock (linked to cto.new) | Notification infrastructure — workflows for onboarding, alerting, referrals, and other lifecycle messages across email/SMS/push/in-app | ✅ Connected, workflows not yet built |

Knock centralizes trigger-based messaging (e.g., "quick win delivered," "response SLA breached," "contract renewal due") instead of sending it manually. Matches the automation opportunity flagged in [[05-CLIENT/relationship-management.md]] — SLAs and event-based comms are currently manual SOP steps, not automated workflows.

## Obsidian Cross-References
- [[07-INFRASTRUCTURE/team-roles.md]] — Who manages each system
- [[07-INFRASTRUCTURE/directory-structure.md]] — Where everything is stored
- [[01-STRATEGY/business-plan.md]] — Live properties section
- [[09-QUICK-REFERENCE.md]] — Quick answers on URLs and email
- [[08-DECISIONS.md]] — Infrastructure decisions logged

> **Source file:** `/home/team/shared/infrastructure/INFRA-002-technology-stack.md`