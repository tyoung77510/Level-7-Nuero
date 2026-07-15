# Infrastructure roadmap

The current prototype (`app/index.html`) is a single-file, browser-only demo. This document lays out what's needed to turn it into something a team can actually rely on, roughly in the order it should be built.

## Why this order

Don't build everything before getting users. The prototype is genuinely fine for pilot customers doing manual, one-off uploads. Sequence infrastructure as: (1) backend + auth first, since it's required for *any* multi-user value, (2) real EVM/cost integration next, since that's the single biggest credibility unlock for a project-controls audience, (3) automated ingestion and notifications after that, once there's evidence people are using it daily.

## 1. Backend and database

Browser storage (what the prototype uses today) disappears when someone clears cache or switches devices. Needed:
- A server-side database (Postgres is the standard choice) to persist uploaded schedules, parsed activity data, health score history, and issue resolution status
- A real API layer between the frontend and the database
- Multi-user access to the same project data

## 2. Authentication and multi-tenancy

Table-stakes the moment more than one person needs to see the same project:
- Accounts and org/workspace boundaries
- Role-based access (analyst vs PM vs admin — PMs likely don't need raw DCMA codes, analysts need everything)
- Typically built on an existing provider (Auth0, Clerk) rather than rolled from scratch

## 3. Server-side file parsing

In-browser XER parsing works for a demo but breaks down for:
- **MPP files** (MS Project) — binary format, effectively requires a server-side library like `mpxj`
- Large schedules (10,000+ activities) — will hang a browser tab
- Files that need virus scanning before touching the system

Needed: an upload pipeline where the file lands in object storage (S3 or equivalent), a background job parses it, results are written to the database, and the UI polls or gets pushed the result.

## 4. Real EVM/cost integration layer

The biggest value unlock and the biggest infrastructure lift. Schedule-only exports have no cost data, so real CPI/SPI/EAC requires connecting to wherever cost actually lives:
- Integration/ETL layer for common ERP systems (SAP, Oracle, Deltek), or at minimum a cost CSV import with a mapping step
- A reconciliation step, since cost data and schedule data almost never share identical activity codes

## 5. Scheduled/automated ingestion

Value compounds when someone doesn't have to remember to upload:
- A nightly job pulling the latest schedule from wherever it lives (SharePoint, a P6 database directly, a watched email inbox)
- Primavera has a web services API worth targeting for direct P6 integration

## 6. Notifications

A dashboard nobody checks doesn't create value. This turns the product from "pull" to "push":
- Alerting (email, Slack, Teams) when health score drops, a new critical issue appears, or float goes negative on something on the critical path
- Needs a job scheduler plus integration with whatever messaging tool the team already uses

## 7. Audit trail and versioning

Project controls is compliance-adjacent — being able to show what the schedule looked like on every reporting date, and who acknowledged which issue, matters for contract disputes and audits.
- Immutable snapshots, not just mutable "current state"

## 8. Security and compliance basics

Since this touches contractor/client project data:
- Encryption at rest and in transit
- SOC 2, eventually, if selling to enterprise/government contractors
- FedRAMP if defense/government work is a target segment — a serious lift, worth deciding early whether it's in scope

## Open questions for whoever picks this up

- Which ERP/cost systems are the actual target customers using? This determines the first integration to build in step 4.
- Is government/defense a target segment? This determines how early FedRAMP planning needs to start, since it affects hosting choices made much earlier than step 8.
- Direct P6 API integration vs. file upload as the primary ingestion method — the former is a much bigger lift but removes the single biggest point of friction (remembering to export and upload).
