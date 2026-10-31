import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Max 4MB per file check
        if (file.size > 4 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size must be under 4MB" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        // Agar baad mein Cloudinary keys dalenge toh Cloudinary par upload hoga
        if (
            cloudName &&
            apiKey &&
            apiSecret &&
            !cloudName.includes("your_cloud_name")
        ) {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
            });

            const uploaded = await cloudinary.uploader.upload(base64Data, {
                folder: "medops_attachments",
                resource_type: "auto",
            });

            return NextResponse.json({
                attachment: {
                    name: file.name,
                    url: uploaded.secure_url,
                    publicId: uploaded.public_id,
                },
            });
        }

        // Fallback: Bina Cloudinary ke bhi file attachment 100% kaam karegi
        return NextResponse.json({
            attachment: {
                name: file.name,
                url: base64Data,
                publicId: `local_${Date.now()}`,
            },
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "File upload failed" },
            { status: 500 }
        );
    }
}