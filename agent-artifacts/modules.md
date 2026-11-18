# Module map

| Module                | Location                                  | Responsibility                                                                                             |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Application workspace | components/workspace.js                   | Routed views, login, student detail drawer, assignments, follow-ups, team, imports and duplicate decisions |
| Central design        | app/globals.css                           | Theme tokens, shared components, responsive layouts                                                        |
| Authentication        | lib/auth.mjs, app/api/auth/route.js       | Password hashing, signed sessions, login throttle, origin checks                                           |
| Domain rules          | lib/policy.mjs                            | Access scope, statuses, DNC, scheduling, phone normalization                                               |
| Persistence           | lib/db.mjs                                | Lazy PostgreSQL connection suitable for Neon                                                               |
| Workspace API         | app/api/workspace/route.js                | Scoped reads and transactional mutations with manager gates                                                |
| Database bootstrap    | scripts/schema.sql, scripts/setup.mjs     | Tables, indexes, initial manager                                                                           |
| PWA                   | public/manifest.webmanifest, public/sw.js | Install metadata and no-sensitive-cache service worker                                                     |
| Checks                | tests/policy.test.mjs                     | Authorization, DNC, scheduling, status and normalization tests                                             |

Current ownership is a single students.owner_id foreign key; activities store assignment history and original author. Follow-ups reference students rather than copying owner identity, preventing stale responsibility after reassignment. Notes and call outcomes live together in append-only activity rows. Source records retain mapped imported data; duplicate decisions never merge existing history or replace details.

## Route and shared control modules

| Module              | Location                                             | Responsibility                                                                                           |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Entry and login     | app/page.js, app/login/page.js                       | Students landing redirect and dedicated sign-in                                                          |
| Authenticated pages | app/(workspace)/layout.js, app/(workspace)/*/page.js | Explicit URLs and server authentication                                                                  |
| Page access         | lib/workspace-page.js                                | Server manager checks for restricted pages                                                               |
| Navigation          | lib/navigation.mjs                                   | Central route labels, URLs, icons, manager-only visibility                                               |
| Student deep links  | app/(workspace)/students/[id]/page.js                | UUID validation, ownership check, 404 on missing/unauthorized students                                   |
| Custom dropdown     | components/dropdown.js                               | Shared combobox/listbox, keyboard and pointer input, form values and required validation, portaled menus |

Overview is the only screen with summary cards and the status breakdown. Existing workspace API permissions remain authoritative for data reads and mutations.
