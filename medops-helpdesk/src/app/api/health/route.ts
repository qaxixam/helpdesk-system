import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down" });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }
}