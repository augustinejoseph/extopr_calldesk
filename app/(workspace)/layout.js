import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth.mjs";
export default async function WorkspaceLayout({ children }) {
  if (!(await currentUser())) redirect("/login");
  return children;
}
