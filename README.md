## Document Control built on Git

git4docs is the open-source engine behind improvia - a compliance document management SaaS for ISO, FDA, and SOX-regulated companies. The core is here, open and inspectable. improvia adds hosting, teams, billing, and an AI layer on top.

**Your audit trail is already built.** Every commit is a timestamped, 
author-attributed record of exactly what changed. Not a log field in a 
database someone could edit. An immutable chain baked into the repo. 
An auditor asks who approved revision 4 of your SOP - you show them 
the commit.

**Cryptographic proof of content.** Every document has a blob hash. 
Same bytes in, same hash out, every time, on any machine. When you 
approve a document you're approving a specific hash. You can prove 
years later it hasn't changed.

**Approval workflows that make structural sense.** A document under 
review is a branch. Approval is a merge. Any change resets the review. 
This isn't bolted on - it's how Git already works.

**The system governs itself.** The document that defines who approves 
what lives in the same repo and goes through the same approval workflow. 
No separate admin panel with settings nobody audits.

**No vendor lock-in, ever.** Your documents are markdown files in a
Git repo. If you stop using git4docs tomorrow, everything goes with you.

---

## Want the hosted version?

improvia.app - git4docs with hosting, teams, and AI. Free tier available.

---
## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md)

## Setup

### Prerequisites

- Node.js 18+
- npm

### Quick Start

```bash
git clone https://github.com/Denchworth/git4docs.git
cd git4docs

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Start development server
npm run dev
```

Open `http://localhost:3001` and create your first account at `/signup`.

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `DATABASE_PATH` | SQLite database path | `./data/git4docs.db` |
| `STORAGE_PATH` | Git repository storage | `./storage/companies` |
| `JWT_SECRET` | JWT signing secret | auto-generated |

### Tech Stack

- **Backend:** Node.js, Express, TypeScript, SQLite, isomorphic-git
- **Frontend:** React, Vite, Tailwind CSS, TipTap editor
- **Storage:** Git repositories (one per tenant), SQLite for metadata

### What's Included

- Document library with categories (Policy, SOP, Work Instruction, Form)
- Full version history on every document
- Review and approval workflows
- Redline comparison between any two versions
- Role-based access — viewers, editors, approvers
- Governance documents that configure the system from inside the system
- Acknowledgment tracking for approved changes
- Configurable revision numbering (letters, numbers, padded)
- Multi-tenant — each organization gets its own Git repo

### License

AGPL-3.0 — see [LICENSE](LICENSE)
