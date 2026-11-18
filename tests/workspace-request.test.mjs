import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceQuery } from "../lib/workspace-request.mjs";
test("login, imports, and direct student details never request a workspace list", () => {
  for (const page of ["Login", "Import students", "Unknown"])
    assert.equal(workspaceQuery(page), null);
  assert.equal(workspaceQuery("Students", { studentId: "student-id" }), null);
});
test("each data page requests its own view without unrelated filters", () => {
  for (const page of ["Overview", "Follow-ups", "Team", "Duplicate review"]) {
    const query = workspaceQuery(page, {
      search: "ignored",
      status: "ignored",
      follow: "today",
    });
    assert.equal(query.get("view"), page);
    assert.equal(query.has("search"), false);
    assert.equal(query.has("dayStart"), false);
    assert.equal(query.has("historyPage"), false);
  }
});
test("only student lists send filters and only today sends date boundaries", () => {
  for (const page of ["Students", "Unassigned pool"]) {
    const query = workspaceQuery(page, {
      pageNumber: 3,
      search: "Jane",
      follow: "overdue",
    });
    assert.equal(query.get("page"), "3");
    assert.equal(query.get("search"), "Jane");
    assert.equal(query.has("dayStart"), false);
    const today = workspaceQuery(page, { follow: "today" });
    assert.ok(
      Date.parse(today.get("dayEnd")) > Date.parse(today.get("dayStart")),
    );
  }
});
