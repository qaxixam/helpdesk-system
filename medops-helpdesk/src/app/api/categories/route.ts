import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Category } from "@/models/Category";
import { Ticket } from "@/models/Ticket";
import { categorySchema } from "@/lib/validations";
import { escapeRegex, jsonError, readJson, validationError } from "@/lib/http";

/** Sab logged-in users ko categories chahiye (ticket form ke liye). Admin ko ticket counts bhi milte hain. */
export async function GET() {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  try {
    await connectDB();
    const categories = await Category.find().sort({ name: 1 }).limit(200).lean();

    if (user.role !== "admin") return NextResponse.json({ categories });

    const counts = await Ticket.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.count]));
    return NextResponse.json({
      categories: categories.map((c) => ({ ...c, ticketCount: byId.get(c._id.toString()) || 0 })),
    });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return jsonError("Failed to fetch categories", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(["admin"]);
  if (!user) return errorResponse;

  const parsed = categorySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();
    // Regex input escape kiya gaya hai (pehle raw user input RegExp mein ja raha tha)
    const exists = await Category.exists({
      name: { $regex: new RegExp(`^${escapeRegex(parsed.data.name)}$`, "i") },
    });
    if (exists) return jsonError("A category with this name already exists", 409);

    const category = await Category.create(parsed.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("POST /api/categories error:", error);
    return jsonError("Failed to create category", 500);
  }
}
