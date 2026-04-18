"use server";

import { Resend } from "resend";

/**
 * Sends a friendly email with the time-limited report preview URL.
 * Failures are swallowed so checkout / redirect flow is never blocked.
 */
export async function sendReportPreviewLinkEmail(params: {
  to: string;
  customerName: string;
  previewUrl: string;
  vin: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.to?.trim()) {
    return;
  }

  const resend = new Resend(apiKey);
  const name = params.customerName?.trim() || "there";

  try {
    await resend.emails.send({
      from:
        process.env.RESEND_EMAIL ||
        "TrueK Inspection <noreply@truekinspection.com>",
      to: params.to.trim(),
      subject: "Your TrueK vehicle report is ready",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #b71c1c; margin-top: 0;">Thanks for your purchase, ${name}</h2>
          <p>Your payment went through successfully. You can open your full vehicle history report anytime using the secure link below.</p>
          <p style="margin: 20px 0;">
            <a href="${params.previewUrl}" style="display: inline-block; background: #b71c1c; color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold;">
              View your report
            </a>
          </p>
          <p style="font-size: 14px; color: #555;">
            <strong>VIN:</strong> ${params.vin}<br/>
            This link stays active for <strong>24 hours</strong> so you can return to your report later. If it expires, contact us and we will help.
          </p>
          <p style="font-size: 13px; color: #888;">If the button does not work, copy and paste this URL into your browser:<br/>
          <span style="word-break: break-all;">${params.previewUrl}</span></p>
          <p style="font-size: 13px; color: #888;">— TrueK Inspection</p>
        </div>
      `,
    });
  } catch {
    // Silent: do not block user flow on email failure
  }
}
