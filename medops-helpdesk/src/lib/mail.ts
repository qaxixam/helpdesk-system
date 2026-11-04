import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailPayload {
  to: string | string[];
  subject: string;
  ticketNumber: string;
  title: string;
  headline: string;
  bodyText: string;
  status?: string;
  priority?: string;
  ticketId?: string;
}

/** User-supplied text ko HTML email mein dalne se pehle escape karna zaroori hai (HTML injection). */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let transporter: Transporter | null = null;

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass || user.includes("your-email") || pass.includes("your-16-digit")) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/**
 * Email bhejta hai. Errors throw nahi karta (notification fail hone se request fail nahi honi chahiye),
 * lekin caller ko `await` karna chahiye — Vercel serverless par response ke baad ka kaam kill ho jata hai.
 */
export async function sendTicketEmail(payload: EmailPayload) {
  const recipients = (Array.isArray(payload.to) ? payload.to : [payload.to]).filter(Boolean);
  if (recipients.length === 0) return;

  const t = getTransporter();
  if (!t) {
    console.log(`[mail:simulated] to=${recipients.join(",")} subject="[${payload.ticketNumber}] ${payload.subject}"`);
    return;
  }

  const e = escapeHtml;
  const link = payload.ticketId ? `${appUrl()}/tickets/${payload.ticketId}` : appUrl();
  const body = e(payload.bodyText).replace(/\n/g, "<br/>");

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
    <div style="background:#0b3b3c;color:#ecfdf5;padding:16px 24px">
      <strong style="font-size:15px">MedOps Helpdesk</strong>
      <span style="float:right;font-family:monospace;font-size:12px;color:#5eead4">${e(payload.ticketNumber)}</span>
    </div>
    <div style="padding:24px;color:#18181b;background:#ffffff">
      <h2 style="margin:0 0 8px;font-size:18px">${e(payload.headline)}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.55">${body}</p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px;font-size:13px">
        <div><strong>Ticket:</strong> ${e(payload.ticketNumber)} — ${e(payload.title)}</div>
        ${payload.status ? `<div style="margin-top:6px"><strong>Status:</strong> ${e(payload.status)}</div>` : ""}
        ${payload.priority ? `<div style="margin-top:6px"><strong>Priority:</strong> ${e(payload.priority)}</div>` : ""}
      </div>
      <a href="${e(link)}" style="display:inline-block;margin-top:20px;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600">Open ticket</a>
      <p style="margin-top:20px;font-size:12px;color:#a1a1aa">Automated notification — please do not reply to this email.</p>
    </div>
  </div>`;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `"MedOps Helpdesk" <${process.env.SMTP_USER}>`,
      to: recipients.join(","),
      subject: `[${payload.ticketNumber}] ${payload.subject}`,
      html,
      text: `${payload.headline}\n\n${payload.bodyText}\n\n${link}`,
    });
  } catch (err) {
    console.error("[mail] send failed (non-blocking):", err);
  }
}
