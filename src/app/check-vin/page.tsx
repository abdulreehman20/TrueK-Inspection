"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  initializePaddle,
  Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js";
import {
  Loader2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { Navbar } from "@/components/navbar";
import { FooterSection } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { fetchClearVinReport, verifyClearVinVin } from "@/actions/clearvin";
import { sendReportPreviewLinkEmail } from "@/actions/send-report-preview-email";
import { PADDLE_REPORT_PRICE_ID } from "@/lib/constants";
import { useUserStore } from "@/store/user-store";

type ReportLoadState = "loading" | "ready" | "error";

type VehicleSummary = {
  year?: string;
  make?: string;
  model?: string;
};

function readVinFromClient(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("temp_vin")?.trim() ||
    useUserStore.getState().vnNumber?.trim() ||
    ""
  );
}

function readNameFromClient(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem("temp_name")?.trim();
  if (stored) return stored;
  const { firstName, lastName } = useUserStore.getState();
  return `${firstName} ${lastName}`.trim();
}

function readEmailFromClient(): string {
  return useUserStore.getState().email?.trim() || "";
}

export default function CheckVinPage() {
  const router = useRouter();
  const vinFromStore = useUserStore((s) => s.vnNumber);

  const [reportState, setReportState] = useState<ReportLoadState>("loading");
  const [reportError, setReportError] = useState("");
  const [activeVin, setActiveVin] = useState("");
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);

  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  // ── Verify VIN with ClearVIN (no report HTML on this page) ────────────────
  useEffect(() => {
    const vin = readVinFromClient();
    if (!vin) {
      setReportError(
        "We could not find your VIN. Please go back to the home page and submit the form again.",
      );
      setReportState("error");
      return;
    }

    setActiveVin(vin);
    setReportState("loading");
    setReportError("");
    setVehicle(null);

    void (async () => {
      const result = await verifyClearVinVin(vin);
      if (result.success) {
        setVehicle({
          year: result.year,
          make: result.make,
          model: result.model,
        });
        setReportState("ready");
        return;
      }
      setReportError(
        result.error || "Could not verify this VIN with ClearVIN.",
      );
      setReportState("error");
    })();
  }, [vinFromStore]);

  // ── Paddle (single init) + post-checkout ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
      eventCallback: (event: PaddleEventData) => {
        if (event.name !== "checkout.completed" || !event.data) return;
        const checkoutData = event.data;

        void (async () => {
          const customer =
            "customer" in checkoutData && checkoutData.customer
              ? (checkoutData.customer as { email?: string; name?: string })
              : {};
          const vin = readVinFromClient();
          const customerEmail = customer.email || readEmailFromClient();
          const displayName =
            readNameFromClient() || customer.name || "Customer";

          if (!vin) {
            console.error("[check-vin] checkout.completed but VIN missing");
            return;
          }

          setCheckoutBusy(true);

          try {
            const result = await fetchClearVinReport(vin);
            if (!result.success || !result.html) {
              console.error(
                "[check-vin] ClearVIN after payment:",
                result.error,
              );
              window.location.href = `/report-preview?error=fetch_failed&vin=${encodeURIComponent(vin)}`;
              return;
            }

            const storeRes = await fetch("/api/store-report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html: result.html, vin }),
            });

            if (!storeRes.ok) {
              console.error(
                "[check-vin] store-report failed",
                await storeRes.text(),
              );
              window.location.href = `/report-preview?error=store_failed&vin=${encodeURIComponent(vin)}`;
              return;
            }

            const { token } = (await storeRes.json()) as { token?: string };
            if (!token) {
              window.location.href = `/report-preview?error=store_failed&vin=${encodeURIComponent(vin)}`;
              return;
            }

            const previewPath = `/report-preview?token=${encodeURIComponent(token)}&vin=${encodeURIComponent(vin)}`;
            const previewUrl = `${window.location.origin}${previewPath}`;

            void sendReportPreviewLinkEmail({
              to: customerEmail,
              customerName: displayName,
              previewUrl,
              vin,
            });

            if (!cancelled) {
              window.location.href = previewPath;
            }
          } catch (e) {
            console.error("[check-vin] post-checkout", e);
            window.location.href = `/report-preview?error=unexpected&vin=${encodeURIComponent(vin)}`;
          } finally {
            if (!cancelled) setCheckoutBusy(false);
          }
        })();
      },
    }).then((instance) => {
      if (!cancelled && instance) setPaddle(instance);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openCheckout = () => {
    if (!paddle) return;
    const vin = readVinFromClient() || activeVin;
    if (!vin) return;
    const customerEmail = readEmailFromClient();

    paddle.Checkout.open({
      items: [{ priceId: PADDLE_REPORT_PRICE_ID, quantity: 1 }],
      customData: { vin_number: vin },
      ...(customerEmail ? { customer: { email: customerEmail } } : {}),
    });
  };

  const noVinError = reportState === "error" && !activeVin;

  const detailRows = [
    { label: "VIN", value: activeVin },
    vehicle?.year ? { label: "Year", value: vehicle.year } : null,
    vehicle?.make ? { label: "Make", value: vehicle.make } : null,
    vehicle?.model ? { label: "Model", value: vehicle.model } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className="max-w-[1920px] mx-auto relative overflow-hidden min-h-screen flex flex-col">
      {checkoutBusy && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-5 max-w-sm mx-4">
            <Loader2 className="h-12 w-12 text-custom_red animate-spin" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800">
                Preparing your report
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Securing your full vehicle history. Please keep this tab open…
              </p>
            </div>
          </div>
        </div>
      )}

      <Navbar />
      <div className="flex-1 mt-24 max-w-2xl mx-auto px-4 py-10 w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-custom_red font-semibold text-sm uppercase tracking-wide mb-2">
            <ShieldCheck className="h-5 w-5" />
            VIN verification
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Confirm your vehicle
          </h1>
          <p className="text-gray-600 mt-3 max-w-xl mx-auto text-sm md:text-base">
            We verify your VIN with ClearVIN before checkout. After payment you
            will open the full interactive report on the next page.
          </p>
        </div>

        {noVinError && (
          <div className="max-w-xl mx-auto rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto mb-3" />
            <p className="text-gray-800 mb-4">{reportError}</p>
            <Button
              className="bg-custom_red hover:bg-red-700 text-white"
              onClick={() => router.push("/")}
            >
              Back to home
            </Button>
          </div>
        )}

        {reportState === "loading" && activeVin && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-12 w-12 text-custom_red animate-spin" />
            <p className="text-gray-700 font-medium">
              Verifying VIN {activeVin}…
            </p>
          </div>
        )}

        {reportState === "error" && activeVin && (
          <div className="max-w-xl mx-auto rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-custom_red mx-auto mb-3" />
            <p className="text-gray-800 mb-4">{reportError}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  const vin = readVinFromClient() || activeVin;
                  if (!vin) return;
                  setActiveVin(vin);
                  setReportState("loading");
                  setReportError("");
                  void (async () => {
                    const result = await verifyClearVinVin(vin);
                    if (result.success) {
                      setVehicle({
                        year: result.year,
                        make: result.make,
                        model: result.model,
                      });
                      setReportState("ready");
                    } else {
                      setReportError(result.error || "Request failed.");
                      setReportState("error");
                    }
                  })();
                }}
              >
                Try again
              </Button>
              <Button
                className="bg-custom_red hover:bg-red-700 text-white"
                onClick={() => router.push("/")}
              >
                Home
              </Button>
            </div>
          </div>
        )}

        {reportState === "ready" && vehicle !== null && (
          <div className="space-y-8">
            <div className="rounded-xl border border-green-200 bg-green-50/90 p-6 md:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="flex-1 space-y-2 text-left">
                  <p className="text-lg md:text-xl font-semibold text-gray-900">
                    ✅ Your VIN is verified! Your report is ready.
                  </p>
                  <p className="text-sm text-gray-600">
                    Details from ClearVIN for this vehicle:
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {detailRows.map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-green-100 bg-white/80 px-4 py-3"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900 break-all">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <Button
                size="lg"
                className="w-full max-w-md bg-custom_red/80 hover:bg-custom_red/100 text-white text-lg py-6 rounded-xl shadow-lg"
                disabled={!paddle}
                onClick={openCheckout}
              >
                {paddle ? "Get Full Report — $49" : "Loading checkout…"}
              </Button>
              {!paddle && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing secure payment…
                </p>
              )}
              <p className="max-w-md text-center text-xs text-gray-500">
                NMVTIS-related records in this report are provided through
                licensed data providers, including ClearVin.{" "}
                <Link href="/terms#nmvtis-disclaimer" className="underline">
                  Read full terms
                </Link>
                .
              </p>
            </div>
          </div>
        )}
      </div>
      <FooterSection />
    </main>
  );
}
