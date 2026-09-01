import { Suspense } from "react";
import { TransactionsClient } from "./transactions-client";
import { TransactionsSkeleton } from "./loading";

export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsClient />
    </Suspense>
  );
}
