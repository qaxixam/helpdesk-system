import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  ticketNumber: string;
  title: string;
  headline: string;
  bodyText: string;
  status?: string;
  priority?: string;
}

export async function sendTicketEmail(payload: EmailPayload) {
  const {
    to,
    subject,
    ticketNumber,
    title,
    headline,
    bodyText,
    status,
    priority,
  } = payload;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #0f172a; color: #f8fafc; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center;">
        <strong style="font-size: 16px;">MedOps IT-SOC</strong>
        <span style="font-family: monospace; font-size: 12px; color: #2dd4bf;">${ticketNumber}</span>
      </div>
      <div style="padding: 24px; color: #1e293b; background: #ffffff;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px;">${headline}</h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569;">${bodyText}</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 13px;">
          <div><strong>Incident:</strong> ${ticketNumber} — ${title}</div>
          ${status ? `<div style="margin-top: 6px;"><strong>Status:</strong> ${status}</div>` : ""}
          ${priority ? `<div style="margin-top: 6px;"><strong>Priority:</strong> ${priority}</div>` : ""}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">
          HIPAA Automated Notification — MedOps Clinical Infrastructure Desk
        </p>
      </div>
    </div>
  `;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Agar .env.local mein asli Gmail SMTP credentials abhi nahi dale, toh crash na kare
  if (
    !smtpUser ||
    !smtpPass ||
    smtpUser.includes("your-email") ||
    smtpPass.includes("your-16-digit")
  ) {
    console.log(
      `📧 [MAIL SIMULATION] To: ${to} | Subject: [${ticketNumber}] ${subject}`
    );
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"MedOps IT Support" <${smtpUser}>`,
      to,
      subject: `[${ticketNumber}] ${subject}`,
      html,
    });
    console.log(`✅ Email sent to ${to} for ${ticketNumber}`);
  } catch (err) {
    console.error("⚠️ Failed to send SMTP email (non-blocking):", err);
  }
}