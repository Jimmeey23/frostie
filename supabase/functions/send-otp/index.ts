import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface OtpRequest {
  to: string;
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  otpLength?: number;
  expiryMinutes?: number;
  mailtrapToken?: string;
  smtpUser?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(value: string): string {
  return btoa(value);
}

function randomOtp(length = 6): string {
  const size = Math.max(4, Math.min(8, length));
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
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

async function sendOtpEmail(payload: Required<Pick<OtpRequest, "to">> & OtpRequest, otp: string): Promise<void> {
  const host = "live.smtp.mailtrap.io";
  const port = 465;
  const fromEmail = payload.fromEmail || "hello@physique57india.com";
  const fromName = payload.fromName || "Physique 57 India";
  const subject = payload.subject || "Your verification code";
  const expiryMinutes = Math.max(1, Math.min(30, payload.expiryMinutes || 10));
  const token = payload.mailtrapToken || Deno.env.get("MAILTRAP_TOKEN") || "";
  if (!token) throw new Error("Mailtrap token is required");

  const smtpUsers = [payload.smtpUser || "api", "apismtp@mailtrap.io"];
  let lastError: Error | null = null;

  for (const smtpUser of smtpUsers) {
    let conn: Deno.Conn | null = null;
    try {
      conn = await Deno.connectTls({ hostname: host, port });
      const banner = await readSmtpResponse(conn);
      if (!banner.startsWith("220")) throw new Error(`SMTP banner error: ${banner}`);

      await writeSmtpCommand(conn, "EHLO physique57india.com", "250");
      await writeSmtpCommand(conn, "AUTH LOGIN", "334");
      await writeSmtpCommand(conn, toBase64(smtpUser), "334");
      await writeSmtpCommand(conn, toBase64(token), "235");
      await writeSmtpCommand(conn, `MAIL FROM:<${fromEmail}>`, "250");
      await writeSmtpCommand(conn, `RCPT TO:<${payload.to}>`, "250");
      await writeSmtpCommand(conn, "DATA", "354");

      const textBody = `Your OTP code is ${otp}. It expires in ${expiryMinutes} minutes.`;
      const message = [
        `From: ${fromName} <${fromEmail}>`,
        `To: ${payload.to}`,
        `Subject: ${subject}`,
        "",
        textBody,
        "",
        ".",
      ].join("\r\n");

      await conn.write(encoder.encode(`${message}\r\n`));
      const dataResp = await readSmtpResponse(conn);
      if (!dataResp.startsWith("250")) throw new Error(`SMTP DATA failed: ${dataResp}`);
      await writeSmtpCommand(conn, "QUIT", "221");
      conn.close();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown SMTP error");
      if (conn) { try { conn.close(); } catch { /* no-op */ } }
    }
  }
  throw lastError || new Error("Failed to send OTP email");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as OtpRequest;
    const to = (body.to || "").trim();
    if (!to) {
      return new Response(JSON.stringify({ success: false, error: "Recipient email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const otp = randomOtp(body.otpLength || 6);
    await sendOtpEmail({ ...body, to }, otp);
    return new Response(JSON.stringify({ success: true, otp }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
