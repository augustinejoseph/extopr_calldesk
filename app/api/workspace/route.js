import { db } from "../../../lib/db.mjs";
import { currentUser, sameOrigin, hashPassword } from "../../../lib/auth.mjs";
import {
  canAccess,
  normalizePhone,
  validateOutcome,
} from "../../../lib/policy.mjs";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const sql = db();
  const students =
    await sql`select s.*,u.name as owner_name from students s left join users u on u.id=s.owner_id where ${user.role === "manager"} or s.owner_id=${user.id} order by s.created_at desc`;
  const activities =
    await sql`select a.*,u.name as author from activities a join users u on u.id=a.author_id join students s on s.id=a.student_id where ${user.role === "manager"} or s.owner_id=${user.id} order by a.created_at desc`;
  const followups =
    await sql`select f.* from followups f join students s on s.id=f.student_id where ${user.role === "manager"} or s.owner_id=${user.id} order by f.due_at`;
  const users =
    user.role === "manager"
      ? await sql`select id,name,email,role,deleted_at from users order by name`
      : [];
  const duplicates =
    user.role === "manager"
      ? await sql`select d.*,s.name as candidate_name,s.phone as candidate_phone from duplicate_reviews d join students s on s.id=d.candidate_id where d.resolved_at is null`
      : [];
  return Response.json(
    { user, students, activities, followups, users, duplicates },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    if (Number(request.headers.get("content-length")) > 2000000)
      throw Error("Request too large");
    const body = await request.text();
    if (Buffer.byteLength(body) > 2000000) throw Error("Request too large");
    const input = JSON.parse(body),
      sql = db();
    await sql.begin(async (tx) => {
      const [actor] =
        await tx`select id from users where id=${user.id} and deleted_at is null for share`;
      if (!actor) throw Error("Account is inactive");
      const manager = () => {
        if (user.role !== "manager") throw Error("Manager access required");
      };
      const history = async (id, kind, note, outcome = null) =>
        tx`insert into activities(student_id,author_id,kind,note,outcome) values(${id},${user.id},${kind},${note},${outcome})`;
      if (input.action === "assign") {
        manager();
        if (
          !Array.isArray(input.ids) ||
          !input.ids.length ||
          input.ids.length > 1000
        )
          throw Error("Select 1–1000 students");
        const owner = input.owner || null;
        if (owner) {
          const [account] =
            await tx`select id from users where id=${owner} and role='telecaller' and deleted_at is null for update`;
          if (!account) throw Error("Choose an active telecaller");
        }
        const students =
          await tx`select * from students where id in ${tx(input.ids)} for update`;
        const names = await tx`select id,name from users`;
        const ownerName = (id) =>
          names.find((u) => u.id === id)?.name || "unassigned";
        for (const s of students) {
          await tx`update students set owner_id=${owner} where id=${s.id}`;
          await history(
            s.id,
            "assignment",
            `Ownership changed from ${ownerName(s.owner_id)} to ${ownerName(owner)}`,
          );
        }
      } else if (input.action === "outcome") {
        const [s] =
          await tx`select * from students where id=${input.id} for update`;
        if (!s) throw Error("Student not found");
        const note = String(input.note || "").trim();
        if (note.length > 10000) throw Error("Note too long");
        validateOutcome(user, s, input.status, note, input.due);
        await tx`update students set status=${input.status} where id=${s.id}`;
        await history(s.id, "call", note, input.status);
        if (input.status === "Follow-up scheduled")
          await tx`insert into followups(student_id,author_id,due_at,note) values(${s.id},${user.id},${input.due},${note})`;
      } else if (input.action === "complete") {
        const [f] =
          await tx`select f.*,s.owner_id from followups f join students s on s.id=f.student_id where f.id=${input.id} for update of s,f`;
        if (!f || !canAccess(user, f)) throw Error("Access denied");
        if (!f.completed_at) {
          await tx`update followups set completed_at=now() where id=${f.id}`;
          await history(f.student_id, "follow-up", "Follow-up completed");
        }
      } else if (input.action === "createUser") {
        manager();
        if (
          !input.name?.trim() ||
          !/^\S+@\S+\.\S+$/.test(input.email) ||
          typeof input.password !== "string" ||
          input.password.length < 12 ||
          input.password.length > 256
        )
          throw Error(
            "Enter a name, valid email, and password of 12–256 characters",
          );
        await tx`insert into users(name,email,password_hash,role) values(${input.name.trim()},${input.email.trim().toLowerCase()},${hashPassword(input.password)},'telecaller')`;
      } else if (input.action === "account") {
        manager();
        const [account] =
          await tx`select * from users where id=${input.id} and role='telecaller' for update`;
        if (!account) throw Error("Telecaller not found");
        if (input.restore)
          await tx`update users set deleted_at=null where id=${input.id}`;
        else {
          await tx`update users set deleted_at=now() where id=${input.id}`;
          const students =
            await tx`select id from students where owner_id=${input.id} for update`;
          for (const s of students)
            await history(
              s.id,
              "assignment",
              `${account.name} deactivated; student released to unassigned pool`,
            );
          await tx`update students set owner_id=null where owner_id=${input.id}`;
        }
      } else if (input.action === "import") {
        manager();
        if (
          !Array.isArray(input.rows) ||
          !input.rows.length ||
          input.rows.length > 1000 ||
          !input.client?.trim()
        )
          throw Error("Provide client and 1–1000 mapped rows");
        // Serialize imports so simultaneous batches cannot bypass phone review.
        await tx`select pg_advisory_xact_lock(823407)`;
        const [batch] =
          await tx`insert into import_batches(filename,client,author_id) values(${String(input.filename || "upload")},${input.client.trim()},${user.id}) returning id`;
        for (const raw of input.rows) {
          const phone = normalizePhone(raw.phone);
          if (!raw.name?.trim() || phone.length < 10 || phone.length > 15)
            throw Error("Every row needs a name and valid phone number");
          const [existing] =
            await tx`select id from students where phone=${phone} limit 1`;
          const record = { ...raw, phone, client: input.client.trim() };
          if (existing) {
            await tx`insert into duplicate_reviews(batch_id,candidate_id,raw) values(${batch.id},${existing.id},${tx.json(record)})`;
            await tx`insert into source_records(batch_id,student_id,raw) values(${batch.id},${existing.id},${tx.json(record)})`;
          } else {
            const [s] =
              await tx`insert into students(name,phone,email,course,client) values(${raw.name.trim()},${phone},${String(raw.email || "")},${String(raw.course || "")},${input.client.trim()}) returning id`;
            await tx`insert into source_records(batch_id,student_id,raw) values(${batch.id},${s.id},${tx.json(record)})`;
            await history(
              s.id,
              "import",
              `Imported from ${input.filename} · ${input.client}`,
            );
          }
        }
      } else if (input.action === "duplicate") {
        manager();
        const [review] =
          await tx`select * from duplicate_reviews where id=${input.id} and resolved_at is null for update`;
        if (!review) throw Error("Review already resolved");
        if (!["keep", "link"].includes(input.decision))
          throw Error("Invalid decision");
        if (input.decision === "keep") {
          const r = review.raw;
          const [s] =
            await tx`insert into students(name,phone,email,course,client) values(${r.name},${r.phone},${r.email || ""},${r.course || ""},${r.client}) returning id`;
          await tx`update source_records set student_id=${s.id} where batch_id=${review.batch_id} and raw=${tx.json(r)}`;
          await history(
            s.id,
            "import",
            "Manager approved a separate student with shared phone",
          );
        } else
          await history(
            review.candidate_id,
            "import",
            `Additional source linked: ${review.raw.client}. Imported details preserved in source records.`,
          );
        await tx`update duplicate_reviews set resolved_at=now(),decision=${input.decision} where id=${review.id}`;
      } else throw Error("Unknown action");
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Workspace action:", e.message);
    return Response.json(
      {
        error:
          e.code === "23505"
            ? "That email is already registered"
            : e.code
              ? "Unable to save this change. Check the provided values."
              : e.message,
      },
      { status: 400 },
    );
  }
}
