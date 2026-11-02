import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;

        // 1. Fetch Variables
        const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const rawApiKey = process.env.CLOUDINARY_API_KEY;
        const rawApiSecret = process.env.CLOUDINARY_API_SECRET;

        // 🔴 DEBUG RADAR: Terminal mein check karte hain kya masla hai
        console.log("\n================ CLOUDINARY DEBUG RADAR ================");
        console.log("Cloud Name:", rawCloudName ? `Loaded (${rawCloudName})` : "MISSING");
        console.log("API Key   :", rawApiKey ? `Loaded (${rawApiKey})` : "MISSING");
        console.log("Secret Exists? :", !!rawApiSecret);
        console.log("Secret Length  :", rawApiSecret ? rawApiSecret.length : 0);
        console.log("Has Space at End?  :", rawApiSecret?.endsWith(" "));
        console.log("Starts with Quote? :", rawApiSecret?.startsWith('"') || rawApiSecret?.startsWith("'"));
        console.log("========================================================\n");

        if (rawCloudName && rawApiKey && rawApiSecret && !rawCloudName.includes("your_cloud_name")) {

            // 2. Fix Typo/Spaces Automatically (Trim removes hidden spaces)
            const cleanName = rawCloudName.trim().replace(/['"]/g, '');
            const cleanKey = rawApiKey.trim().replace(/['"]/g, '');
            const cleanSecret = rawApiSecret.trim().replace(/['"]/g, '');

            cloudinary.config({
                cloud_name: cleanName,
                api_key: cleanKey,
                api_secret: cleanSecret,
            });

            console.log("Attempting Cloudinary API Upload...");

            try {
                const uploaded = await cloudinary.uploader.upload(base64Data, {
                    folder: "medops_attachments",
                    resource_type: "auto",
                });

                console.log("✅ CLOUDINARY UPLOAD SUCCESS!");
                return NextResponse.json({
                    attachment: { name: file.name, url: uploaded.secure_url, publicId: uploaded.public_id },
                });
            } catch (cloudinaryError) {
                console.error("❌ CLOUDINARY API ERROR:", cloudinaryError);
                // Do not fallback here in debug mode, let's see the error
                return NextResponse.json({ error: "Cloudinary upload failed (Check terminal)" }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Cloudinary variables not found in .env.local" }, { status: 400 });

    } catch (error) {
        console.error("System Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}