import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { syncSLAsAndAutoClose } from "@/lib/ticket-lifecycle";

export async function POST() {
    try {
        await connectDB();
        const result = await syncSLAsAndAutoClose();
        return NextResponse.json({
            message: "SLA & 3-Day Auto-Close check completed",
            ...result,
        });
    } catch (error) {
        console.error("SLA Cron error:", error);
        return NextResponse.json(
            { error: "Failed to sync SLA rules" },
            { status: 500 }
        );
    }
}