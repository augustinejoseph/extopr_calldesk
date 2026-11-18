import { test } from "node:test";
import assert from "node:assert/strict";
import { importFields, suggestMapping, prepareRow } from "../lib/import.mjs";
test("sample columns map correctly with group separate from course", () => {
  const mapping = suggestMapping([
    "DISTRICT",
    "SUB DISTRICT",
    "STUDENTS NAME",
    "FATHER NAME",
    "GENDER",
    "COMMUNITY",
    "MOBILE NUMBER",
    "GROUP",
    "ADDRESS",
    "PINCODE",
    "SCHOOL NAME",
  ]);
  assert.equal(mapping.name, "STUDENTS NAME");
  assert.equal(mapping.phone, "MOBILE NUMBER");
  assert.equal(mapping.student_group, "GROUP");
  assert.equal(mapping.course, "");
  assert.equal(Object.values(mapping).filter(Boolean).length, 11);
});
test("all mapped fields and extra values survive validation", () => {
  const raw = Object.fromEntries(
    Object.keys(importFields).map((k) => [k, ` ${k} `]),
  );
  Object.assign(raw, {
    phone: 9486832536,
    email: "",
    pincode: "626142",
    extra_fields: { year: "2026" },
  });
  const row = prepareRow(raw, "school");
  assert.equal(row.phone, "919486832536");
  assert.equal(row.father_name, "father_name");
  assert.equal(row.student_group, "student_group");
  assert.equal(row.pincode, "626142");
  assert.deepEqual(row.extra_fields, { year: "2026" });
});
test("invalid rows are rejected independently", () => {
  const input = [
    { name: "A", phone: "9486832536" },
    { name: "", phone: "9486832536" },
    { name: "B", phone: "123" },
    { name: "C", phone: "9486832536", email: "bad" },
  ];
  const valid = [],
    errors = [];
  input.forEach((r, i) => {
    try {
      valid.push(prepareRow(r, "client"));
    } catch (e) {
      errors.push({ row: i + 2, error: e.message });
    }
  });
  assert.equal(valid.length, 1);
  assert.deepEqual(
    errors.map((e) => e.row),
    [3, 4, 5],
  );
});

test("only name and phone are required for student profiles", () => {
  const row = prepareRow({ name: " Student ", phone: "9486832536" });
  assert.equal(row.name, "Student");
  assert.equal(row.client, "");
  for (const key of Object.keys(importFields).filter(
    (k) => !["name", "phone"].includes(k),
  )) {
    assert.equal(row[key], "");
  }
  assert.throws(() => prepareRow({ phone: "9486832536" }), /name is required/);
  assert.throws(() => prepareRow({ name: "Student" }), /Phone/);
});
