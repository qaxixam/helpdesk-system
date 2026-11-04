import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/http";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel serverless request body limit 4.5 MB hai

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function configureCloudinary() {
  const clean = (v?: string) => v?.trim().replace(/^['"]|['"]$/g, "");
  const cloud_name = clean(process.env.CLOUDINARY_CLOUD_NAME);
  const api_key = clean(process.env.CLOUDINARY_API_KEY);
  const api_secret = clean(process.env.CLOUDINARY_API_SECRET);
  if (!cloud_name || !api_key || !api_secret || cloud_name.includes("your_cloud_name")) return false;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return true;
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  if (!configureCloudinary()) {
    return jsonError("File uploads are not configured on the server", 503);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);
    if (file.size === 0) return jsonError("File is empty", 400);
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("File is larger than 4 MB", 413);
    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError("Unsupported file type. Use images, PDF, text, Word or Excel files.", 415);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "medops_attachments",
      resource_type: file.type.startsWith("image/") ? "image" : "raw",
      use_filename: true,
      unique_filename: true,
    });

    return NextResponse.json({
      attachment: {
        name: file.name.slice(0, 200),
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      },
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return jsonError("Upload failed. Please try again.", 500);
  }
}
