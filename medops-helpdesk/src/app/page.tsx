import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// 🚀 FIX: Next.js 16 ke naye 'cacheComponents' ke mutabiq dynamic route ko handle karna
export const instant = false;

export default async function HomePage() {
  // Auth check (yeh automatically headers/cookies read karta hai)
  const session = await auth();

  // Agar logged in nahi hai toh Login page par bhejein
  if (!session?.user) {
    redirect("/login");
  }

  // Agar logged in hai toh Role ke hisab se sahi dashboard par bhejein
  if (session.user.role === "admin") {
    redirect("/admin");
  } else {
    redirect("/dashboard");
  }
}