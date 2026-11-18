import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const loader = new URL("../lib/env.mjs", import.meta.url).href;
test("APP_CONFIG loads strings, preserves exported values, and permits a missing file", () => {
  const cwd = mkdtempSync(join(tmpdir(), "calldesk-env-"));
  const run = () =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
    import ${JSON.stringify(loader)};
    console.log(JSON.stringify([process.env.CALLDESK_TEST_VALUE, process.env.CALLDESK_TEST_OVERRIDE]));
  `,
      ],
      { cwd, env: { CALLDESK_TEST_OVERRIDE: "exported" }, encoding: "utf8" },
    );
  try {
    assert.equal(run().status, 0);
    writeFileSync(
      join(cwd, ".env.local"),
      "APP_CONFIG='" +
        JSON.stringify({
          CALLDESK_TEST_VALUE: 'quoted " value $ with\nnewline',
          CALLDESK_TEST_OVERRIDE: "file",
        }) +
        "'\n",
    );
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
      'quoted " value $ with\nnewline',
      "exported",
    ]);
    writeFileSync(join(cwd, ".env.local"), "APP_CONFIG='{\"BAD\":123}'");
    assert.notEqual(run().status, 0);
    writeFileSync(join(cwd, ".env.local"), "APP_CONFIG='{broken'");
    assert.notEqual(run().status, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
