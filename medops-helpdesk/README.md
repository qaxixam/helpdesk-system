# MedOps Helpdesk

Full-stack IT helpdesk for clinics. Requesters raise tickets, agents work them, admins assign work and watch SLA performance.

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS v4 · MongoDB Atlas + Mongoose · Auth.js (credentials, JWT) · Zod · Nodemailer (Gmail SMTP) · Cloudinary · Recharts — all on free plans.

## Getting started

```bash
npm install
cp .env.example .env        # fill in MongoDB, AUTH_SECRET, SMTP, Cloudinary, CRON_SECRET
npm run seed                # 1 admin, 2 agents, 3 users, 4 categories, 15 tickets
npm run dev
```

Seeded accounts (password `Password123!` for all):

| Role | Email |
|---|---|
| Admin | admin@medops.com |
| Agent | elena.agent@medops.com, devon.agent@medops.com |
| User | sarah.jenkins@stjudeclinic.org, rachel.adams@metrohealth.org, liam.oconnor@bayviewdiagnostics.org |

## Security model

- Every API route calls `requireAuth()` which verifies the JWT **and reloads the user from MongoDB**, so deactivated accounts and role changes take effect immediately.
- Ticket access is centralised in `src/lib/ticket-access.ts`: users see only tickets they created, agents only tickets assigned to them, admins everything. Other people's tickets return `404`.
- Internal notes are filtered out server-side for requesters (messages and activity log).
- All input is validated with the same Zod schemas on client and server (`src/lib/validations.ts`).
- Attachments must be Cloudinary URLs uploaded through `/api/upload` (type + 4 MB size limit).
- Email content is HTML-escaped. Regex search input is escaped.
- `src/proxy.ts` guards pages by role; the API checks are the real enforcement.

## SLA & lifecycle

| Priority | First response | Resolution |
|---|---|---|
| Urgent | 1h | 8h |
| High | 4h | 24h |
| Medium | 8h | 48h |
| Low | 24h | 72h |

- Deadlines are set on creation and recalculated from the creation time if priority changes.
- The first public staff reply sets `firstRespondedAt`; resolving sets `resolvedAt`.
- `syncSLAsAndAutoClose()` marks tickets **SLA Breached** when either deadline passes, and **auto-closes** tickets that have been `Resolved` for 3 days with no requester reply (a requester reply reopens the ticket to In Progress).
- It runs from Vercel Cron daily (`vercel.json`, protected by `CRON_SECRET`), from the admin "Run SLA check" button, and lazily (at most once a minute) on dashboard / list requests, so breaches show up promptly on the free Hobby plan.
- Ticket numbers (`TKT-0001`) come from an atomic counter (`src/models/Counter.ts`), so concurrent requests can't collide.

## Deploying to Vercel

Set every variable from `.env.example` in the Vercel project. Leave `AUTH_URL` / `NEXTAUTH_URL` unset in production so Auth.js uses the deployed host.
