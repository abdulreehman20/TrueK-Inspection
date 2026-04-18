"use server";

/**
 * Fetches a full HTML vehicle history report from the ClearVIN API.
 *
 * Endpoint: GET https://www.clearvin.com/rest/vendor/report
 * Params:   ?vin={vin}&format=html
 * Headers:  Authorization: Bearer <token>
 *
 * Returns the raw HTML string on success, throws on failure.
 */
export async function fetchClearVinReport(vin: string): Promise<{
  success: boolean;
  html?: string;
  error?: string;
}> {
  if (!vin || vin.trim() === "") {
    return { success: false, error: "VIN number is required." };
  }

  const token = process.env.CLEARVIN_API_TOKEN;

  if (!token) {
    console.error("[ClearVIN] CLEARVIN_API_TOKEN is not set");
    return { success: false, error: "API configuration error." };
  }

  try {
    const url = `https://www.clearvin.com/rest/vendor/report?vin=${encodeURIComponent(vin.trim())}&format=html`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/html",
        Accept: "text/html, application/json",
      },
      // 30-second timeout via AbortSignal
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        `[ClearVIN] API error ${response.status}: ${responseText.slice(0, 300)}`
      );
      return {
        success: false,
        error: `ClearVIN API returned status ${response.status}. Please contact support.`,
      };
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      return { success: false, error: "Empty report received from ClearVIN." };
    }

    return { success: true, html };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ClearVIN] Fetch failed:", message);
    return {
      success: false,
      error: "Failed to fetch report. Please contact support with your order ID.",
    };
  }
}
