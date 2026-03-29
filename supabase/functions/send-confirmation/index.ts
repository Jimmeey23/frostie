import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(value: string): string {
  return btoa(value);
}

async function readSmtpResponse(conn: Deno.Conn): Promise<string> {
  const chunks: string[] = [];
  const buf = new Uint8Array(1024);
  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;
    chunks.push(decoder.decode(buf.subarray(0, n)));
    const full = chunks.join("");
    const lines = full.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) continue;
    const last = lines[lines.length - 1];
    if (/^\d{3} /.test(last)) return full;
  }
  return chunks.join("");
}

async function writeSmtpCommand(conn: Deno.Conn, command: string, expectedCode: string): Promise<void> {
  await conn.write(encoder.encode(`${command}\r\n`));
  const response = await readSmtpResponse(conn);
  if (!response.startsWith(expectedCode)) {
    throw new Error(`SMTP ${command.split(" ")[0]} failed: ${response}`);
  }
}

interface ConfirmationRequest {
  to: string;
  memberName: string;
  membershipName: string;
  action: "freeze" | "unfreeze" | "restart";
  freezeStart?: string;
  freezeEnd?: string;
  resumeDate?: string;
  unfreezeDate?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function buildEmailHtml(data: ConfirmationRequest): string {
  const actionLabels: Record<string, string> = {
    freeze: "Membership Freeze Confirmation",
    unfreeze: "Membership Unfreeze Scheduled",
    restart: "Membership Restarted",
  };
  const title = actionLabels[data.action] || "Membership Update";

  let detailRows = "";
  if (data.action === "freeze") {
    detailRows = `
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Freeze Start</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${formatDate(data.freezeStart || "")}</td></tr>
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Freeze End</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${formatDate(data.freezeEnd || "")}</td></tr>
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Resume Date</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${formatDate(data.resumeDate || "")}</td></tr>
    `;
  } else if (data.action === "unfreeze") {
    detailRows = `
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Unfreeze Date</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${formatDate(data.unfreezeDate || "")}</td></tr>
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Resume Date</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${formatDate(data.resumeDate || "")}</td></tr>
    `;
  } else {
    detailRows = `
      <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;" colspan="2">Your membership has been restarted and is now active.</td></tr>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a3a6e 0%,#2563eb 50%,#3b82f6 100%);padding:32px 40px;text-align:center;">
          <img src="https://i.postimg.cc/CKMBs88m/logo-1.png" alt="Physique 57 India" width="120" style="margin-bottom:16px;" />
          <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">${title}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Hi <strong>${data.memberName}</strong>,</p>
          <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6;">
            ${data.action === "freeze"
              ? "Your membership freeze has been confirmed. Here are the details:"
              : data.action === "unfreeze"
              ? "Your membership unfreeze has been scheduled. Here are the details:"
              : "Your membership has been successfully restarted."}
          </p>
          <!-- Details Table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
            <tr><td style="padding:8px 16px;color:#64748b;font-size:14px;">Membership</td><td style="padding:8px 16px;font-weight:600;color:#1e293b;font-size:14px;">${data.membershipName}</td></tr>
            ${detailRows}
          </table>
          <p style="font-size:13px;color:#94a3b8;line-height:1.5;margin:0;">
            If you have any questions, reach us on WhatsApp at <a href="https://wa.me/919769570178" style="color:#2563eb;text-decoration:none;">+91 97695 70178</a> or reply to this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} Physique 57 India. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const data = (await req.json()) as ConfirmationRequest;
    if (!data.to || !data.memberName || !data.membershipName || !data.action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("MAILTRAP_TOKEN") || "";
    if (!token) throw new Error("Mailtrap token not configured");

    const html = buildEmailHtml(data);
    const actionLabels: Record<string, string> = {
      freeze: "Membership Freeze Confirmation",
      unfreeze: "Membership Unfreeze Scheduled",
      restart: "Membership Restarted",
    };
    const subject = `${actionLabels[data.action] || "Membership Update"} — Physique 57 India`;
    const fromEmail = "hello@physique57india.com";
    const fromName = "Physique 57 India";

    const smtpUsers = ["api", "apismtp@mailtrap.io"];
    let lastError: Error | null = null;

    for (const smtpUser of smtpUsers) {
      let conn: Deno.Conn | null = null;
      try {
        conn = await Deno.connectTls({ hostname: "live.smtp.mailtrap.io", port: 465 });
        const banner = await readSmtpResponse(conn);
        if (!banner.startsWith("220")) throw new Error(`Banner: ${banner}`);

        await writeSmtpCommand(conn, "EHLO physique57india.com", "250");
        await writeSmtpCommand(conn, "AUTH LOGIN", "334");
        await writeSmtpCommand(conn, toBase64(smtpUser), "334");
        await writeSmtpCommand(conn, toBase64(token), "235");
        await writeSmtpCommand(conn, `MAIL FROM:<${fromEmail}>`, "250");
        await writeSmtpCommand(conn, `RCPT TO:<${data.to}>`, "250");
        await writeSmtpCommand(conn, "DATA", "354");

        const boundary = `----=_Part_${Date.now()}`;
        const message = [
          `From: ${fromName} <${fromEmail}>`,
          `To: ${data.to}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          "",
          `Hi ${data.memberName}, your membership (${data.membershipName}) has been ${data.action === "freeze" ? "frozen" : data.action === "unfreeze" ? "scheduled for unfreeze" : "restarted"}. Check your email for details.`,
          "",
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          "",
          html,
          "",
          `--${boundary}--`,
          "",
          ".",
        ].join("\r\n");

        await conn.write(encoder.encode(`${message}\r\n`));
        const resp = await readSmtpResponse(conn);
        if (!resp.startsWith("250")) throw new Error(`DATA failed: ${resp}`);
        await writeSmtpCommand(conn, "QUIT", "221");
        conn.close();

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("SMTP error");
        if (conn) { try { conn.close(); } catch {} }
      }
    }

    throw lastError || new Error("Failed to send confirmation email");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("send-confirmation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
