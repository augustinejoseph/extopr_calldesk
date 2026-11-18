// Run against an empty, isolated test database and a running app; never production.
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3017";
const password = "CallerTestPassword123";
async function request(path, body, cookie, method = body ? "POST" : "GET") {
  const res = await fetch(base + path, {
    method,
    headers: {
      origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(email, pw = password) {
  const r = await request("/api/auth", { email, password: pw });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.cookie;
}
const manager = await login("manager@test.local", "TestManagerPassword123");
async function mutate(body, cookie = manager) {
  const r = await request("/api/workspace", body, cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
}
const state = async (cookie = manager) =>
  (await request("/api/workspace", null, cookie)).data;
for (const name of ["Alice", "Bob", "Cara"])
  await mutate({
    action: "createUser",
    name,
    email: `${name.toLowerCase()}@test.local`,
    password,
  });
let d = await state();
const alice = d.users.find((u) => u.name === "Alice"),
  bob = d.users.find((u) => u.name === "Bob");
const a = await login(alice.email),
  b = await login(bob.email);
await mutate({
  action: "import",
  filename: "test.csv",
  client: "Pilot",
  rows: [
    {
      name: "Student One",
      phone: "9876543210",
      source: { Name: "Student One" },
    },
    { name: "Student Two", phone: "9876543211" },
  ],
});
d = await state();
assert.equal(d.students.length, 2);
const ids = d.students.map((s) => s.id);
await mutate({ action: "assign", ids, owner: alice.id });
assert.equal((await state(a)).students.length, 2);
assert.equal((await state(b)).students.length, 0);
const denied = await request(
  "/api/workspace",
  { action: "outcome", id: ids[0], status: "Interested" },
  b,
);
assert.equal(denied.status, 400);
await mutate(
  {
    action: "outcome",
    id: ids[0],
    status: "Follow-up scheduled",
    note: "Call about course",
    due: new Date(Date.now() + 86400000).toISOString(),
  },
  a,
);
await mutate({ action: "assign", ids: [ids[0]], owner: bob.id });
let bd = await state(b);
assert.equal(bd.followups.length, 1);
assert(bd.activities.some((x) => x.author === "Alice" && x.kind === "call"));
assert.equal((await state(a)).followups.length, 0);
await mutate(
  {
    action: "outcome",
    id: ids[0],
    status: "Do not call",
    note: "Student requested no calls",
  },
  b,
);
assert.equal(
  (
    await request(
      "/api/workspace",
      { action: "outcome", id: ids[0], status: "Interested" },
      b,
    )
  ).status,
  400,
);
await mutate({
  action: "outcome",
  id: ids[0],
  status: "Interested",
  note: "Manager reviewed restriction",
});
await mutate({ action: "complete", id: bd.followups[0].id }, b);
assert((await state(b)).followups[0].completed_at);
await mutate({ action: "account", id: bob.id, restore: false });
assert.equal((await request("/api/workspace", null, b)).status, 401);
d = await state();
assert.equal(d.students.find((s) => s.id === ids[0]).owner_id, null);
await mutate({ action: "account", id: bob.id, restore: true });
assert.equal((await state(b)).students.length, 0);
await mutate({
  action: "import",
  filename: "repeat.csv",
  client: "Other client",
  rows: [{ name: "Shared phone student", phone: "9876543210" }],
});
d = await state();
assert.equal(d.students.length, 2);
assert.equal(d.duplicates.length, 1);
await mutate({ action: "duplicate", id: d.duplicates[0].id, decision: "keep" });
assert.equal((await state()).students.length, 3);
assert.equal(
  (
    await request(
      "/api/workspace",
      {
        action: "import",
        client: "Bad batch",
        rows: [
          { name: "Good row", phone: "9876543219" },
          { name: "", phone: "1" },
        ],
      },
      manager,
    )
  ).status,
  400,
);
assert.equal((await state()).students.length, 3);
await mutate({
  action: "import",
  filename: "reupload.csv",
  client: "New source",
  rows: [{ name: "Student One", phone: "9876543210" }],
});
d = await state();
assert.equal(d.duplicates.length, 1);
await mutate({ action: "duplicate", id: d.duplicates[0].id, decision: "link" });
d = await state();
assert.equal(d.students.length, 3);
assert(
  d.activities.some((x) => x.author === "Bob" && x.outcome === "Do not call"),
);
console.log(
  "Integration passed: 3 callers, scope isolation, bulk ownership, reassignment/history/follow-ups, DNC, completion, account lifecycle, duplicate review, atomic import rollback.",
);
