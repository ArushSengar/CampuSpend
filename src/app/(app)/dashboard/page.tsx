import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { buildOverview } from "@/lib/overview";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardSkeleton } from "./loading";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await buildOverview(user.id, user.name, user.monthlyIncome);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardView data={data} />
    </Suspense>
  );
}
