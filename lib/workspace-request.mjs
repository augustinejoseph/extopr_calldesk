import { workspacePages } from "./navigation.mjs";

export function workspaceQuery(
  page,
  {
    pageNumber = 1,
    search = "",
    status = "",
    follow = "",
    studentId = null,
    now = new Date(),
  } = {},
) {
  if (studentId || page === "Login" || page === "Import students") return null;
  if (!workspacePages.some((p) => p.label === page)) return null;
  const query = new URLSearchParams({ view: page });
  if (page !== "Overview") query.set("page", pageNumber);
  if (page === "Students" || page === "Unassigned pool") {
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (follow) query.set("follow", follow);
    if (follow === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.set("dayStart", start.toISOString());
      query.set("dayEnd", end.toISOString());
    }
  }
  return query;
}
