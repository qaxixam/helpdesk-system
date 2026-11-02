import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations";

export async function GET() {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        await connectDB();
        const categories = await Category.find().sort({ name: 1 }).lean();
        return NextResponse.json({ categories });
    } catch (error) {
        console.error("GET /api/categories error:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Strict check: Only Admins can create new categories
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const parsed = categorySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        await connectDB();

        const exists = await Category.findOne({
            name: { $regex: new RegExp(`^${parsed.data.name}$`, "i") },
        });

        if (exists) {
            return NextResponse.json({ error: "Category already exists" }, { status: 409 });
        }

        const category = await Category.create(parsed.data);
        return NextResponse.json({ category }, { status: 201 });
    } catch (error) {
        console.error("POST /api/categories error:", error);
        return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }
}