import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { suggestMapping } from "../lib/import.mjs";
// Opt-in: only a disposable local PostgreSQL database is accepted.
const url = process.env.IMPORT_TEST_DATABASE_URL;
test(
  "bulk import, retries, duplicate decisions, permissions and complete batch deletion",
  { skip: !url },
  async () => {
    const parsed = new URL(url);
    assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
    const control = postgres(url, { onnotice: () => {} });
    const database = `import_test_${randomUUID().replaceAll("-", "")}`;
    await control.unsafe(`create database "${database}"`);
    parsed.pathname = `/${database}`;
    process.env.DATABASE_URL = parsed.href;
    const sql = postgres(parsed.href, { onnotice: () => {} });
    const auth = `data:text/javascript,${encodeURIComponent('export async function currentUser(){return globalThis.importTestActor} export function sameOrigin(r){return r.headers.get("origin")===new URL(r.url).origin} export function hashPassword(){return "test"} ')}`;
    async function route(path) {
      const source = (await readFile(new URL(path, import.meta.url), "utf8"))
        .replace(
          /from "\.\.\/\.\.\/\.\.\/lib\/auth.mjs"/g,
          `from ${JSON.stringify(auth)}`,
        )
        .replace(
          /from "(\.\.\/\.\.\/\.\.\/lib\/[^\"]+)"/g,
          (_, p) =>
            `from ${JSON.stringify(new URL(p, new URL(path, import.meta.url)).href)}`,
        );
      return import(`data:text/javascript,${encodeURIComponent(source)}`);
    }
    try {
      await sql.unsafe(
        await readFile(
          new URL("../scripts/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      // Verify the additive migration can be applied repeatedly.
      await sql.unsafe(
        await readFile(
          new URL("../scripts/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      const [manager] =
        await sql`insert into users(name,email,password_hash,role) values('Manager','manager@test.local','test','manager') returning *`;
      globalThis.importTestActor = manager;
      const imports = await route("../app/api/imports/route.js");
      const workspace = await route("../app/api/workspace/route.js");
      async function post(api, input, expected = 200) {
        const response = await api.POST(
          new Request("http://localhost/api/imports", {
            method: "POST",
            headers: { origin: "http://localhost" },
            body: JSON.stringify(input),
          }),
        );
        const data = await response.json();
        assert.equal(response.status, expected, JSON.stringify(data));
        return data;
      }
      const [existing] =
        await sql`insert into students(name,phone) values('Existing','919999999999') returning *`;
      const { batch } = await post(imports, {
        action: "start",
        filename: "test.xlsx",
        client: "School",
        total: 4,
        mapping: { name: "STUDENTS NAME" },
      });
      const chunk = {
        action: "chunk",
        id: batch.id,
        index: 0,
        rows: [
          {
            name: "New",
            phone: "9486832536",
            district: "District",
            extra_fields: { year: "2026" },
            source: { NAME: "New" },
          },
          { name: "Shared", phone: "9486832536", father_name: "Father" },
          { name: "Existing incoming", phone: "9999999999" },
          { name: "", phone: "123" },
        ],
      };
      const result = await post(imports, chunk);
      assert.equal(result.imported, 1);
      assert.equal(result.review_count, 2);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].row, 5);
      const retried = await post(imports, chunk);
      assert.deepEqual(retried, result);
      const [created] =
        await sql`select * from students where created_by_import_id=${batch.id}`;
      assert.equal(created.district, "District");
      assert.deepEqual(created.extra_fields, { year: "2026" });
      await post(imports, { action: "finish", id: batch.id });
      const reviews =
        await sql`select * from duplicate_reviews where batch_id=${batch.id}`;
      await post(workspace, {
        action: "duplicate",
        id: reviews.find((r) => r.raw.name === "Shared").id,
        decision: "keep",
      });
      await post(workspace, {
        action: "duplicate",
        id: reviews.find((r) => r.raw.name === "Existing incoming").id,
        decision: "link",
      });
      const [separate] = await sql`select * from students where name='Shared'`;
      assert.equal(separate.father_name, "Father");
      assert.equal(separate.created_by_import_id, batch.id);
      const sources =
        await sql`select * from source_records where batch_id=${batch.id}`;
      assert.equal(sources.length, 3);
      assert.equal(
        sources.find((r) => r.raw.name === "Shared").student_id,
        separate.id,
      );
      assert.equal(
        sources.find((r) => r.raw.name === "New").student_id,
        created.id,
      );
      await sql`insert into followups(student_id,author_id,due_at,note) values(${created.id},${manager.id},now(),'Follow up')`;
      await post(
        imports,
        { action: "delete", id: batch.id, confirm: "wrong" },
        400,
      );
      globalThis.importTestActor = { ...manager, role: "telecaller" };
      await post(
        imports,
        { action: "delete", id: batch.id, confirm: batch.filename },
        403,
      );
      globalThis.importTestActor = manager;
      await post(imports, {
        action: "delete",
        id: batch.id,
        confirm: batch.filename,
      });
      for (const table of [
        "import_batches",
        "import_chunks",
        "source_records",
        "duplicate_reviews",
        "activities",
        "followups",
      ])
        assert.equal((await sql`select * from ${sql(table)}`).length, 0, table);
      const remaining = await sql`select * from students`;
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, existing.id);
      const { batch: first } = await post(imports, {
        action: "start",
        filename: "first.xlsx",
        client: "A",
        total: 1,
      });
      await post(imports, {
        action: "chunk",
        id: first.id,
        index: 0,
        rows: [{ name: "First", phone: "9888888888" }],
      });
      const { batch: second } = await post(imports, {
        action: "start",
        filename: "second.xlsx",
        client: "B",
        total: 1,
      });
      await post(imports, {
        action: "chunk",
        id: second.id,
        index: 0,
        rows: [{ name: "Second", phone: "9888888888" }],
      });
      const [crossReview] =
        await sql`select * from duplicate_reviews where batch_id=${second.id}`;
      await post(workspace, {
        action: "duplicate",
        id: crossReview.id,
        decision: "link",
      });
      await post(imports, {
        action: "delete",
        id: first.id,
        confirm: first.filename,
      });
      const [preserved] =
        await sql`select * from duplicate_reviews where id=${crossReview.id}`;
      assert.equal(preserved.candidate_id, null);
      assert.equal(preserved.resolved_at, null);
      await post(workspace, {
        action: "duplicate",
        id: crossReview.id,
        decision: "keep",
      });
      await post(imports, {
        action: "delete",
        id: second.id,
        confirm: second.filename,
      });
      assert.equal((await sql`select * from students`).length, 1);
      if (process.env.IMPORT_TEST_FILE) {
        const XLSX = await import("xlsx");
        const book = XLSX.read(await readFile(process.env.IMPORT_TEST_FILE), {
          type: "buffer",
        });
        const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
          raw: true,
          defval: "",
        });
        const mapping = suggestMapping(Object.keys(rows[0]));
        const { batch: sample } = await post(imports, {
          action: "start",
          filename: "sample.xlsx",
          client: "Sample",
          total: rows.length,
          mapping,
        });
        let imported = 0,
          review = 0,
          failed = 0;
        for (
          let offset = 0, index = 0;
          offset < rows.length;
          offset += 200, index++
        ) {
          const result = await post(imports, {
            action: "chunk",
            id: sample.id,
            index,
            rows: rows.slice(offset, offset + 200).map((source) => ({
              ...Object.fromEntries(
                Object.entries(mapping).map(([k, v]) => [
                  k,
                  String(source[v] ?? ""),
                ]),
              ),
              source,
            })),
          });
          imported += result.imported;
          review += result.review_count;
          failed += result.errors.length;
        }
        await post(imports, { action: "finish", id: sample.id });
        assert.equal(imported + review + failed, rows.length);
        console.log(
          JSON.stringify({ sampleRows: rows.length, imported, review, failed }),
        );
        await post(imports, {
          action: "delete",
          id: sample.id,
          confirm: sample.filename,
        });
        assert.equal((await sql`select * from students`).length, 1);
      }
    } finally {
      await sql.end();
      const { db } = await import("../lib/db.mjs");
      await db().end();
      await control.unsafe(`drop database "${database}"`);
      await control.end();
      delete globalThis.importTestActor;
    }
  },
);
