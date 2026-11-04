import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Category } from "@/models/Category";
import { Ticket } from "@/models/Ticket";
import { updateCategorySchema } from "@/lib/validations";
import { escapeRegex, isObjectId, jsonError, readJson, validationError } from "@/lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth(["admin"]);
  if (!user) return errorResponse;

  const { id } = await context.params;
  if (!isObjectId(id)) return jsonError("Invalid category ID", 400);

  const parsed = updateCategorySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();
    if (parsed.data.name) {
      const clash = await Category.exists({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escapeRegex(parsed.data.name)}$`, "i") },
      });
      if (clash) return jsonError("A category with this name already exists", 409);
    }
    const category = await Category.findByIdAndUpdate(id, { $set: parsed.data }, { returnDocument: "after", runValidators: true }).lean();
    if (!category) return jsonError("Category not found", 404);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("PATCH /api/categories/[id] error:", error);
    return jsonError("Failed to update category", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth(["admin"]);
  if (!user) return errorResponse;

  const { id } = await context.params;
  if (!isObjectId(id)) return jsonError("Invalid category ID", 400);

  try {
    await connectDB();
    // Tickets ka reference toot na jaye
    const inUse = await Ticket.countDocuments({ category: id });
    if (inUse > 0) {
      return jsonError(`This category is used by ${inUse} ticket(s) and cannot be deleted`, 409);
    }
    const deleted = await Category.findByIdAndDelete(id).lean();
    if (!deleted) return jsonError("Category not found", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return jsonError("Failed to delete category", 500);
  }
}
