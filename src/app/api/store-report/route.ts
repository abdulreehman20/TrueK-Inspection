import { NextRequest, NextResponse } from "next/server";

// In-memory store: token → { html, vin, expiresAt }
// Next.js module-level variables persist across requests in the same process.
const reportStore = new Map<
  string,
  { html: string; vin: string; expiresAt: number }
>();

// ── POST /api/store-report ───────────────────────────────────────────────────
// Body: { html: string, vin: string }
// Returns: { token: string }
export async function POST(req: NextRequest) {
  try {
    const { html, vin } = await req.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Missing html" }, { status: 400 });
    }

    // One-time token – 32 hex chars
    const token = crypto.randomUUID().replace(/-/g, "");

    // Expire after 30 minutes to avoid unbounded memory growth
    reportStore.set(token, {
      html,
      vin: vin || "N/A",
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    // Opportunistically purge expired entries
    for (const [k, v] of reportStore.entries()) {
      if (v.expiresAt < Date.now()) reportStore.delete(k);
    }

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ── GET /api/store-report?token=xxx ─────────────────────────────────────────
// Returns: { html: string, vin: string } and removes the entry (one-time use)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const entry = reportStore.get(token);

  if (!entry) {
    return NextResponse.json({ error: "Not found or expired" }, { status: 404 });
  }

  if (entry.expiresAt < Date.now()) {
    reportStore.delete(token);
    return NextResponse.json({ error: "Token expired" }, { status: 410 });
  }

  // Delete after retrieval – one-time use
  reportStore.delete(token);

  return NextResponse.json({ html: entry.html, vin: entry.vin });
}
