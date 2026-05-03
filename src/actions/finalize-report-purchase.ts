"use server";

import { randomBytes } from "crypto";
import { Resend } from "resend";
import db from "@/lib/db";
import { getOwnerEmail, shouldSendOwnerCopy } from "@/lib/emails/owner-inbox";
import {
  buildPaymentSuccessEmailHtml,
  buildReportDeliveryEmailHtml,
} from "@/lib/emails/templates";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function appOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://www.truekinspection.com";
  return raw.replace(/\/+$/, "");
}

function splitCustomerName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const t = displayName.trim();
  if (!t) return { firstName: "Customer", lastName: "" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

/** Best-effort Paddle overlay checkout payload parsing. */
function parsePaddleCheckoutMeta(data: Record<string, unknown>): {
  transactionId: string | null;
  amountDisplay: string;
  currency: string;
} {
  let transactionId: string | null = null;
  const tryId = (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

  transactionId =
    tryId(data.transaction_id) ||
    tryId(data.transactionId) ||
    tryId(data.id);

  const tx = data.transaction;
  if (!transactionId && tx && typeof tx === "object") {
    const tid = (tx as Record<string, unknown>).id;
    transactionId = tryId(tid);
  }

  let amountDisplay = "49.00";
  let currency = "USD";

  const totals = data.totals;
  if (totals && typeof totals === "object") {
    const t = totals as Record<string, unknown>;
    const grand = t.grand_total ?? t.total;
    if (typeof grand === "string" && grand.trim()) amountDisplay = grand.trim();
    else if (typeof grand === "number") amountDisplay = grand.toFixed(2);
    const cur = t.currency_code ?? t.currency;
    if (typeof cur === "string" && cur.trim()) currency = cur.trim();
  }

  const details = data.details;
  if (details && typeof details === "object") {
    const d = details as Record<string, unknown>;
    const tot = d.totals;
    if (tot && typeof tot === "object") {
      const t2 = tot as Record<string, unknown>;
      const grand = t2.grand_total ?? t2.total;
      if (typeof grand === "string" && grand.trim()) amountDisplay = grand.trim();
      else if (typeof grand === "number") amountDisplay = grand.toFixed(2);
      const cur = t2.currency_code ?? t2.currency;
      if (typeof cur === "string" && cur.trim()) currency = cur.trim();
    }
  }

  return { transactionId, amountDisplay, currency };
}

export type FinalizeReportPurchaseInput = {
  html: string;
  vin: string;
  clearvinReportId?: string | null;
  customerEmail: string;
  customerDisplayName: string;
  paddleCheckoutData: Record<string, unknown>;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
};

/**
 * After successful Paddle payment: persist payment + report token, then send
 * payment confirmation and report delivery emails (DB first — no emails on DB failure).
 */
export async function finalizeReportPurchase(
  input: FinalizeReportPurchaseInput,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const email = input.customerEmail.trim();
  if (!email) {
    return { success: false, error: "Customer email is required." };
  }
  if (!input.html?.trim()) {
    return { success: false, error: "Report HTML is missing." };
  }
  if (!input.vin?.trim()) {
    return { success: false, error: "VIN is required." };
  }

  const { firstName, lastName } = splitCustomerName(input.customerDisplayName);
  const { transactionId, amountDisplay, currency } = parsePaddleCheckoutMeta(
    input.paddleCheckoutData,
  );

  const token = generateToken();
  const expiresAt = new Date(Date.now() + ONE_DAY_MS);
  const reportIdStr = input.clearvinReportId?.trim() || null;

  try {
    await db.$transaction(async (tx) => {
      await tx.reportPreviewToken.create({
        data: {
          token,
          html: input.html,
          vin: input.vin.trim(),
          clearvinReportId: reportIdStr,
          expiresAt,
        },
      });
      await tx.payment.create({
        data: {
          firstName,
          lastName,
          email,
          plan: "Vehicle History Report — $49",
          orderID: transactionId ?? undefined,
          status: "COMPLETED",
        },
      });
    });
  } catch (e) {
    console.error("[finalizeReportPurchase] DB transaction failed", e);
    return {
      success: false,
      error: "We could not save your order. Please contact support.",
    };
  }

  const origin = appOrigin();
  const reportUrl = `${origin}/report-preview?token=${encodeURIComponent(token)}&vin=${encodeURIComponent(input.vin.trim())}`;
  const orderRef = transactionId ?? token.slice(0, 12);
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_EMAIL ||
    "TrueK Inspection <noreply@truekinspection.com>";

  if (apiKey) {
    const resend = new Resend(apiKey);
    const customerLabel =
      [firstName, lastName].filter(Boolean).join(" ").trim() || "Customer";

    try {
      await resend.emails.send({
        from,
        to: email,
        subject: "Payment received — TrueK Inspection",
        html: buildPaymentSuccessEmailHtml({
          customerName: customerLabel,
          orderId: orderRef,
          amountDisplay,
          currency,
          vin: input.vin.trim(),
        }),
      });
    } catch (e) {
      console.error("[finalizeReportPurchase] payment confirmation email", e);
    }

    try {
      await resend.emails.send({
        from,
        to: email,
        subject: "Your vehicle history report — TrueK Inspection",
        html: buildReportDeliveryEmailHtml({
          customerName: customerLabel,
          reportUrl,
          vin: input.vin.trim(),
          vehicleYear: input.vehicleYear,
          vehicleMake: input.vehicleMake,
          vehicleModel: input.vehicleModel,
        }),
      });
    } catch (e) {
      console.error("[finalizeReportPurchase] report delivery email", e);
    }

    const owner = getOwnerEmail();
    if (owner && shouldSendOwnerCopy(email)) {
      try {
        await resend.emails.send({
          from,
          to: owner,
          subject: `[TrueK] New payment — ${input.vin.trim()}`,
          html: buildPaymentSuccessEmailHtml({
            customerName: customerLabel,
            orderId: orderRef,
            amountDisplay,
            currency,
            vin: input.vin.trim(),
            forOwner: true,
            customerEmail: email,
          }),
        });
      } catch (e) {
        console.error("[finalizeReportPurchase] owner payment email", e);
      }
      try {
        await resend.emails.send({
          from,
          to: owner,
          subject: `[TrueK] Report delivered — ${input.vin.trim()}`,
          html: buildReportDeliveryEmailHtml({
            customerName: customerLabel,
            reportUrl,
            vin: input.vin.trim(),
            vehicleYear: input.vehicleYear,
            vehicleMake: input.vehicleMake,
            vehicleModel: input.vehicleModel,
            forOwner: true,
            customerEmail: email,
          }),
        });
      } catch (e) {
        console.error("[finalizeReportPurchase] owner report email", e);
      }
    }
  } else {
    console.warn("[finalizeReportPurchase] RESEND_API_KEY not set; skipping emails.");
  }

  void db.reportPreviewToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return { success: true, token };
}
