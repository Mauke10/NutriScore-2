import { redirect } from "next/navigation";
import { currentPerson } from "../../lib/auth";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  const me = currentPerson();
  if (!me) redirect("/login");
  return <DashboardClient me={me} />;
}
