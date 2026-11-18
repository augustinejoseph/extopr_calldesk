"use client";
import { useEffect, useState } from "react";
import { statuses, normalizePhone } from "../lib/policy.mjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workspacePages } from "../lib/navigation.mjs";
import Dropdown from "./dropdown";
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
export default function Workspace({ page, studentId = null }) {
  const router = useRouter();
  const detail = studentId;
  const setDetail = (id) => router.push(id ? `/students/${id}` : "/students");
  const setPage = (label) =>
    router.push(
      workspacePages.find((p) => p.label === label)?.href || "/students",
    );
  const [data, setData] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [follow, setFollow] = useState(""),
    [selected, setSelected] = useState([]),
    [rows, setRows] = useState([]),
    [columns, setColumns] = useState([]),
    [mapping, setMapping] = useState({}),
    [filename, setFilename] = useState(""),
    [notice, setNotice] = useState("");
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
            'button:not(:disabled),a[href],input:not(:disabled):not([tabindex="-1"]),textarea:not(:disabled)',
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
  async function load() {
    const r = await fetch("/api/workspace");
    const d = await r.json();
    if (r.ok) setData(d);
    else if (r.status === 401) {
      setData(null);
      if (page !== "Login") router.replace("/login");
    } else setError(d.error);
    setReady(true);
  }
  useEffect(() => {
    load().catch(() => {
      setError("Unable to connect");
      setReady(true);
    });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!data?.user?.id) return;
    const refresh = () => load().catch(() => {});
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.user?.id]);
  useEffect(() => {
    setSelected([]);
    setNotice("");
    setError("");
    setSearch("");
    setStatus("");
    setFollow("");
  }, [page]);
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
      await load();
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
  if (!ready)
    return (
      <main className="login">
        <div className="brand">
          E<span>Extopr / CallDesk</span>
        </div>
        <p>Opening your workspace…</p>
      </main>
    );
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
    overdue = pending.filter((f) => new Date(f.due_at) < new Date()),
    student = data.students.find((s) => s.id === detail);
  const visible = data.students.filter(
    (s) =>
      (page !== "Unassigned pool" || !s.owner_id) &&
      (!status || s.status === status) &&
      `${s.name} ${s.phone} ${s.client} ${s.course}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!follow ||
        pending.some(
          (f) =>
            f.student_id === s.id &&
            (follow === "overdue"
              ? new Date(f.due_at) < new Date()
              : new Date(f.due_at).toLocaleDateString() ===
                new Date().toLocaleDateString()),
        )),
  );
  const heading =
    page === "Students"
      ? manager
        ? "Student workspace"
        : "My students"
      : page;
  async function readFile(file) {
    setError("");
    try {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024)
        throw Error("Use a file smaller than 5 MB");
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });
      if (!parsed.length || parsed.length > 1000)
        throw Error("Use a worksheet with 1–1000 rows");
      setRows(parsed);
      setColumns(Object.keys(parsed[0]));
      setFilename(file.name);
      setMapping(
        Object.fromEntries(
          ["name", "phone", "email", "course"].map((k) => [
            k,
            Object.keys(parsed[0]).find((c) => c.toLowerCase().includes(k)) ||
              "",
          ]),
        ),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="shell">
      <aside>
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
                aria-label={p.label}
                href={p.href}
                className={page === p.label ? "nav active" : "nav"}
                aria-current={page === p.label ? "page" : undefined}
              >
                <span aria-hidden="true">{p.icon}</span>
                {p.label}
                {p.label === "Duplicate review" &&
                  data.duplicates.length > 0 && <b>{data.duplicates.length}</b>}
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
          {["Overview", "Follow-ups"].includes(page) && overdue.length > 0 && (
            <button className="reminder" onClick={() => setPage("Follow-ups")}>
              ◷ {overdue.length} overdue follow-up
              {overdue.length !== 1 ? "s" : ""} need attention{" "}
              <span>Review follow-ups →</span>
            </button>
          )}
          {page === "Overview" && (
            <>
              <div className="stats">
                {[
                  [
                    "Students in workspace",
                    data.students.length,
                    "Your connections, in one place",
                  ],
                  [
                    "Interested",
                    data.students.filter((s) => s.status === "Interested")
                      .length,
                    "Conversations with potential",
                  ],
                  [
                    "Follow-ups pending",
                    pending.length,
                    `${overdue.length} overdue · keep the momentum`,
                  ],
                  [
                    manager ? "Unassigned" : "Call attempts",
                    manager
                      ? data.students.filter((s) => !s.owner_id).length
                      : data.activities.filter((a) => a.kind === "call").length,
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
                    const count = data.students.filter(
                      (s) => s.status === item,
                    ).length;
                    return (
                      <div className="status-summary-row" key={item}>
                        <span className={`badge s${index}`}>{item}</span>
                        <div className="status-track">
                          <div
                            style={{
                              width: `${data.students.length ? (count / data.students.length) * 100 : 0}%`,
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
                  <span className="count">{visible.length}</span>
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
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Dropdown
                  aria-label="Call status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "", label: "All call statuses" },
                    ...statuses.map((s) => ({ value: s, label: s })),
                  ]}
                />
                <Dropdown
                  aria-label="Follow-up date"
                  value={follow}
                  onChange={setFollow}
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
                      ...active.map((u) => ({ value: u.id, label: u.name })),
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
                      <th>CLIENT / COURSE</th>
                      <th>CALL STATUS</th>
                      <th>ASSIGNED TO</th>
                      <th>NEXT FOLLOW-UP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => {
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
                          <td>
                            {s.client || "—"}
                            <small>{s.course || "—"}</small>
                          </td>
                          <td>
                            <span
                              className={`badge s${statuses.indexOf(s.status)}`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td>
                            {s.owner_name || (
                              <span className="muted">Unassigned</span>
                            )}
                          </td>
                          <td
                            className={
                              f && new Date(f.due_at) < new Date()
                                ? "danger"
                                : ""
                            }
                          >
                            {f ? date(f.due_at) : "—"}
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
                {!visible.length && (
                  <div className="empty">
                    <span>◎</span>
                    <h3>A fresh start for good conversations</h3>
                    <p>
                      {data.students.length
                        ? "No students match these filters."
                        : "Import your first student list to get started."}
                    </p>
                    {manager && (
                      <button onClick={() => setPage("Import students")}>
                        Import student list →
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer>
                {visible.length} students{" "}
                <span>Every conversation counts.</span>
              </footer>
            </section>
          )}
          {page === "Follow-ups" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Upcoming & overdue</h2>
                <span className="count">{pending.length}</span>
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
                        {data.students.find((s) => s.id === f.student_id)?.name}
                      </button>
                    </h3>
                    <p>{f.note}</p>
                    <small>
                      Responsible:{" "}
                      {data.students.find((s) => s.id === f.student_id)
                        ?.owner_name ||
                        "Unassigned — manager allocation needed"}
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
                            : `${data.students.filter((s) => s.owner_id === u.id).length} assigned students`}
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
          {page === "Import students" && manager && (
            <section className="panel padded">
              <h2>Bring your next conversations in</h2>
              <p className="muted">
                Upload XLSX, XLS, or CSV. First worksheet only; up to 1,000 rows
                and 5 MB per file.
              </p>
              <label className="upload">
                ↥ Choose a student file
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => readFile(e.target.files[0])}
                />
              </label>
              {rows.length > 0 && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const mapped = rows.map((r) => ({
                      ...Object.fromEntries(
                        Object.entries(mapping).map(([k, v]) => [
                          k,
                          String(r[v] || ""),
                        ]),
                      ),
                      source: r,
                    }));
                    if (
                      await action({
                        action: "import",
                        filename,
                        client: new FormData(e.currentTarget).get("client"),
                        rows: mapped,
                      })
                    ) {
                      setRows([]);
                      setNotice(
                        "Import complete. Matching phone numbers were sent to duplicate review.",
                      );
                    }
                  }}
                >
                  <h3>
                    {filename} · {rows.length} rows
                  </h3>
                  <label>
                    Client / source name
                    <input name="client" required />
                  </label>
                  <div className="mapping">
                    {["name", "phone", "email", "course"].map((k) => (
                      <label key={k}>
                        {k}
                        {["name", "phone"].includes(k) ? " *" : ""}
                        <Dropdown
                          aria-label={`${k} column`}
                          value={mapping[k]}
                          required={["name", "phone"].includes(k)}
                          onChange={(value) =>
                            setMapping({ ...mapping, [k]: value })
                          }
                          options={[
                            { value: "", label: "Not mapped" },
                            ...columns.map((c) => ({ value: c, label: c })),
                          ]}
                        />
                      </label>
                    ))}
                  </div>
                  <h3>Preview · first 5 rows</h3>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Normalized phone</th>
                          <th>Course</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td>{r[mapping.name] || "Missing name"}</td>
                            <td>
                              {normalizePhone(r[mapping.phone]) ||
                                "Missing phone"}
                            </td>
                            <td>{r[mapping.course]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted">
                    Phone matches are held for review. Existing details,
                    ownership, and history are preserved. Invalid rows reject
                    the whole batch.
                  </p>
                  <button disabled={busy}>Confirm import →</button>
                </form>
              )}
            </section>
          )}
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
                    <h3>{d.candidate_name}</h3>
                    <p>+{d.candidate_phone}</p>
                  </div>
                  <div>
                    <small>INCOMING RECORD · {d.raw.client}</small>
                    <h3>{d.raw.name}</h3>
                    <p>
                      {d.raw.email} · {d.raw.course}
                    </p>
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
          <p className="workspace-footer">
            EXTOPR CALLDESK <span>Built for meaningful connections.</span>
          </p>
        </main>
      </div>
      {student && (
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
            <p className="eyebrow">STUDENT PROFILE</p>
            <h1>{student.name}</h1>
            <p>
              {student.client} · {student.course}
            </p>
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
            <p className="muted">
              Assigned to {student.owner_name || "unassigned pool"} ·{" "}
              {student.email || "No email"}
            </p>
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
                    due: fields.due ? new Date(fields.due).toISOString() : null,
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
            <h2>Conversation history</h2>
            <div className="timeline">
              {data.activities
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
          </section>
        </div>
      )}
    </div>
  );
}
