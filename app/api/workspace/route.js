import { pagination } from "../../../lib/pagination.mjs";
import { prepareRow } from "../../../lib/import.mjs";
import { db } from "../../../lib/db.mjs";
import { currentUser, sameOrigin, hashPassword } from "../../../lib/auth.mjs";
import { canAccess, validateOutcome } from "../../../lib/policy.mjs";
export async function GET(request) {
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const sql = db();
  const params = new URL(request.url).searchParams;
  const { page, limit, offset } = pagination(params);
  const view = params.get("view") || "Students";
  const detail = params.get("student");
  if (detail && !/^[0-9a-f-]{36}$/i.test(detail))
    return Response.json({ error: "Invalid student" }, { status: 400 });
  const access = sql`(${user.role === "manager"} or s.owner_id=${user.id})`;
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const follow = params.get("follow") || "";
  const start = params.get("dayStart"),
    end = params.get("dayEnd");
  if (
    follow === "today" &&
    (!start ||
      !end ||
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)))
  )
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  const filter = sql`${access}
    and (${view !== "Unassigned pool"} or s.owner_id is null)
    and (${!status} or s.status=${status})
    and (${!search} or strpos(lower(concat_ws(' ',s.name,s.phone,s.client,s.course)),lower(${search}))>0)
    and (${!follow} or exists(select 1 from followups f where f.student_id=s.id and f.completed_at is null
      and ((${follow === "overdue"} and f.due_at<now()) or (${follow === "today"} and f.due_at>=${start}::timestamptz and f.due_at<${end}::timestamptz))))`;
  let students = [],
    activities = [],
    followups = [],
    duplicates = [],
    total = 0;
  let users = [];
  if (user.role === "manager" && view === "Team") {
    const [count] =
      await sql`select count(*)::int as total from users where role='telecaller'`;
    total = count.total;
    users =
      await sql`select u.id,u.name,u.email,u.role,u.deleted_at,(select count(*)::int from students s where s.owner_id=u.id) as assigned_count from users u where u.role='telecaller' order by u.name,u.id limit ${limit} offset ${offset}`;
  } else if (
    user.role === "manager" &&
    ["Students", "Unassigned pool"].includes(view)
  ) {
    users =
      await sql`select id,name,role,deleted_at from users where role='telecaller' and deleted_at is null order by name,id`;
  }
  let stats = {
    total: 0,
    interested: 0,
    unassigned: 0,
    pending: 0,
    overdue: 0,
    calls: 0,
    statuses: {},
  };
  if (view === "Overview" || view === "Follow-ups") {
    const [counts] =
      await sql`select count(*)::int as pending,count(*) filter(where f.due_at<now())::int as overdue from followups f join students s on s.id=f.student_id where ${access} and f.completed_at is null`;
    Object.assign(stats, counts);
  }
  if (view === "Overview") {
    const groups =
      await sql`select s.status,count(*)::int as count,count(*) filter(where s.owner_id is null)::int as unassigned from students s where ${access} group by s.status`;
    for (const row of groups) {
      stats.total += row.count;
      stats.unassigned += row.unassigned;
      stats.statuses[row.status] = row.count;
    }
    stats.interested = stats.statuses.Interested || 0;
    if (user.role !== "manager") {
      const [count] =
        await sql`select count(*)::int as calls from activities a join students s on s.id=a.student_id where ${access} and a.kind='call'`;
      stats.calls = count.calls;
    }
  }
  if (["Students", "Unassigned pool"].includes(view)) {
    const [count] =
      await sql`select count(*)::int as total from students s where ${filter}`;
    total = count.total;
    students =
      await sql`select s.id,s.name,s.phone,s.client,s.course,s.status,s.owner_id,u.name as owner_name from students s left join users u on u.id=s.owner_id where ${filter} order by s.created_at desc,s.id desc limit ${limit} offset ${offset}`;
    if (students.length)
      followups =
        await sql`select distinct on (student_id) id,student_id,due_at from followups where student_id in ${sql(students.map((s) => s.id))} and completed_at is null order by student_id,due_at,id`;
  } else if (view === "Follow-ups") {
    total = stats.pending;
    followups =
      await sql`select f.*,s.name as student_name,u.name as owner_name from followups f join students s on s.id=f.student_id left join users u on u.id=s.owner_id where ${access} and f.completed_at is null order by f.due_at,f.id limit ${limit} offset ${offset}`;
  }
  let duplicateTotal = 0;
  if (user.role === "manager") {
    const [count] =
      await sql`select count(*)::int as total from duplicate_reviews where resolved_at is null`;
    duplicateTotal = count.total;
  }
  if (view === "Duplicate review" && user.role === "manager") {
    total = duplicateTotal;
    duplicates =
      await sql`select d.*,s.name as candidate_name,s.phone as candidate_phone from duplicate_reviews d left join students s on s.id=d.candidate_id where d.resolved_at is null order by d.id limit ${limit} offset ${offset}`;
  }
  let student = null,
    historyTotal = 0;
  const historyPage = pagination(params, "historyPage");
  if (detail) {
    [student = null] =
      await sql`select s.*,u.name as owner_name from students s left join users u on u.id=s.owner_id where s.id=${detail} and ${access}`;
    if (student) {
      const [count] =
        await sql`select count(*)::int as total from activities where student_id=${detail}`;
      historyTotal = count.total;
      activities =
        await sql`select a.*,u.name as author from activities a join users u on u.id=a.author_id where a.student_id=${detail} order by a.created_at desc,a.id desc limit ${limit} offset ${historyPage.offset}`;
    }
  }
  return Response.json(
    {
      user,
      students,
      student,
      activities,
      followups,
      users,
      duplicates,
      duplicateTotal,
      stats,
      pagination: { page, limit, total },
      historyPagination: { page: historyPage.page, limit, total: historyTotal },
    },
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
      const history = async (id, kind, note, outcome = null, batchId = null) =>
        tx`insert into activities(student_id,author_id,kind,note,outcome,import_batch_id) values(${id},${user.id},${kind},${note},${outcome},${batchId})`;
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
      } else if (input.action === "duplicate") {
        manager();
        await tx`select pg_advisory_xact_lock(823407)`;
        const [review] =
          await tx`select * from duplicate_reviews where id=${input.id} and resolved_at is null for update`;
        if (!review) throw Error("Review already resolved");
        if (!["keep", "link"].includes(input.decision))
          throw Error("Invalid decision");
        if (input.decision === "link" && !review.candidate_id)
          throw Error(
            "The matching student was deleted; keep this record as a separate student",
          );
        if (input.decision === "keep") {
          const r = review.raw;
          const [s] =
            await tx`insert into students ${tx({ ...prepareRow(r, r.client), created_by_import_id: review.batch_id })} returning id`;
          await tx`update source_records set student_id=${s.id} where (${review.source_id}::uuid is not null and id=${review.source_id}) or (${review.source_id}::uuid is null and batch_id=${review.batch_id} and raw=${tx.json(r)})`;
          await history(
            s.id,
            "import",
            "Manager approved a separate student with shared phone",
            null,
            review.batch_id,
          );
        } else
          await history(
            review.candidate_id,
            "import",
            `Additional source linked: ${review.raw.client}. Imported details preserved in source records.`,
            null,
            review.batch_id,
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
