import { test } from "node:test";
import assert from "node:assert/strict";
import { pagination } from "../lib/pagination.mjs";

test("pagination defaults, bounds and independent history pages", () => {
  assert.deepEqual(pagination(new URLSearchParams()), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  for (const value of [
    "0",
    "-1",
    "1.5",
    "NaN",
    "Infinity",
    "9007199254740992",
  ]) {
    assert.equal(pagination(new URLSearchParams({ page: value })).page, 1);
  }
  assert.deepEqual(pagination(new URLSearchParams("page=3&limit=200")), {
    page: 3,
    limit: 100,
    offset: 200,
  });
  assert.equal(
    pagination(new URLSearchParams("page=3&historyPage=2"), "historyPage")
      .offset,
    50,
  );
});
