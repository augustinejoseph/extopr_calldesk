# Implementation plan

Source of truth: original-plan.md. This folder is the durable record for future agents.

1. Foundation: isolated Next.js project, PostgreSQL schema, password login, signed HTTP-only cookie, server role checks.
2. Workspaces: mobile navigation, student search/status/date filters, assignment and unassigned pool.
3. Calls: dialer link, append-only attempts/notes, DNC restriction, full authorized history.
4. Follow-ups: future scheduling, overdue in-app reminder, completion, ownership-derived responsibility.
5. Team: create, soft-delete/release, restore without reclaiming.
6. Imports: mapped worksheet preview, transactional validation, source tracking and explicit phone duplicate review.
7. Verification: policy tests, production build, database pilot, Vercel/Neon configuration.

## Provisional decisions requiring business confirmation

- Password-based authentication with 24-hour sessions; 10 attempts per email per 15-minute interval.
- Managers may record outcomes and lift DNC; student detail editing remains unavailable.
- India-default normalization for ten-digit numbers. Explicit country codes elsewhere.
- Exact normalized phone means potential duplicate; never auto-merge. Shared numbers may remain separate.
- First worksheet/header-row files only, 1,000 rows and 5 MB per import. Complex layouts remain pending sample review.
- Reminder is overdue when due_at passes; shown on load, window focus, and a one-minute workspace refresh. No push notifications.
- Detailed reporting and exports remain deferred.

## Pilot checklist

Use one manager and three callers. Verify cross-caller API isolation, assignment under concurrent requests, deactivation racing assignment, persistent ownership, full history attribution, follow-up transfer/unassignment, DNC restriction, shared-phone review, reuploads, invalid batch rollback, and real-device PWA installation/dialer behavior. Obtain approval for the provisional policies before production.

## Workspace routing and layout revision

- `/` redirects to `/students`; `/login` handles sign-in and redirects authenticated users to students.
- Each workspace has its own route: `/overview`, `/students`, `/unassigned`, `/follow-ups`, `/team`, `/imports`, `/duplicates`.
- `/students/[id]` opens a directly addressable student detail drawer, preserving existing call/history workflows. Closing returns to `/students`.
- Workspace routes require a current active account. Unassigned, team, imports, and duplicate review require a manager. Unauthorized or nonexistent student detail URLs return 404.
- Overview exclusively contains summary cards and the current status breakdown. Student, import, team, duplicate, and unassigned pages prioritize their work area. Overdue reminders appear on Overview and Follow-ups.
- All select interactions use the shared custom Dropdown: keyboard navigation, type-ahead, required-field validation, form reset/submission, disabled choices, outside click, and Escape dismissal. No new component dependency.
