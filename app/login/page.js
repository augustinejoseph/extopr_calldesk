import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth.mjs";
import Workspace from "../../components/workspace";
export default async function LoginPage() {
  if (await currentUser()) redirect("/students");
  return <Workspace page="Login" />;
}
