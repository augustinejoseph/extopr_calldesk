import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(
    new URL("../app/api/workspace/route.js", import.meta.url),
    "utf8",
  )
).replace(/^import .*;$/gm, "");
const { GET } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      `
const db = () => globalThis.workspaceFixture.sql;
const currentUser = async () => globalThis.workspaceFixture.user;
const pagination = (params, key = "page") => ({ page: Number(params.get(key)) || 1, limit: 25, offset: 0 });
${source}
`,
    ).toString("base64")
);
const id = "12345678-1234-1234-1234-123456789abc";
function fixture(
  student = {
    id,
    name: "Student",
    phone: "919876543210",
    status: "Interested",
  },
) {
  const queries = [];
  const sql = (parts, ...values) => {
    if (!Array.isArray(parts)) return parts;
    const query = parts.join("?");
    const fragment = { query, values };
    fragment.then = (resolve, reject) => {
      queries.push(query);
      return Promise.resolve(
        query.includes("count(*)")
          ? [{ total: 0 }]
          : query.includes("from students s")
            ? student
              ? [student]
              : []
            : [],
      ).then(resolve, reject);
    };
    return fragment;
  };
  globalThis.workspaceFixture = { user: { id, role: "telecaller" }, sql };
  return queries;
}
test("basic student request skips full profile, list and history queries", async () => {
  const queries = fixture();
  const response = await GET(
    new Request(`https://example.test/api/workspace?student=${id}`),
  );
  const result = await response.json();
  assert.equal(result.student.id, id);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /s.id,s.name,s.phone,s.status/);
  assert.doesNotMatch(queries[0], /s\.\*/);
  assert.deepEqual(result.activities, []);
});
test("More loads authorized profile and paginated history only", async () => {
  const queries = fixture();
  const result = await (
    await GET(
      new Request(`https://example.test/api/workspace?student=${id}&more=1`),
    )
  ).json();
  assert.equal(result.student.id, id);
  assert.equal(queries.length, 3);
  assert.match(queries[0], /select s\.\*/);
  assert.match(queries[0], /where s.id=\? and \?/);
  assert.ok(queries.some((q) => q.includes("limit ? offset ?")));
  assert.ok(queries.every((q) => !q.includes("duplicate_reviews")));
});
test("missing or inaccessible student does not load history", async () => {
  const queries = fixture(null);
  const result = await (
    await GET(
      new Request(`https://example.test/api/workspace?student=${id}&more=1`),
    )
  ).json();
  assert.equal(result.student, null);
  assert.equal(queries.length, 1);
});
test("invalid student and signed-out requests avoid database reads", async () => {
  const queries = fixture();
  assert.equal(
    (
      await GET(
        new Request(
          "https://example.test/api/workspace?student=" + "-".repeat(36),
        ),
      )
    ).status,
    400,
  );
  globalThis.workspaceFixture.user = null;
  assert.equal(
    (await GET(new Request("https://example.test/api/workspace"))).status,
    401,
  );
  assert.equal(queries.length, 0);
});
test("missing and invalid views never fall back to loading students", async () => {
  const queries = fixture();
  for (const suffix of [
    "",
    "?view=Login",
    "?view=Import%20students",
    "?view=invalid",
  ]) {
    assert.equal(
      (await GET(new Request("https://example.test/api/workspace" + suffix)))
        .status,
      400,
    );
  }
  assert.equal(queries.length, 0);
});
test("non-list views do not fetch student records", async () => {
  for (const view of ["Overview", "Follow-ups", "Team", "Duplicate review"]) {
    const queries = fixture();
    globalThis.workspaceFixture.user.role = "manager";
    const response = await GET(
      new Request(
        "https://example.test/api/workspace?view=" + encodeURIComponent(view),
      ),
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).students, []);
    assert.ok(queries.every((q) => !q.includes("select s.id,s.name,s.phone")));
  }
});
test("manager-only views reject callers before querying their data", async () => {
  for (const view of ["Unassigned pool", "Team", "Duplicate review"]) {
    const queries = fixture();
    const response = await GET(
      new Request(
        "https://example.test/api/workspace?view=" + encodeURIComponent(view),
      ),
    );
    assert.equal(response.status, 403);
    assert.equal(queries.length, 0);
  }
});
test("only explicit student list views load student records", async () => {
  for (const view of ["Students", "Unassigned pool"]) {
    const queries = fixture();
    globalThis.workspaceFixture.user.role = "manager";
    const response = await GET(
      new Request(
        "https://example.test/api/workspace?view=" + encodeURIComponent(view),
      ),
    );
    assert.equal(response.status, 200);
    assert.ok(queries.some((q) => q.includes("select s.id,s.name,s.phone")));
    assert.ok(queries.every((q) => !q.includes("duplicate_reviews")));
  }
});
