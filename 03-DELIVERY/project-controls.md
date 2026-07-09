# Project Controls — Delivery Summary
> **Source:** SOP-PC-001 (EVM Implementation), SOP-PC-002 (Cost/Schedule Control), SOP-PC-003 (Dashboards & Reporting)

## EVM Fundamentals
Earned Value Management integrates scope, schedule, and cost into one framework.

### The Three Data Points
| Metric | Name | Meaning |
|--------|------|---------|
| **PV** | Planned Value | Budgeted cost of work scheduled (where you planned to be) |
| **EV** | Earned Value | Budgeted cost of work performed (where you actually are) |
| **AC** | Actual Cost | Actual cost of work performed (what you actually spent) |

### Derived Metrics
| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **SV** (Schedule Variance) | EV − PV | Positive = ahead of schedule |
| **CV** (Cost Variance) | EV − AC | Positive = under budget |
| **SPI** (Schedule Performance Index) | EV / PV | > 1.0 = ahead; < 1.0 = behind |
| **CPI** (Cost Performance Index) | EV / AC | > 1.0 = under; < 1.0 = over |

### Forecasting
| Metric | Formula | Meaning |
|--------|---------|---------|
| **EAC** (Estimate at Complete) | AC + (BAC − EV) / CPI | Projected final cost |
| **TCPI** (To-Complete Performance Index) | (BAC − EV) / (BAC − AC) | CPI needed to stay within budget |

### Thresholds for Action
| SPI/CPI Range | Status | Action |
|:-------------:|--------|--------|
| 0.95–1.05 | On track | Monitor |
| 0.85–0.94 | Yellow | Investigate, create correction plan |
| < 0.85 | Red | Formal recovery plan required |

## Cost Baseline Development
1. WBS creation (work breakdown structure)
2. Resource loading (labor, material, equipment per WBS element)
3. Time-phased budget (spend plan by period)
4. Management reserve (5–10% of total budget)
5. Baseline freeze (formal change control required)

## Schedule Baseline Development
- Critical path method (CPM) with forward/backward pass
- Float management: > 20 days = normal; < 10 days = flag
- Schedule risk analysis with Monte Carlo simulation for projects > $10M
- Monthly schedule updates with actual progress

## Dashboard & Reporting

### Tiered Dashboards by Audience
| Audience | KPIs | Refresh |
|----------|------|---------|
| **Executive** | SPI, CPI, EAC vs Budget, Top 3 Risks | Monthly |
| **PM/Team** | Detailed SV, CV, EV curves, resource loading | Weekly |
| **Planner** | WBS-level EV, task completion, critical path | Daily |

### Standard Reports
| Report | Frequency | Audience |
|--------|-----------|----------|
| Monthly Performance Report | Monthly | Executive + Client |
| Weekly Status Dashboard | Weekly | PM + Steering Committee |
| Variance Analysis | Monthly | PM + Controls Lead |
| Change Log | As needed | All stakeholders |
| Risk Register | Monthly | PM + Steering Committee |

## Obsidian Cross-References
- [[03-DELIVERY/pm-frameworks.md]] — Controls support PMO governance
- [[03-DELIVERY/data-cmms.md]] — Data quality feeds controls dashboards
- [[03-DELIVERY/quality-standards.md]] — Quality standards for reports
- [[02-PRODUCT/service-catalog.md]] → Control Tower and Controls-as-a-Service
- [[07-INFRASTRUCTURE/team-roles.md]] — Controls Agent owns this domain

> **Source files:** `/home/team/shared/sops/SOP-PC-001-evm-implementation.md`, `SOP-PC-002-cost-schedule-control.md`, `SOP-PC-003-dashboards-reporting.md`