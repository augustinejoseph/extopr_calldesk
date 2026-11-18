import { redirect } from "next/navigation";
import { currentUser } from "./auth.mjs";
import Workspace from "../components/workspace";
export async function workspacePage(page, managerOnly = false) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (managerOnly && user.role !== "manager") redirect("/students");
  return <Workspace page={page} />;
}
