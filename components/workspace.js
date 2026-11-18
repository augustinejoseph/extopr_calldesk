"use client";
import { useEffect, useRef, useState } from "react";
import WorkspaceShimmer, { LayoutShimmer } from "./shimmer";
import { statuses } from "../lib/policy.mjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workspaceQuery } from "../lib/workspace-request.mjs";
import { workspacePages } from "../lib/navigation.mjs";
import Dropdown from "./dropdown";
import ImportStudents from "./import-students";
import { importFields } from "../lib/import.mjs";
function Pagination({ value, onChange }) {
  if (!value || value.total <= value.limit) return null;
  return (
    <div className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="secondary"
        disabled={value.page <= 1}
        onClick={() => onChange(value.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {value.page} of {Math.max(1, Math.ceil(value.total / value.limit))}{" "}
        · {value.total} records
      </span>
      <button
        type="button"
        className="secondary"
        disabled={value.page * value.limit >= value.total}
        onClick={() => onChange(value.page + 1)}
      >
        Next
      </button>
    </div>
  );
}
const initials = (n) =>
  n
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
const date = (d) =>
  new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const emptyWorkspace = (user) => ({
  user,
  students: [],
  users: [],
  followups: [],
  activities: [],
  duplicates: [],
  stats: {
    total: 0,
    interested: 0,
    unassigned: 0,
    pending: 0,
    overdue: 0,
    calls: 0,
    statuses: {},
  },
  pagination: { page: 1, limit: 50, total: 0 },
});
export default function Workspace({
  page,
  studentId = null,
  initialUser = null,
}) {
  const router = useRouter();
  const loadVersion = useRef(0);
  const lastLoaded = useRef(0);
  const listDirty = useRef(false);
  const loadedProfile = useRef(null);
  const [data, setData] = useState(
      initialUser && !workspaceQuery(page, { studentId })
        ? emptyWorkspace(initialUser)
        : null,
    ),
    [ready, setReady] = useState(!workspaceQuery(page, { studentId })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pageNumber, setPageNumber] = useState(1),
    [historyPage, setHistoryPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [follow, setFollow] = useState(""),
    [selected, setSelected] = useState([]),
    [notice, setNotice] = useState("");
  const [detail, updateDetail] = useState(studentId);
  const [basicStudent, setBasicStudent] = useState(null);
  const [more, setMore] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const setDetail = (id) => {
    setBasicStudent(data?.students.find((s) => s.id === id) || null);
    setProfileError("");
    updateDetail(id);
    setMore(false);
    setProfile(null);
    window.history.pushState(null, "", id ? `/students/${id}` : "/students");
  };
  useEffect(() => {
    const back = () => {
      updateDetail(
        window.location.pathname.match(/^\/students\/([^/]+)$/)?.[1] || null,
      );
      setMore(false);
      setBasicStudent(null);
      setProfile(null);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    if (!detail || (!more && basicStudent?.id === detail)) return;
    const key = `${detail}:${historyPage}:${profileVersion}`;
    if (
      more &&
      profile?.student?.id === detail &&
      loadedProfile.current === key
    )
      return;
    const controller = new AbortController();
    setProfile(null);
    setProfileError("");
    fetch(
      `/api/workspace?student=${detail}&more=${more ? "1" : "0"}&historyPage=${historyPage}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!controller.signal.aborted) {
          if (more) {
            setProfile(d);
            loadedProfile.current = key;
          } else setBasicStudent(d.student);
          if (!d.student) setProfileError("Student not found or access denied");
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setProfileError(e.message);
      });
    return () => controller.abort();
  }, [detail, more, historyPage, basicStudent?.id, profileVersion]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement;
    const menu = document.getElementById("workspace-navigation");
    menu?.querySelector("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
      if (e.key !== "Tab") return;
      const items = [...menu.querySelectorAll("button,a[href]")];
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [menuOpen]);
  const setPage = (label) =>
    router.push(
      workspacePages.find((p) => p.label === label)?.href || "/students",
    );
  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement;
    const dialog = document.querySelector("[role=dialog]");
    function keys(e) {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !e.target.closest('[role="combobox"][aria-expanded="true"]')
      )
        setDetail(null);
      if (e.key === "Tab" && dialog) {
        const items = [
          ...dialog.querySelectorAll(
            'summary,button:not(:disabled),a[href],input:not(:disabled):not([tabindex="-1"]),textarea:not(:disabled)',
          ),
        ];
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keys);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [detail, ready]);
  async function load(signal) {
    const query = workspaceQuery(page, {
      pageNumber,
      search,
      status,
      follow,
      studentId: studentId && detail,
    });
    if (!query) {
      setReady(true);
      return;
    }
    const version = ++loadVersion.current;
    setReady(false);

    try {
      const r = await fetch(`/api/workspace?${query}`, { signal });
      const d = await r.json();
      if (version !== loadVersion.current || signal?.aborted) return;
      if (r.ok) {
        const last = Math.max(
          1,
          Math.ceil(d.pagination.total / d.pagination.limit),
        );
        if (pageNumber > last) setPageNumber(last);
        setData(d);
        lastLoaded.current = Date.now();
      } else if (r.status === 401) {
        setData(null);
        if (page !== "Login") router.replace("/login");
      } else setError(d.error);
    } finally {
      if (version === loadVersion.current && !signal?.aborted) setReady(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        load(controller.signal).catch((e) => {
          if (e.name === "AbortError") return;
          setError("Unable to connect");
          setReady(true);
        }),
      search ? 200 : 0,
    );
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearTimeout(timer);
      controller.abort();
      loadVersion.current++;
    };
  }, [page, pageNumber, search, status, follow, !!(studentId && detail)]);
  useEffect(() => {
    if (!data?.user?.id || detail || !workspaceQuery(page)) return;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoaded.current >= 60000
      )
        load().catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [data?.user?.id, page, pageNumber, search, status, follow, detail]);
  useEffect(() => {
    setSelected([]);
    setNotice("");
    setError("");
    setSearch("");
    setStatus("");
    setFollow("");
  }, [page]);
  useEffect(() => {
    setPageNumber(1);
    setSelected([]);
  }, [page]);
  useEffect(() => {
    if (!detail && listDirty.current && !studentId) {
      listDirty.current = false;
      load().catch(() => setError("Unable to refresh students"));
    }
  }, [detail]);
  useEffect(() => {
    setHistoryPage(1);
  }, [detail]);
  useEffect(() => {
    setSelected([]);
  }, [pageNumber]);
  async function action(payload) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      if (payload.action !== "outcome") await load();
      if (payload.action === "outcome") {
        listDirty.current = true;
        setData((d) => ({
          ...d,
          students: d.students.map((s) =>
            s.id === payload.id
              ? { ...s, status: payload.status, notes: payload.note }
              : s,
          ),
        }));
        setBasicStudent(
          (s) => s && { ...s, status: payload.status, notes: payload.note },
        );
        setProfileVersion((v) => v + 1);
      }
      setNotice("Changes saved");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.replace("/students");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data && !ready) return <WorkspaceShimmer page={page} />;
  if (!data)
    return (
      <main className="login">
        <div className="login-card">
          <div className="brand">
            E<span>Extopr / CallDesk</span>
          </div>
          <p className="eyebrow">A LITTLE CONNECTION GOES A LONG WAY</p>
          <h1>
            Good conversations.
            <br />
            Better beginnings.
          </h1>
          <p className="muted">Sign in to your student calling workspace.</p>
          <form onSubmit={login}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <button disabled={busy}>
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>Internal workspace · Authorized team members only</small>
        </div>
      </main>
    );
  const manager = data.user.role === "manager",
    active = data.users.filter((u) => u.role === "telecaller" && !u.deleted_at),
    pending = data.followups.filter((f) => !f.completed_at),
    student =
      profile?.student?.id === detail
        ? profile.student
        : basicStudent?.id === detail
          ? basicStudent
          : null;
  const visible = data.students;
  const heading =
    page === "Students"
      ? manager
        ? "Student workspace"
        : "My students"
      : page;
  return (
    <div className="shell">
      {menuOpen && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside id="workspace-navigation" className={menuOpen ? "menu-open" : ""}>
        <button
          className="menu-close secondary"
          onClick={() => setMenuOpen(false)}
        >
          Close ×
        </button>
        <div className="brand">
          E
          <span>
            Extopr<small>CALLDESK</small>
          </span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {workspacePages
            .filter((p) => !p.managerOnly || manager)
            .map((p) => (
              <Link
                key={p.href}
                onClick={() => setMenuOpen(false)}
                aria-label={p.label}
                href={p.href}
                className={page === p.label ? "nav active" : "nav"}
                aria-current={page === p.label ? "page" : undefined}
              >
                <span aria-hidden="true">{p.icon}</span>
                {p.label}
                {p.label === "Duplicate review" && data.duplicateTotal > 0 && (
                  <b>{data.duplicateTotal}</b>
                )}
              </Link>
            ))}
        </nav>
        <div className="aside-bottom">
          <div className="live-dot">Workspace connected</div>
          <div className="profile">
            <i>{initials(data.user.name)}</i>
            <span>
              {data.user.name}
              <small>{manager ? "Manager" : "Telecaller"}</small>
            </span>
            <button
              aria-label="Sign out"
              className="ghost"
              onClick={async () => {
                await fetch("/api/auth", { method: "DELETE" });
                setData(null);
                router.replace("/login");
                router.refresh();
              }}
            >
              ↪
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <button
            className="menu-toggle secondary"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <span>
            Workspace <span className="muted">/ {page}</span>
          </span>
          <span className="header-right">
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            <span className="avatar">{initials(data.user.name)}</span>
          </span>
        </header>
        <main className="content">
          <div className="title-row">
            <div>
              <p className="eyebrow">
                {manager
                  ? "A CLEAR VIEW. A BETTER NEXT STEP."
                  : "ONE CONVERSATION AT A TIME."}
              </p>
              <h1>
                {heading}
                <span className="title-dot">.</span>
              </h1>
              <p className="muted">
                {page === "Students"
                  ? "Every student, every conversation, all in one place."
                  : page === "Unassigned pool"
                    ? "Give every student a next point of contact."
                    : page === "Follow-ups"
                      ? "A little follow-through makes all the difference."
                      : "Keep your calling workspace moving."}
              </p>
            </div>
            {manager && (
              <button onClick={() => setPage("Import students")}>
                ＋ Import students
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error banner">
              {error}
              <button className="ghost" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="success">
              ✓ {notice}
            </p>
          )}
          {["Overview", "Follow-ups"].includes(page) &&
            data.stats.overdue > 0 && (
              <button
                className="reminder"
                onClick={() => setPage("Follow-ups")}
              >
                ◷ {data.stats.overdue} overdue follow-up
                {data.stats.overdue !== 1 ? "s" : ""} need attention{" "}
                <span>Review follow-ups →</span>
              </button>
            )}
          {page === "Overview" && (
            <>
              <div className="stats">
                {[
                  [
                    "Students in workspace",
                    data.stats.total,
                    "Your connections, in one place",
                  ],
                  [
                    "Interested",
                    data.stats.interested,
                    "Conversations with potential",
                  ],
                  [
                    "Follow-ups pending",
                    data.stats.pending,
                    `${data.stats.overdue} overdue · keep the momentum`,
                  ],
                  [
                    manager ? "Unassigned" : "Call attempts",
                    manager ? data.stats.unassigned : data.stats.calls,
                    manager
                      ? "Ready for a new conversation"
                      : "Recorded on your current students",
                  ],
                ].map(([label, n, sub], i) => (
                  <section key={label}>
                    <div className="stat-label">
                      {label}
                      <span>{["◎", "↗", "◷", "⇄"][i]}</span>
                    </div>
                    <strong>{n.toLocaleString()}</strong>
                    <small>{sub}</small>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Call status breakdown</h2>
                  <Link className="text-button" href="/students">
                    View students →
                  </Link>
                </div>
                <div className="status-summary">
                  {statuses.map((item, index) => {
                    const count = data.stats.statuses[item] || 0;
                    return (
                      <div className="status-summary-row" key={item}>
                        <span className={`badge s${index}`}>{item}</span>
                        <div className="status-track">
                          <div
                            style={{
                              width: `${data.stats.total ? (count / data.stats.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
          {["Students", "Unassigned pool"].includes(page) && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  {page === "Students" ? "All students" : "Unassigned students"}{" "}
                  <span className="count">{data.pagination.total}</span>
                </h2>
                <small className="muted">
                  Ownership stays until reassigned
                </small>
              </div>
              <div className="filters">
                <input
                  aria-label="Search students"
                  placeholder="⌕  Search name, phone, client…"
                  value={search}
                  onChange={(e) => {
                    setPageNumber(1);
                    setSearch(e.target.value);
                  }}
                />
                <Dropdown
                  aria-label="Call status"
                  value={status}
                  onChange={(value) => {
                    setPageNumber(1);
                    setStatus(value);
                  }}
                  options={[
                    { value: "", label: "All call statuses" },
                    ...statuses.map((s) => ({ value: s, label: s })),
                  ]}
                />
                <Dropdown
                  aria-label="Follow-up date"
                  value={follow}
                  onChange={(value) => {
                    setPageNumber(1);
                    setFollow(value);
                  }}
                  options={[
                    { value: "", label: "All follow-up dates" },
                    { value: "today", label: "Due today" },
                    { value: "overdue", label: "Overdue" },
                  ]}
                />
              </div>
              {manager && (
                <form
                  className="bulk"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action({
                        action: "assign",
                        ids: selected,
                        owner: new FormData(e.currentTarget).get("owner"),
                      })
                    )
                      setSelected([]);
                  }}
                >
                  <span>{selected.length} selected</span>
                  <Dropdown
                    name="owner"
                    aria-label="Assign to"
                    options={[
                      { value: "", label: "Unassigned pool" },
                      ...active.map((u) => ({
                        value: u.id,
                        label: u.name,
                      })),
                    ]}
                  />
                  <button disabled={busy || !selected.length}>
                    Assign students →
                  </button>
                </form>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {manager && (
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select all visible students"
                            checked={
                              visible.length > 0 &&
                              visible.every((s) => selected.includes(s.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? visible.map((s) => s.id)
                                  : [],
                              )
                            }
                          />
                        </th>
                      )}
                      <th>STUDENT</th>
                      <th>NOTES</th>
                      <th>CALL STATUS</th>

                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {!ready && (
                      <tr>
                        <td colSpan={manager ? 5 : 4}>
                          <LayoutShimmer page={page} />
                        </td>
                      </tr>
                    )}
                    {(ready ? visible : []).map((s) => {
                      const f = pending.find((f) => f.student_id === s.id);
                      return (
                        <tr key={s.id}>
                          {manager && (
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${s.name}`}
                                checked={selected.includes(s.id)}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? [...selected, s.id]
                                      : selected.filter((id) => id !== s.id),
                                  )
                                }
                              />
                            </td>
                          )}
                          <td>
                            <button
                              className="student-link"
                              onClick={() => setDetail(s.id)}
                            >
                              <i>{initials(s.name)}</i>
                              <span>
                                {s.name}
                                <small>+{s.phone}</small>
                              </span>
                            </button>
                          </td>
                          <td>{s.notes || "—"}</td>
                          <td>
                            <span
                              className={`badge s${statuses.indexOf(s.status)}`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="ghost"
                              aria-label={`Open ${s.name}`}
                              onClick={() => setDetail(s.id)}
                            >
                              ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {ready && !visible.length && (
                  <div className="empty">
                    <span>◎</span>
                    <h3>A fresh start for good conversations</h3>
                    <p>No students match these filters.</p>
                    {manager && (
                      <button onClick={() => setPage("Import students")}>
                        Import student list →
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer>
                {data.pagination.total} students{" "}
                <span>Every conversation counts.</span>
              </footer>
              <Pagination value={data.pagination} onChange={setPageNumber} />
            </section>
          )}
          {page === "Follow-ups" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Upcoming & overdue</h2>
                <span className="count">{data.pagination.total}</span>
              </div>
              {!pending.length && (
                <div className="empty">
                  You’re all caught up. New follow-ups will appear here.
                </div>
              )}
              {pending.map((f) => (
                <div className="follow-card" key={f.id}>
                  <div>
                    <span
                      className={
                        new Date(f.due_at) < new Date() ? "danger" : "eyebrow"
                      }
                    >
                      {date(f.due_at)}
                    </span>
                    <h3>
                      <button
                        className="text-button"
                        onClick={() => setDetail(f.student_id)}
                      >
                        {f.student_name}
                      </button>
                    </h3>
                    <p>{f.note}</p>
                    <small>
                      Responsible:{" "}
                      {f.owner_name || "Unassigned — manager allocation needed"}
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => action({ action: "complete", id: f.id })}
                  >
                    Mark complete
                  </button>
                </div>
              ))}
            </section>
          )}
          {page === "Team" && manager && (
            <div className="two-col">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Your calling team</h2>
                </div>
                {data.users
                  .filter((u) => u.role === "telecaller")
                  .map((u) => (
                    <div className="follow-card" key={u.id}>
                      <div>
                        <h3>{u.name}</h3>
                        <p>{u.email}</p>
                        <small>
                          {u.deleted_at
                            ? "Deactivated"
                            : `${u.assigned_count} assigned students`}
                        </small>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            u.deleted_at ||
                            confirm(
                              `Deactivate ${u.name}? All their students will return to the unassigned pool.`,
                            )
                          )
                            action({
                              action: "account",
                              id: u.id,
                              restore: !!u.deleted_at,
                            });
                        }}
                      >
                        {u.deleted_at ? "Restore" : "Deactivate"}
                      </button>
                    </div>
                  ))}
              </section>
              <form
                className="panel padded"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await action({
                      action: "createUser",
                      ...Object.fromEntries(new FormData(form)),
                    })
                  )
                    form.reset();
                }}
              >
                <h2>Add a telecaller</h2>
                <label>
                  Full name
                  <input name="name" required />
                </label>
                <label>
                  Email
                  <input type="email" name="email" required />
                </label>
                <label>
                  Temporary password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={256}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <small>
                  At least 12 characters. Share securely with your teammate.
                </small>
                <button disabled={busy}>Create account</button>
              </form>
            </div>
          )}
          {page === "Import students" && manager && <ImportStudents />}
          {page === "Duplicate review" && manager && (
            <section className="panel padded">
              <h2>Keep the context. Resolve the overlap.</h2>
              <p className="muted">
                A matching phone can mean the same student or a shared family
                number. Review each record; nothing is merged automatically.
              </p>
              {!data.duplicates.length && (
                <div className="empty">No duplicates waiting for review.</div>
              )}
              {data.duplicates.map((d) => (
                <div className="duplicate" key={d.id}>
                  <div>
                    <small>EXISTING STUDENT</small>
                    <h3>
                      {d.candidate_name || "Original matching student removed"}
                    </h3>
                    <p>
                      {d.candidate_phone
                        ? `+${d.candidate_phone}`
                        : "Keep the incoming record as a separate student."}
                    </p>
                  </div>
                  <div>
                    <small>INCOMING RECORD · {d.raw.client}</small>
                    <h3>{d.raw.name}</h3>
                    <p>
                      {d.raw.email} · {d.raw.course}
                    </p>
                    <details>
                      <summary>Imported details</summary>
                      {Object.entries(importFields)
                        .filter(([k]) => d.raw[k])
                        .map(([k, label]) => (
                          <p key={k}>
                            {label}: {d.raw[k]}
                          </p>
                        ))}
                      {Object.entries(d.raw.extra_fields || {}).map(
                        ([k, v]) => (
                          <p key={k}>
                            {k}: {String(v)}
                          </p>
                        ),
                      )}
                    </details>
                  </div>
                  <div className="actions">
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        action({
                          action: "duplicate",
                          id: d.id,
                          decision: "link",
                        })
                      }
                    >
                      Link source to existing
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        action({
                          action: "duplicate",
                          id: d.id,
                          decision: "keep",
                        })
                      }
                    >
                      Keep separate student
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {["Follow-ups", "Team", "Duplicate review"].includes(page) && (
            <Pagination value={data.pagination} onChange={setPageNumber} />
          )}
          <p className="workspace-footer">
            EXTOPR CALLDESK <span>Built for meaningful connections.</span>
          </p>
        </main>
      </div>
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Student details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close secondary"
              autoFocus
              onClick={() => setDetail(null)}
            >
              Close ×
            </button>
            {!student ? (
              <>
                {profileError ? (
                  <p role="alert">{profileError}</p>
                ) : (
                  <LayoutShimmer detail />
                )}
              </>
            ) : (
              <>
                <p className="eyebrow">STUDENT PROFILE</p>
                <h1>{student.name}</h1>

                <details onToggle={(e) => setMore(e.currentTarget.open)}>
                  <summary>More · full profile & conversation history</summary>
                  {profileError && <p role="alert">{profileError}</p>}
                  {more && !profile && !profileError ? (
                    <LayoutShimmer detail />
                  ) : (
                    <>
                      {Object.entries(importFields)
                        .filter(
                          ([k]) =>
                            !["name", "phone", "email", "course"].includes(k) &&
                            student[k],
                        )
                        .map(([k, label]) => (
                          <p key={k}>
                            {label}: {student[k]}
                          </p>
                        ))}
                      {Object.entries(student.extra_fields || {}).map(
                        ([k, v]) => (
                          <p key={k}>
                            {k}: {String(v)}
                          </p>
                        ),
                      )}
                      {manager && student.created_by_import_id && (
                        <p>Import ID: {student.created_by_import_id}</p>
                      )}
                    </>
                  )}
                </details>
                {student.notes && <p>{student.notes}</p>}
                <span className={`badge s${statuses.indexOf(student.status)}`}>
                  {student.status}
                </span>
                <div className="phone-card">
                  <strong>+{student.phone}</strong>
                  {student.status === "Do not call" ? (
                    <b className="danger">DO NOT DIAL</b>
                  ) : (
                    <a className="button" href={`tel:+${student.phone}`}>
                      ☎ Call student
                    </a>
                  )}
                </div>
                {profile && (
                  <p className="muted">
                    Assigned to {student.owner_name || "unassigned pool"} ·{" "}
                    {student.email || "No email"}
                  </p>
                )}
                <form
                  className="outcome-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fields = Object.fromEntries(new FormData(form));
                    if (
                      await action({
                        action: "outcome",
                        id: student.id,
                        ...fields,
                        due: fields.due
                          ? new Date(fields.due).toISOString()
                          : null,
                      })
                    )
                      form.reset();
                  }}
                >
                  <h2>Record a conversation</h2>
                  <label>
                    Call outcome
                    <Dropdown
                      name="status"
                      aria-label="Call outcome"
                      defaultValue={student.status}
                      options={statuses.map((s) => ({
                        value: s,
                        label: s,
                        disabled:
                          !manager &&
                          student.status === "Do not call" &&
                          s !== "Do not call",
                      }))}
                    />
                  </label>
                  <label>
                    Notes / next action
                    <textarea
                      name="note"
                      maxLength={10000}
                      placeholder="What should the next caller know?"
                      rows={3}
                    />
                  </label>
                  <label>
                    Follow-up date & time
                    <input type="datetime-local" name="due" />
                  </label>
                  <small>
                    Required with next-action notes for a scheduled follow-up.
                  </small>
                  <button disabled={busy}>Save call update</button>
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                </form>
                {more && profile && (
                  <>
                    <h2>Conversation history</h2>
                    <div className="timeline">
                      {profile.activities
                        .filter((a) => a.student_id === student.id)
                        .map((a) => (
                          <article key={a.id}>
                            <small>
                              {a.author} · {date(a.created_at)}
                            </small>
                            <h3>{a.outcome || a.kind}</h3>
                            <p>{a.note || "No additional notes"}</p>
                          </article>
                        ))}
                    </div>
                    <Pagination
                      value={profile.historyPagination}
                      onChange={setHistoryPage}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
