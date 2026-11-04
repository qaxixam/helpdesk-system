import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";
import { Ticket } from "@/models/Ticket";
import { ActivityLog } from "@/models/ActivityLog";
import { createStaffSchema, ROLES, updateUserSchema } from "@/lib/validations";
import {
  escapeRegex,
  jsonError,
  paginationMeta,
  parsePagination,
  readJson,
  validationError,
} from "@/lib/http";

/** Admin: users/agents list (paginated + search + role filter) */
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(["admin"]);
  if (!user) return errorResponse;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams, 10, 100);
    const role = searchParams.get("role");
    const search = searchParams.get("search")?.trim().slice(0, 80);
    const active = searchParams.get("active");

    const query: Record<string, unknown> = {};
    if (role && (ROLES as readonly string[]).includes(role)) query.role = role;
    if (active === "true") query.isActive = true;
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    const [users, totalCount] = await Promise.all([
      User.find(query).select("-password").sort({ role: 1, name: 1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    return NextResponse.json({ users, pagination: paginationMeta(page, limit, totalCount) });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return jsonError("Failed to load users", 500);
  }
}

/** Admin: role change / activate / deactivate */
export async function PATCH(req: NextRequest) {
  const { user: admin, errorResponse } = await requireAuth(["admin"]);
  if (!admin) return errorResponse;

  const parsed = updateUserSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const { userId, role, isActive } = parsed.data;

  // Admin khud ko lock-out na kar le
  if (userId === admin.id) return jsonError("You cannot change your own role or status", 400);

  try {
    await connectDB();
    const target = await User.findById(userId);
    if (!target) return jsonError("User not found", 404);

    const wasAgent = target.role === "agent" && target.isActive;
    if (role) target.role = role;
    if (typeof isActive === "boolean") target.isActive = isActive;
    await target.save();

    // Agar agent ab agent nahi raha (ya deactivate hua), us ke active tickets unassign kar do
    // taake woh queue mein phanse na rahein aur admin dobara assign kar sake
    let unassigned = 0;
    if (wasAgent && (target.role !== "agent" || !target.isActive)) {
      const orphaned = await Ticket.find({
        assignedAgent: target._id,
        status: { $nin: ["Resolved", "Closed"] },
      })
        .select("_id")
        .lean();
      if (orphaned.length) {
        await Ticket.updateMany({ _id: { $in: orphaned.map((t) => t._id) } }, { $set: { assignedAgent: null } });
        await ActivityLog.insertMany(
          orphaned.map((t) => ({
            ticket: t._id,
            actor: admin.id,
            action: "UNASSIGNED",
            details: `Unassigned because ${target.name} is no longer an active agent`,
          })),
        );
        unassigned = orphaned.length;
      }
    }

    return NextResponse.json({
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
      },
      unassignedTickets: unassigned,
    });
  } catch (error) {
    console.error("PATCH /api/users error:", error);
    return jsonError("Failed to update user", 500);
  }
}

/** Admin: naya staff account (agent / admin / user) banana */
export async function POST(req: NextRequest) {
  // Pehle yeh route bina auth ke khula tha — koi bhi khud ko admin bana sakta tha
  const { user: admin, errorResponse } = await requireAuth(["admin"]);
  if (!admin) return errorResponse;

  const parsed = createStaffSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();
    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) return jsonError("An account with this email already exists", 409);

    const created = await User.create({
      name: parsed.data.name,
      email,
      password: await bcrypt.hash(parsed.data.password, 12),
      role: parsed.data.role,
      facility: parsed.data.facility || "Support HQ",
      isActive: true,
    });

    return NextResponse.json(
      {
        user: {
          _id: created._id,
          name: created.name,
          email: created.email,
          role: created.role,
          isActive: created.isActive,
          facility: created.facility,
          createdAt: created.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/users error:", error);
    return jsonError("Failed to create user", 500);
  }
}
