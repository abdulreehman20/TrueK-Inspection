"use server";

import { clearVinPreview, clearVinReport } from "@/lib/clearvin/client";
import { ClearVinApiError } from "@/lib/clearvin/errors";
import { extractVehicleSummaryFromClearVinPreview } from "@/lib/clearvin/extract-preview-vehicle";
import { extractVehicleSummaryFromClearVinHtml } from "@/lib/clearvin-vehicle-summary";
import { getVinValidationError, normalizeVin } from "@/lib/vin-validation";

function mapClearVinFailure(e: unknown): string {
  if (e instanceof ClearVinApiError) {
    return e.upstreamMessage;
  }
  const message = e instanceof Error ? e.message : "Unknown error";
  console.error("[ClearVIN]", message);
  return "Failed to reach ClearVin. Please try again or contact support.";
}

/**
 * Fetches a full HTML vehicle history report from the ClearVin API (v2.0).
 * Uses email/password auth on the server (JWT, auto-refresh before expiry).
 */
export async function fetchClearVinReport(vin: string): Promise<{
  success: boolean;
  html?: string;
  reportId?: string;
  error?: string;
}> {
  const vinError = getVinValidationError(vin);
  if (vinError) {
    return { success: false, error: vinError };
  }

  const normalized = normalizeVin(vin);

  try {
    const result = await clearVinReport({ vin: normalized, format: "html" });
    const html = result.text?.trim() ?? "";
    if (!html) {
      return { success: false, error: "Empty report received from ClearVin." };
    }
    return {
      success: true,
      html,
      reportId: result.reportId,
    };
  } catch (e) {
    console.error("[ClearVIN] fetchClearVinReport:", e);
    return { success: false, error: mapClearVinFailure(e) };
  }
}

/**
 * Confirms ClearVin recognizes this VIN using the preview endpoint (lighter than a full report).
 */
export async function verifyClearVinVin(vin: string): Promise<{
  success: boolean;
  year?: string;
  make?: string;
  model?: string;
  error?: string;
}> {
  const vinError = getVinValidationError(vin);
  if (vinError) {
    return { success: false, error: vinError };
  }

  const normalized = normalizeVin(vin);

  try {
    const { json, raw } = await clearVinPreview(normalized);
    const fromJson = extractVehicleSummaryFromClearVinPreview(json);
    const fromRaw =
      typeof raw === "string" && raw.includes("<")
        ? extractVehicleSummaryFromClearVinHtml(raw)
        : {};
    const year = fromJson.year ?? fromRaw.year;
    const make = fromJson.make ?? fromRaw.make;
    const model = fromJson.model ?? fromRaw.model;

    return { success: true, year, make, model };
  } catch (e) {
    console.error("[ClearVIN] verifyClearVinVin:", e);
    return { success: false, error: mapClearVinFailure(e) };
  }
}
