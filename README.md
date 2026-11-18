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

Files are parsed in the browser: first worksheet, headers in row 1, up to 100,000 rows and 20 MB. XLSX, XLS and CSV are supported. Managers map required student name / phone and optional email, course, district, sub district, father name, gender, community, group, address, pincode and school name. Suggested mappings remain editable. Unmapped columns are stored in `extra_fields`; original rows are retained in `source_records`. Numeric Excel phone values are read as numbers rather than scientific display strings.

Only row data is uploaded, in requests of up to 200 rows (also bounded by payload size). Each chunk uses bulk SQL inserts in a transaction. Valid rows are committed; invalid rows are skipped with worksheet row numbers and reasons. Ten-digit numbers receive India’s country code. Normalized-phone matches, including matches within the same chunk, are saved for manual review without overwriting existing students. A manager can link the incoming source or create a separate student with all imported fields.

Import history shows uploader, time, mapping, status, processed rows, created students, records sent to review and errors, with downloadable JSON error reports. Retrying in the same tab continues the import; chunk retries are idempotent. After a tab reload, delete the incomplete import before reuploading. Imports are serialized with duplicate decisions and deletion to preserve consistency.

Managers can permanently delete an import by typing its filename. Students created by that import, their activities and follow-ups, and the import’s source records, reviews and chunk results are deleted transactionally. Existing students remain. Other imports’ source data is retained; if their matching student is deleted, linked incoming records return to review. Legacy imports remain visible but cannot be deleted because their creation provenance is unknown.

Apply the additive schema migration to an existing installation with `node --env-file=.env.local scripts/migrate.mjs`. It preserves existing records and does not require bootstrap manager credentials. `npm test` runs policy/import validation tests. An opt-in database integration test creates and drops its own temporary database on a local PostgreSQL server:

```sh
IMPORT_TEST_DATABASE_URL=postgres://localhost/postgres node --test tests/import-db.test.mjs
```

Optionally set `IMPORT_TEST_FILE` to an XLSX path to test all of its rows through the bulk API against that temporary database. The test stubs authentication; live browser acceptance remains separate.

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
