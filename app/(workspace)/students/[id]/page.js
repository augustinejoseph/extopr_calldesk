import { notFound, redirect } from "next/navigation";
import { currentUser } from "../../../../lib/auth.mjs";
import Workspace from "../../../../components/workspace";
export default async function StudentPage({ params }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  return <Workspace page="Students" studentId={id} />;
}
