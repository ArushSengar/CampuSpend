import { Skeleton } from "@/components/ui/feedback";

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[22rem] rounded-card xl:col-span-2" />
        <Skeleton className="h-[22rem] rounded-card" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[15rem] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[26rem] rounded-card" />
        <Skeleton className="h-[26rem] rounded-card" />
      </div>
    </div>
  );
}

export default function Loading() {
  return <DashboardSkeleton />;
}
