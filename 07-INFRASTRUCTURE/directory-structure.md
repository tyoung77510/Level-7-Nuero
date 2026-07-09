# Shared Directory Structure
> **Source:** System prompt, SOP-001, file system inspection

## Top-Level Layout
```
/home/team/shared/
├── README.md                          # Team overview
├── branded-service-packages.md        # Service packages with pricing
├── services.md                        # Full service catalog
├── pricing.md                         # Pricing guide
├── one-pager.md / sales-deck.md       # Sales assets
├── case-study-template.md             # Case study format
├── outreach-templates.md              # Email templates
├── linkedin-content.md                # LinkedIn content strategy
├── target-client-list.md              # Target company list
├── 5-client-acquisition-plan.md       # Sales pipeline plan
│
├── sops/                              # Standard Operating Procedures
│   ├── SOP-001 / 002 / 003            # Core operational SOPs
│   ├── SOP-DP-001/002/003             # Data & Process methodology
│   ├── SOP-PC-001/002/003             # Controls methodology
│   └── SOP-PM-001/002/003             # PM methodology
│
├── infrastructure/                    # Tech & team docs
├── client-work/                       # Client deliverables
├── clients/                           # Client relationship data
├── digital-brain/                     # This knowledge base
├── visuals/                           # Brand graphics
├── site/                              # Website source code
├── outreach-results/                  # Campaign tracking
└── contact-submissions/               # Website inquiries
```

## Client Work Directory Pattern
```
/home/team/shared/client-work/[client-name]/
├── discovery-notes.md, proposal.md, sow.md, project-charter.md
├── communications/ (meeting-notes/, status-reports/)
├── deliverables/ (assessments/, plans/, reports/)
└── closeout.md
```

## Obsidian Cross-References
- [[07-INFRASTRUCTURE/tech-stack.md]] — Systems that power this structure
- [[07-INFRASTRUCTURE/team-roles.md]] — Who owns which directories
- [[05-CLIENT/onboarding.md]] — Client directory setup process
- [[05-CLIENT/relationship-management.md]] — Client database structure
- [[00-MOC-MASTER.md]] — How to navigate everything

> **Tip:** Use `find /home/team/shared -type f | sort` to explore the full file system.