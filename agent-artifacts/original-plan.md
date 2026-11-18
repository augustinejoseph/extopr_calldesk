# Extopr CallDesk — Final Project Plan

**Extopr CallDesk** is an internal, mobile-focused PWA for importing student details from client Excel files, managing duplicates, assigning students to telecallers, and tracking calls and follow-ups.

The initial team is **one manager and three telecallers**. Clients will not log in.

## 1. Technology

| Component       | Decision                                |
| --------------- | --------------------------------------- |
| Application     | Next.js PWA                             |
| Hosting         | Vercel                                  |
| Database        | Neon PostgreSQL                         |
| Primary device  | Telecallers’ mobile phones              |
| Calling         | Tap a number to open the phone’s dialer |
| Outcome updates | Manually entered after calling          |
| Reminders       | Inside the PWA                          |

## 2. Roles and permissions

| Capability                          | Manager                        | Telecaller                     |
| ----------------------------------- | ------------------------------ | ------------------------------ |
| View students                       | All students                   | Assigned students only         |
| Filter students                     | Call status and follow-up date | Call status and follow-up date |
| View student notes and call history | All students                   | Assigned students              |
| Assign and reassign students        | Yes, individually or in bulk   | No                             |
| Record outcomes and notes           | Permission to finalize         | Yes                            |
| Edit student details                | Permission to finalize         | No                             |
| Create telecaller accounts          | Yes                            | No                             |
| Soft-delete and restore telecallers | Yes                            | No                             |
| View calling progress               | Across the team                | Own assigned students          |

All previous notes are visible to every user who has access to that student, including notes from previous telecallers.

## 3. Core workflow

1. Import student details from client Excel files.
2. Parse and store the data, handling duplicates according to rules still to be defined.
3. The manager filters and selects students individually or in bulk.
4. The manager assigns the selected students to a telecaller.
5. The telecaller reviews each student’s previous notes and calling history.
6. The telecaller taps the number to open the phone’s dialer.
7. After calling, they return to the PWA and update the outcome, add notes, and schedule a follow-up if needed.
8. The manager reviews assignments and calling progress.

**200 students per day is an example allocation, not a fixed limit.**

## 4. Assignment rules

- A student can have **only one active telecaller assignment**.
- Ownership continues across days until explicitly changed by the manager.
- Unfinished students remain with their assigned telecaller.
- New allocations add to existing work.
- Reassignment preserves all notes, call attempts, outcomes, and follow-ups.
- Historical activities retain their original author.
- Pending follow-up responsibility transfers to the new telecaller.
- Unassigned students are available in the manager’s unassigned pool.

## 5. Call statuses

| Status                                   | Meaning                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Pending / Not connected**              | Not called yet, or the call did not connect because of no answer, a busy number, or an unreachable/switched-off phone |
| **Wrong / invalid number**               | The number is incorrect or unusable                                                                                   |
| **Interested**                           | The student expressed interest                                                                                        |
| **Not interested**                       | The student declined                                                                                                  |
| **Follow-up scheduled**                  | Another call is scheduled for a date and time                                                                         |
| **Already contacted — assignment issue** | Someone else already called, and the assignment appears mistaken                                                      |
| **Do not call**                          | The student should not be called again                                                                                |

“Not called,” “No answer,” “Busy,” and “Unreachable / switched off” are combined into **Pending / Not connected**.

Each call attempt is recorded separately, so the history distinguishes students who have never been called from students with unsuccessful attempts. Updating the latest status does not erase earlier activity.

**Already contacted — assignment issue** flags the student for manager review without automatically merging records or removing ownership.

### Do not call behavior

- Keep the number visible.
- Disable tap-to-dial.
- Display **DO NOT DIAL** in red.
- Show the reason in the notes.
- Preserve the complete history.

Who can remove this restriction remains to be decided.

## 6. Student notes and history

Each student’s detail screen shows:

- Previous notes, with author and timestamp.
- Call attempts and outcomes.
- Scheduled and completed follow-ups.
- Assignment and reassignment history.

History remains available when a student is reassigned, returns to the unassigned pool, or their previous telecaller is soft-deleted.

Telecallers can record outcomes and add notes. They cannot edit student details.

## 7. Follow-ups and reminders

A follow-up includes:

- Date and time.
- Notes explaining the next action.
- Responsible telecaller.
- Completion state.
- In-PWA reminder.

Follow-ups stay attached to the student. Responsibility remains with the current owner and transfers on reassignment.

Phone push notifications are outside the currently agreed scope.

## 8. Telecaller account management

Managers can create, soft-delete, and restore telecaller accounts.

| Action               | Behavior                                                        |
| -------------------- | --------------------------------------------------------------- |
| Soft-delete          | Retain the database record and prevent login or new assignments |
| Release assignments  | Move the telecaller’s students to the unassigned pool           |
| Preserve history     | Retain all notes, calls, outcomes, and pending follow-ups       |
| Preserve attribution | Continue displaying the original author on historical activity  |
| Restore              | Re-enable the account for access and new assignments            |

Restoring an account does not automatically return former students. They remain unassigned or with their new owner.

A field such as `deletedAt` will represent soft deletion.

## 9. Application screens

| Screen               | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| Login                | Authenticate users                                               |
| Manager workspace    | View all students, filter, assign, reassign, and review progress |
| Unassigned pool      | Allocate students without an active owner                        |
| Telecaller workspace | View and filter assigned students                                |
| Student details      | Review student information, notes, calls, and follow-ups         |
| Call update form     | Record outcomes, notes, and follow-ups                           |
| Follow-up view       | Show upcoming and overdue follow-ups with reminders              |
| User management      | Create, soft-delete, and restore telecallers                     |
| Import workspace     | Upload and process Excel files; details pending                  |
| Duplicate review     | Review potential duplicates; rules pending                       |

## 10. Proposed database structure

| Entity            | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| Users             | Accounts, roles, and soft-deletion state               |
| Students          | Student details and current call status                |
| Assignments       | Current ownership and assignment history               |
| Call attempts     | Student, caller, timestamp, and outcome                |
| Student notes     | Notes linked to the student, author, and relevant call |
| Follow-ups        | Schedule, responsible caller, and completion state     |
| Import batches    | Uploaded file metadata and processing results          |
| Source records    | Original imported information and its source           |
| Duplicate reviews | Suspected duplicates and resolution decisions          |

Exact student fields and import relationships depend on the Excel requirements discussion.

## 11. Excel imports — work in progress

The system must support different client Excel formats. The following will be defined after reviewing anonymized samples:

- File formats, worksheets, and table layouts.
- Required student fields and column mapping.
- Data normalization.
- Missing, invalid, or incomplete records.
- Import previews and error handling.
- Re-uploading the same file.
- Expected file sizes and record volumes.
- Client and source tracking.

## 12. Duplicate management — work in progress

The following rules remain open:

- What identifies the same student.
- Handling shared family phone numbers.
- Matching by phone, email, another ID, or a combination.
- Resolving conflicting details.
- Preserving multiple client associations.
- Manual review versus automatic resolution.
- Preserving assignments, notes, calls, and follow-ups during merges.

## 13. Reporting — work in progress

Managers will see current call statuses and student progress. Detailed metrics, dashboards, charts, exports, and performance reports will be discussed later.

## 14. Delivery phases

| Phase                                   | Deliverable                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| **1. Requirements and screen flows**    | Finalize remaining permissions, Excel rules, duplicate rules, and mobile workflows         |
| **2. Foundation**                       | Next.js PWA, Neon database, login, roles, and account management                           |
| **3. Assignment and calling**           | Student lists, filters, bulk assignment, reassignment, dialer links, outcomes, and history |
| **4. Follow-ups and account lifecycle** | Scheduling, in-PWA reminders, soft deletion, restoration, and unassigned pool              |
| **5. Imports and duplicates**           | Implement the separately agreed parsing and duplicate rules                                |
| **6. Pilot and deployment**             | Validate with one manager and three telecallers; deploy on Vercel and Neon                 |
| **Later: Reporting**                    | Implement reports after requirements are agreed                                            |

## 15. Release acceptance criteria

The initial release must verify that:

- Telecallers can access only assigned students.
- Managers can assign individually and in bulk.
- Students cannot have multiple active telecaller owners.
- Ownership persists across days.
- Reassignment preserves history and transfers pending follow-ups.
- Previous notes are visible to authorized users.
- Tap-to-dial opens the phone’s dialer.
- **Do not call** keeps the number visible, disables dialing, and displays the red warning.
- The combined **Pending / Not connected** status supports both uncalled students and unsuccessful attempts.
- New outcomes do not overwrite historical attempts.
- Follow-ups appear with in-PWA reminders.
- Soft deletion blocks account access and releases assignments without losing history.
- Account restoration does not reclaim former assignments.
- Imports and duplicate resolution follow the rules agreed during requirements work.

**Remaining decisions:** Excel parsing, duplicate handling, authentication method, manager editing permissions, who can remove “Do not call,” and reminder timing. Reporting remains deferred; delivery dates and costs are not yet estimated.
