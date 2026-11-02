import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Handle both direct invocation and Supabase Database Webhook payload
    const record = body.record || body;

    const deviceId = (record.device_id || "UNKNOWN").trim().toUpperCase();
    const storeName = (record.store_name || "Tindahan Store").trim();
    const phoneNumber = (record.phone_number || "Hindi tinukoy").trim();
    const gcashRef = (record.gcash_reference || "").trim();
    const amount = Number(record.amount || 299).toFixed(2);
    const timeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || 587);
    const smtpUser = Deno.env.get("SMTP_USER") || "dleiszarjeisaltherlagariza@gmail.com";
    const smtpPass = Deno.env.get("SMTP_PASS") || "shovlrwmbyuhaqik";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "dleiszarjeisaltherlagariza@gmail.com";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const subject = `🔔 [Tindahan Helper Pro] Bagong Bayad: ${storeName} (Ref: ${gcashRef})`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bagong Bayad - Tindahan Helper Pro</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <div style="background: #047857; color: #ffffff; padding: 24px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 800;">🎉 May Bagong Nagbayad ng Pro License!</h1>
      <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Startup Tindahan Helper Realtime Payment Alert</p>
    </div>

    <div style="padding: 24px 20px;">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <span style="font-size: 13px; color: #166534; font-weight: 600;">Status: 🟡 PENDING APPROVAL</span>
        <p style="margin: 4px 0 0; font-size: 12px; color: #15803d;">Nagsumite ng patunay ng bayad ang tindahan. Mangyaring i-verify ang GCash reference bago i-approve.</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; width: 140px; font-weight: 500;">Tindahan ID:</td>
          <td style="padding: 10px 0; font-weight: 800; color: #047857; font-family: monospace; font-size: 16px;">${deviceId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 500;">Tindahan:</td>
          <td style="padding: 10px 0; font-weight: 700; color: #0f172a;">${storeName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 500;">Numero ng Telepono:</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${phoneNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 500;">GCash Reference:</td>
          <td style="padding: 10px 0; font-weight: 800; color: #0284c7; font-family: monospace; font-size: 16px;">${gcashRef}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 500;">Halaga ng Bayad:</td>
          <td style="padding: 10px 0; font-weight: 800; color: #0f172a; font-size: 16px;">₱${amount}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #64748b; font-weight: 500;">Oras ng Tala:</td>
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">${timeStr} (PHT)</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
        <a href="https://tindahanhelper.wuaze.com/gg.php" 
           style="background: #047857; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; display: inline-block;">
          🚀 Buksan ang gg.php para I-approve
        </a>
      </div>

      <p style="text-align: center; margin: 0; font-size: 12px; color: #94a3b8;">
        Diretsong link: <a href="https://tindahanhelper.wuaze.com/gg.php" style="color: #047857;">https://tindahanhelper.wuaze.com/gg.php</a>
      </p>
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 20px; text-align: center; font-size: 11px; color: #94a3b8;">
      Startup Tindahan Helper &copy; 2026. Awtomatikong ipinadala mula sa Supabase Cloud.
    </div>
  </div>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: `"Startup Tindahan Helper" <${smtpUser}>`,
      to: adminEmail,
      subject,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
