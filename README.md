# Extopr CallDesk

Mobile-first internal Next.js PWA for student calling. Requires Node 20.19+ and PostgreSQL (Neon recommended). No demo identities or browser-local student storage.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and supply a Neon connection string, random session secret (32+ characters), manager email and a unique password (12+ characters).
3. `node --env-file=.env.local scripts/setup.mjs` creates tables and the initial manager. Existing users are preserved.
4. `npm run dev` then open http://localhost:3000 and sign in.
5. Create telecallers in Team, import a spreadsheet, and assign students.

`npm test` checks domain policies. `npm run build` validates the production bundle.

## Design

All colors, fonts, spacing direction, radii, and common component styles live in `app/globals.css`; the `:root` block is the central theme. Read `agent-artifacts/design-direction.md` before changing the visual language.

## Deploy to Vercel / Neon

Import this directory as the Vercel project root. Set DATABASE_URL and SESSION_SECRET in Vercel. Run database setup once against the chosen database from a trusted terminal; bootstrap manager credentials are not needed in Vercel. Require HTTPS. Next.js detects its build settings automatically. No external deployment has been performed.

The service worker enables the PWA lifecycle but deliberately does not cache personal data. An online connection is required. Reminders appear in the workspace on load, window focus, and every minute while signed in, rather than operating-system notifications.

## Import policy

First worksheet, header row, 1–1000 records, 5 MB maximum client-side. Map name and phone (required), email and course (optional); provide a client label. All rows validate in a transaction. Ten-digit phone numbers receive India’s country code; provide country codes for other regions. Exact normalized-phone matches go to manual review. Review links the source to an existing student without changing their details, or creates a separate student. Original worksheet fields and mapped records remain in source_records. Reuploads intentionally enter manual review rather than silently overwriting data.

Manager student-detail editing is not yet exposed. Managers can record outcomes and lift DNC; callers cannot. Follow-up times use the device timezone for entry and UTC for storage. Pending follow-up responsibility derives from current student ownership. Deactivated users are checked on every request; restoration never reclaims students.

See `agent-artifacts/` for scope, modules, design, progress, and open decisions. Pilot and live database acceptance checks are still required before use with real student data.

## Workspace routes

- `/login`: sign in; `/` redirects to `/students`.
- `/overview`: dedicated summary cards and call-status breakdown.
- `/students`: searchable work list, filters and assignment actions.
- `/students/[id]`: shareable student detail drawer with outcome form and history.
- `/unassigned`: manager allocation pool.
- `/follow-ups`: pending follow-ups, overdue reminders and completion.
- `/team`: manager account lifecycle controls.
- `/imports`: manager spreadsheet upload, column mapping and preview.
- `/duplicates`: manager duplicate/source review.

Navigation is defined in `lib/navigation.mjs`. The shared `components/dropdown.js` replaces native selects throughout; its appearance is centralized in `app/globals.css`. Restricted pages and student deep links enforce access on the server.
