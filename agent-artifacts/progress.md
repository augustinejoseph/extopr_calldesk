# Progress — 17 November 2026

## Implemented

- Isolated `extopr-calldesk` Next.js application for Vercel / Neon.
- Password authentication, signed HTTP-only sessions, login rate limits, same-origin mutation checks, server-side role/ownership validation.
- Manager and caller workspaces, student detail/history, search/status/follow-up filtering.
- Individual/bulk assignment, persistent single ownership, unassigned pool, preserved assignment history.
- Dialer links, append-only outcomes/notes, DNC warning and blocked dialing, manager-only lifting.
- Scheduling, overdue reminders, one-minute/window-focus refresh, completion, ownership-derived follow-up responsibility.
- Caller creation, deactivation with student release, restoration without reclaiming.
- Spreadsheet/CSV mapping and preview, atomic import, original field preservation, manual phone-match review, separate-student or source-link decisions.
- Responsive central stylesheet and design tokens, PWA manifest/service worker, keyboard dialog controls.

## Verification

- Five domain policy tests passed.
- Next.js production build passed, including after upgrading to patched Next.js 16.4.6.
- Dependency audit: zero known vulnerabilities after upgrade.
- Synthetic API integration test against an isolated PostgreSQL 17 database passed: three callers, cross-caller isolation, bulk assignment, reassignment with history and follow-up transfer, DNC authorization, follow-up completion, deactivation/access revocation/release, restoration, duplicate keep-separate, invalid batch rollback.
- Expanded duplicate source-link scenario passed; existing student count and historical call attribution were preserved. Final policy test rerun and production rebuild passed.

## External setup / business work remaining

- Supply real Neon and session environment variables; bootstrap the manager using README instructions.
- Deploy to Vercel. No cloud resources were created or changed.
- Approve provisional policies in plan.md after reviewing anonymized Excel samples.
- Desktop and emulated mobile browser checks passed in the route/dropdown update below. Installed-PWA and dialer tests on actual team phones remain.
- Dedicated manager student-detail editing, detailed reporting, account password reset/change, and complex worksheet formats are not implemented.
- PWA requires network; no student information is stored in offline caches.

## Route, overview, and dropdown update

### Delivered

- Added real Next.js routes: `/login`, `/overview`, `/students`, `/students/[id]`, `/unassigned`, `/follow-ups`, `/team`, `/imports`, `/duplicates`. `/` redirects to `/students`.
- Replaced state-only navigation with Next.js links and URL-backed navigation. Student details support direct URLs, refresh, and browser Back.
- Added server authentication and manager route checks; missing, malformed, or unauthorized student detail URLs return 404.
- Moved all summary cards to Overview and added the current call-status breakdown there. Operational screens no longer repeat cards above the work area. Overdue reminders appear on Overview and Follow-ups.
- Added a shared custom dropdown for status/date filters, assignment, import mapping, and call outcomes. It supports keyboard/type-ahead selection, disabled options, form submission/reset, required fields, outside dismissal and responsive portaled menus.
- Updated module map, implementation plan, README, and central design direction. All dropdown styles remain in `app/globals.css`.

### Verified

- Production build passed with all new routes; all five domain tests passed.
- Headless Chrome: login redirect, filters, assignment form value, keyboard navigation, Overview-only cards, seven status rows, browser Back, student detail refresh, dropdown Escape without closing the drawer, required import mappings, 390px mobile menu bounds, and caller route restrictions. No browser runtime errors observed.
- HTTP checks: all seven workspace routes return successfully for managers; all four manager-only routes redirect callers; unauthorized and malformed student detail URLs return 404.
- Reviewed desktop Overview and mobile student-list screenshots. Checks used existing sample accounts and did not submit student mutations.
- Remaining verification: installed PWA, real phone dialer, and physical-device accessibility checks. Database mutation integration tests were not rerun for this UI/routing change; existing API behavior remains unchanged.
