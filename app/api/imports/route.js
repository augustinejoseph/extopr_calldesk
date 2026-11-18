import { randomUUID } from "node:crypto";
import { db } from "../../../lib/db.mjs";
import { currentUser, sameOrigin } from "../../../lib/auth.mjs";
import { prepareRow } from "../../../lib/import.mjs";
export async function GET(request) {
  const user = await currentUser();
  if (user?.role !== "manager")
    return Response.json({ error: "Manager access required" }, { status: 403 });
  const sql = db();
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const chunks =
      await sql`select chunk_index,errors from import_chunks where batch_id=${id} order by chunk_index`;
    return Response.json(
      { errors: chunks.flatMap((c) => c.errors) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const batches =
    await sql`select b.*,u.name as author_name,coalesce(sum(c.imported),0)::int as imported,coalesce(sum(c.review_count),0)::int as review_count,coalesce(sum(jsonb_array_length(c.errors)),0)::int as failed,coalesce(sum(c.row_count),0)::int as processed from import_batches b left join users u on u.id=b.author_id left join import_chunks c on c.batch_id=b.id group by b.id,u.name order by b.created_at desc`;
  return Response.json(
    { batches },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const user = await currentUser();
  if (user?.role !== "manager")
    return Response.json({ error: "Manager access required" }, { status: 403 });
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 2000000)
      throw Error("Chunk too large; reduce row size");
    const input = JSON.parse(body),
      sql = db();
    const result = await sql.begin(async (tx) => {
      const [actor] =
        await tx`select id from users where id=${user.id} and role='manager' and deleted_at is null for share`;
      if (!actor) throw Error("Manager access required");
      // One lock order across imports, duplicate decisions and deletion.
      await tx`select pg_advisory_xact_lock(823407)`;
      if (input.action === "start") {
        if (
          typeof input.client !== "string" ||
          !input.client.trim() ||
          !Number.isInteger(input.total) ||
          input.total < 1 ||
          input.total > 100000
        )
          throw Error("Provide a client and 1–100,000 rows");
        const [batch] =
          await tx`insert into import_batches(filename,client,author_id,mapping,total_rows,status) values(${String(input.filename || "upload").slice(0, 255)},${input.client.trim()},${user.id},${tx.json(input.mapping || {})},${input.total},'uploading') returning *`;
        return { batch };
      }
      const [batch] =
        await tx`select * from import_batches where id=${input.id} for update`;
      if (!batch) throw Error("Import not found");
      if (input.action === "delete") {
        if (batch.status === "legacy")
          throw Error("Legacy imports cannot be safely deleted");
        if (input.confirm !== batch.filename)
          throw Error("Type the filename to confirm deletion");
        // Preserve other imports' incoming records when their matching student is removed.
        await tx`update duplicate_reviews set candidate_id=null,resolved_at=case when decision='link' then null else resolved_at end,decision=case when decision='link' then null else decision end where batch_id<>${batch.id} and candidate_id in (select id from students where created_by_import_id=${batch.id})`;
        await tx`update source_records set student_id=null where batch_id<>${batch.id} and student_id in (select id from students where created_by_import_id=${batch.id})`;
        await tx`delete from duplicate_reviews where batch_id=${batch.id}`;
        await tx`delete from source_records where batch_id=${batch.id}`;
        await tx`delete from activities where import_batch_id=${batch.id} or student_id in (select id from students where created_by_import_id=${batch.id})`;
        await tx`delete from followups where student_id in (select id from students where created_by_import_id=${batch.id})`;
        await tx`delete from students where created_by_import_id=${batch.id}`;
        await tx`delete from import_batches where id=${batch.id}`;
        return { ok: true };
      }
      if (input.action === "finish") {
        const [count] =
          await tx`select coalesce(sum(row_count),0)::int as count from import_chunks where batch_id=${batch.id}`;
        if (count.count !== batch.total_rows)
          throw Error("Not all rows have been processed");
        await tx`update import_batches set status='completed',finished_at=now() where id=${batch.id}`;
        return { ok: true };
      }
      if (input.action !== "chunk" || batch.status !== "uploading")
        throw Error("Import is not accepting rows");
      if (
        !Number.isInteger(input.index) ||
        input.index < 0 ||
        !Array.isArray(input.rows) ||
        !input.rows.length ||
        input.rows.length > 200
      )
        throw Error("Invalid chunk");
      const [saved] =
        await tx`select * from import_chunks where batch_id=${batch.id} and chunk_index=${input.index}`;
      if (saved) return saved;
      const [progress] =
        await tx`select count(*)::int as chunks,coalesce(sum(row_count),0)::int as processed from import_chunks where batch_id=${batch.id}`;
      if (
        input.index !== progress.chunks ||
        progress.processed + input.rows.length > batch.total_rows
      )
        throw Error("Unexpected chunk order");
      const records = [],
        errors = [];
      for (const [i, raw] of input.rows.entries()) {
        const row = progress.processed + i + 2;
        try {
          records.push({
            record: prepareRow(raw, batch.client),
            source: raw.source || {},
            row,
          });
        } catch (e) {
          errors.push({ row, error: e.message });
        }
      }
      const phones = [...new Set(records.map((r) => r.record.phone))];
      const existing = phones.length
        ? await tx`select distinct on (phone) id,phone from students where phone in ${tx(phones)} order by phone,created_at,id`
        : [];
      const known = new Map(existing.map((r) => [r.phone, r.id]));
      const students = [],
        sources = [],
        reviews = [];
      for (const { record, source, row } of records) {
        const candidate = known.get(record.phone);
        const sourceId = randomUUID();
        let studentId = candidate;
        if (!candidate) {
          studentId = randomUUID();
          students.push({
            id: studentId,
            ...record,
            created_by_import_id: batch.id,
          });
          known.set(record.phone, studentId);
        } else
          reviews.push({
            id: randomUUID(),
            batch_id: batch.id,
            candidate_id: candidate,
            raw: record,
            source_id: sourceId,
          });
        sources.push({
          id: sourceId,
          batch_id: batch.id,
          student_id: studentId,
          raw: { ...record, source },
          row_number: row,
        });
      }
      if (students.length) {
        await tx`insert into students ${tx(students)}`;
        await tx`insert into activities ${tx(students.map((s) => ({ student_id: s.id, author_id: user.id, kind: "import", import_batch_id: batch.id, note: `Imported from ${batch.filename}` })))}`;
      }
      if (sources.length) await tx`insert into source_records ${tx(sources)}`;
      if (reviews.length)
        await tx`insert into duplicate_reviews ${tx(reviews)}`;
      const [chunk] =
        await tx`insert into import_chunks(batch_id,chunk_index,row_count,imported,review_count,errors) values(${batch.id},${input.index},${input.rows.length},${students.length},${reviews.length},${tx.json(errors)}) returning *`;
      return chunk;
    });
    return Response.json(result);
  } catch (e) {
    console.error("Import:", e.message);
    return Response.json(
      {
        error: e.code
          ? "Database operation failed; no changes from this request were saved"
          : e.message,
      },
      { status: 400 },
    );
  }
}
