import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  // No auth screens right now: the proxy drops guests into the demo account.
  void user;
  redirect("/dashboard");
}
