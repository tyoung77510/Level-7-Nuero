# Data & CMMS — Delivery Summary
> **Source:** SOP-DP-001 (Data Audits & Cleansing), SOP-DP-002 (Process Redesign & SOPs), SOP-DP-003 (CMMS Deployment) | **Last Updated:** 2026-07-11

## Data Quality Audit Framework

### Five Quality Dimensions
| Dimension | Definition | Industrial Example |
|-----------|------------|--------------------|
| **Completeness** | Are required fields populated? | "37% of asset records have no serial number" |
| **Accuracy** | Does data reflect reality? | "14% of inventory locations are wrong" |
| **Consistency** | Is data synchronized across systems? | "Same vendor as 'Acme Inc', 'Acme Incorporated', 'ACME Corp'" |
| **Timeliness** | Is data current per SLAs? | "PM schedules use 2019 equipment register; 23 assets retired" |
| **Uniqueness** | Duplicate records? | "47 duplicate vendor entries for 18 actual suppliers" |

### Data Quality Score (DQS) Calculation
```
DQS = (Completeness × 0.25) + (Accuracy × 0.30) + (Consistency × 0.20) + (Timeliness × 0.15) + (Uniqueness × 0.10)
```

| Score | Rating | Action |
|:-----:|--------|--------|
| 95–100 | ✅ Excellent | Monitor |
| 80–94 | ⚠️ Acceptable | Targeted improvements |
| 60–79 | 🔶 Poor | Remediation plan |
| < 60 | 🔴 Critical | Immediate intervention |

### Severity Classification
| Severity | Definition | SLA |
|:--------:|------------|-----|
| **S1** | Safety risk, compliance, downtime | 24-hr notification |
| **S2** | Financial misstatement, wrong materials | Weekly status |
| **S3** | Operational inefficiency | Monthly report |
| **S4** | Cosmetic/nice-to-fix | Backlog |

### Six-Phase Audit Methodology
1. **Scoping & Discovery** — Define boundaries, CDEs, quality SLAs
2. **Baseline Measurement** — Quantify all 5 dimensions
3. **Root Cause Analysis** — Why is data bad?
4. **Prioritization** — Impact × Effort matrix
5. **Remediation Planning** — Automated + manual cleanup
6. **Execution & Validation** — Fix, re-measure, handoff

## Data Cleansing Workflow
```
Identify → Classify → Standardize → Deduplicate → Enrich → Validate → Freeze
```

### Master Data Management Domains
| Domain | Key Entities | Critical Fields |
|--------|-------------|-----------------|
| Asset Master | Equipment, machinery | Asset ID, description, category, manufacturer, model, serial, install date, location |
| Material Master | Spare parts, MRO | Part #, description, UOM, unit cost, lead time, min/max, vendor |
| Vendor Master | Suppliers, manufacturers | Vendor ID, legal name, address, payment terms, commodity codes |
| Location Master | Plants, warehouses, bins | Location code, description, type, parent location |

### Asset Hierarchy Standard (5 Levels)
```
Level 1: Site/Plant
Level 2: Process Unit/Area
Level 3: System
Level 4: Asset/Equipment
Level 5: Component
```

## CMMS Platform Evaluation

| Platform | Best For | Starting Price |
|----------|----------|:--------------:|
| **UpKeep** | Small-mid, mobile-first | $45/user/month |
| **Fiix** | Mid-market manufacturing | ~$500/mo base |
| **Maintenance Connection** | Mid-large, regulated | ~$1,000/mo base |
| **IBM Maximo** | Large enterprise | $150–$300/user/month |
| **eMaint** | Mid-market, reliability focus | $65–$85/user/month |

### Platform Selection Process
1. Requirements definition (must-have vs nice-to-have)
2. Shortlist 3 platforms using weighted scorecard
3. Structured demos with real client scenarios
4. Reference calls (2–3 same-size clients)
5. Final selection with documented rationale

## Preventive Maintenance Program Design
### Asset Criticality Scoring
```
Criticality Score = Σ (Consequence Score × Consequence Weight) × Likelihood Factor
```

| Score | Class | Strategy |
|:-----:|:-----:|----------|
| 60–150 | A — Critical | Full PM program, condition monitoring, spare parts on site |
| 30–59 | B — Important | Standard PM, warehouse spares, basic SOPs |
| 10–29 | C — Standard | Basic PM only (lube, visual) |
| < 10 | D — Non-critical | Run-to-failure |

## KPI Benchmarks

| KPI | Good | World-Class |
|-----|:---:|:-----------:|
| Schedule Compliance | ≥ 85% | ≥ 95% |
| PM Completion Rate | ≥ 90% | ≥ 98% |
| Reactive vs Planned | < 20% emergency WOs | < 10% |
| MTBF | Industry-specific | 2× industry avg |
| MTTR | Industry-specific | < 50% industry avg |
| OEE | ≥ 60% (discrete) / ≥ 80% (continuous) | ≥ 85% / ≥ 95% |
| Maintenance Cost % of RA | ≤ 4% | ≤ 2% |

## SOP Development Standards
- **Structure:** Header → Purpose → Scope → Prerequisites → Procedure → References → Definitions → Change Log
- **Numbering:** `SOP-[AREA]-[NNN]` (e.g., SOP-MNT-001)
- **Revision:** Start at 1.0; review annually
- **Write in:** Active voice, imperative mood, present tense, single action per step
- **Grade Level:** ≤ 10 (target: high school reading level)
- **Max length:** 10 pages

## Obsidian Cross-References
- [[03-DELIVERY/project-controls.md]] — Clean data feeds accurate controls dashboards
- [[03-DELIVERY/pm-frameworks.md]] — SOPs support PMO governance
- [[03-DELIVERY/quality-standards.md]] — SOP-003 governs deliverable quality
- [[02-PRODUCT/service-catalog.md]] → Asset Integrity and Clean Sheet packages
- [[07-INFRASTRUCTURE/team-roles.md]] — Data & Process Agent owns this domain
- [[05-CLIENT/quick-wins.md]] — Data quick wins for first 7 days
- [[SOUL.md]] — "Systems over heroics" principle

> **Source files:** `/home/team/shared/sops/SOP-DP-001-data-audits-cleansing.md`, `SOP-DP-002-process-redesign-sops.md`, `SOP-DP-003-cmms-deployment.md`