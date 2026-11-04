import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { registerSchema } from "@/lib/validations";
import { jsonError, readJson, validationError } from "@/lib/http";

export async function POST(req: NextRequest) {
  const parsed = registerSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();
    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) return jsonError("An account with this email already exists", 409);

    // Public registration se hamesha "user" role hi banta hai — role body se kabhi nahi liya jata
    const created = await User.create({
      name: parsed.data.name,
      email,
      password: await bcrypt.hash(parsed.data.password, 12),
      role: "user",
      facility: parsed.data.facility,
      isActive: true,
    });

    return NextResponse.json(
      { message: "Account created", user: { id: created._id.toString(), name: created.name, email: created.email } },
      { status: 201 },
    );
  } catch (error) {
    // Race condition: do requests same email ke sath — unique index error
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return jsonError("An account with this email already exists", 409);
    }
    console.error("Registration error:", error);
    return jsonError("Internal server error", 500);
  }
}
