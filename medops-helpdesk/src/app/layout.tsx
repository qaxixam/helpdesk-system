import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers"; // 👈 Yeh nayi line add karein

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MedOps IT Helpdesk",
  description: "B2B Healthcare IT Support System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning humne pehle hi add kiya tha
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} min-h-screen bg-[#F4F6FB] font-sans text-slate-900 antialiased overflow-x-hidden max-w-full w-full`}>
        {/* 🚀 FIX: Ab puri app SessionProvider ke andar safe hai */}
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}