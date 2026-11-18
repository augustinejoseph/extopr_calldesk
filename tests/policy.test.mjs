import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, normalizePhone, validateOutcome } from "../lib/policy.mjs";
const manager = { id: "m", role: "manager" },
  caller = { id: "c", role: "telecaller" },
  student = { owner_id: "c", status: "Interested" };
test("student scope follows current ownership", () => {
  assert.equal(canAccess(caller, student), true);
  assert.equal(canAccess(caller, { owner_id: "other" }), false);
  assert.equal(canAccess(manager, { owner_id: null }), true);
});
test("DNC requires reason and only manager can lift", () => {
  assert.throws(() =>
    validateOutcome(caller, student, "Do not call", "", null),
  );
  assert.throws(() =>
    validateOutcome(
      caller,
      { ...student, status: "Do not call" },
      "Interested",
      "",
      null,
    ),
  );
  assert.doesNotThrow(() =>
    validateOutcome(
      manager,
      { ...student, status: "Do not call" },
      "Interested",
      "Restriction reviewed",
      null,
    ),
  );
});
test("follow-up requires future time and next action", () => {
  assert.throws(() =>
    validateOutcome(
      caller,
      student,
      "Follow-up scheduled",
      "Call tomorrow",
      "2000-01-01",
    ),
  );
  assert.throws(() =>
    validateOutcome(
      caller,
      student,
      "Follow-up scheduled",
      "",
      new Date(Date.now() + 60000).toISOString(),
    ),
  );
  assert.doesNotThrow(() =>
    validateOutcome(
      caller,
      student,
      "Follow-up scheduled",
      "Discuss course",
      new Date(Date.now() + 60000).toISOString(),
    ),
  );
});
test("outcomes reject unauthorized caller and invalid status", () => {
  assert.throws(() =>
    validateOutcome({ ...caller, id: "x" }, student, "Interested", "", null),
  );
  assert.throws(() => validateOutcome(caller, student, "unknown", "", null));
});
test("phone normalization keeps international digits and normalizes Indian local numbers", () => {
  assert.equal(normalizePhone("98765 43210"), "919876543210");
  assert.equal(normalizePhone("+91 98765-43210"), "919876543210");
  assert.equal(normalizePhone("+44 7700 900123"), "447700900123");
});
