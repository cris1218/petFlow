import { redirect } from "next/navigation";

export default function DashboardLeadsRedirect() {
  redirect("/admin/leads");
}
