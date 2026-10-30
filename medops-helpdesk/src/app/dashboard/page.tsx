import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardTestPage() {
    const session = await auth();

    // Server-Side Protection: Agar login nahi hai toh wapas /login par bhej do
    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
                <h1 className="text-xl font-semibold">
                    ✅ MedOps Server Session Active
                </h1>
                <p className="text-sm text-slate-600">
                    Logged in as: <strong>{session.user.name}</strong> ({session.user.email})
                </p>
                <div className="flex gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded bg-slate-900 text-white uppercase">
                        ROLE: {session.user.role}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                        FACILITY: {session.user.facility}
                    </span>
                </div>

                <form
                    action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/login" });
                    }}
                    className="pt-4"
                >
                    <Button type="submit" variant="outline" size="sm">
                        Sign Out
                    </Button>
                </form>
            </div>
        </div>
    );
}