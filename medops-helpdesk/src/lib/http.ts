import mongoose from "mongoose";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value);
}

export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validationError(error: ZodError) {
  const flat = error.flatten();
  const first = Object.values(flat.fieldErrors).flat()[0] || flat.formErrors[0] || "Validation failed";
  return NextResponse.json({ error: first, details: flat.fieldErrors }, { status: 400 });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function parsePagination(searchParams: URLSearchParams, defaultLimit = 10, maxLimit = 50) {
  const page = Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(searchParams.get("limit"))) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, totalCount: number) {
  return { page, limit, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) };
}
