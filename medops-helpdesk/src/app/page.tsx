import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connection } from "next/server";

export default async function HomePage() {
  // Naya Next.js 16 tareeqa: Yeh line page ko automatically server-side (dynamic) bana degi
  await connection();

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Role-based smart redirection
  if (session.user.role === "admin") {
    redirect("/admin");
  } else {
    redirect("/dashboard");
  }
}