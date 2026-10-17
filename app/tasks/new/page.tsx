import { redirect } from "next/navigation";

export default function LegacyNewTaskPage() {
  redirect("/jobs/new");
}
