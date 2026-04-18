"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
} from "lucide-react";
import Link from "next/link";

type PageState = "loading" | "success" | "error";

function ReportPreviewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const vin = searchParams.get("vin");

  const [state, setState] = useState<PageState>("loading");
  const [reportHtml, setReportHtml] = useState<string>("");
  const [resolvedVin, setResolvedVin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Fetch report from the one-time token store ───────────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg("No report token found. Your report link may be invalid or expired.");
      setState("error");
      return;
    }

    async function loadReport() {
      try {
        const res = await fetch(`/api/store-report?token=${encodeURIComponent(token!)}`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        setReportHtml(data.html);
        setResolvedVin(data.vin || vin || "N/A");
        setState("success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load report.";
        setErrorMsg(msg);
        setState("error");
      }
    }

    loadReport();
  }, [token, vin]);

  // ── Inject HTML into iframe once loaded ──────────────────────────────────
  useEffect(() => {
    if (state === "success" && iframeRef.current && reportHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(reportHtml);
        doc.close();
      }
    }
  }, [state, reportHtml]);

  // ── Download handler ──────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!reportHtml) return;

    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TrueK-Report-${resolvedVin || "VIN"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-[1920px] mx-auto relative overflow-hidden min-h-screen flex flex-col">

      <div className="flex-1 bg-gray-50">
        {/* ── Page Header ── */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-8 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-custom_red" />
                  <span className="text-sm text-gray-400 uppercase tracking-widest font-semibold">
                    Vehicle History Report
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {state === "loading"
                    ? "Fetching your report…"
                    : state === "success"
                    ? `Report for VIN: ${resolvedVin}`
                    : "Report Unavailable"}
                </h1>
                {state === "success" && (
                  <p className="text-gray-400 text-sm mt-1">
                    Provided by ClearVIN · Powered by TrueK Inspection
                  </p>
                )}
              </div>

              {state === "success" && (
                <Button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-custom_red hover:bg-red-700 text-white px-6 py-5 rounded-lg shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <Download className="h-5 w-5" />
                  Download Report
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Decorative red bar ── */}
        <div className="h-1 bg-gradient-to-r from-custom_red via-red-400 to-custom_red" />

        {/* ── Content Area ── */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Loading state */}
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-gray-200 border-t-custom_red animate-spin" />
                <Loader2 className="h-8 w-8 text-custom_red absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-800">
                  Preparing your report…
                </p>
                <p className="text-gray-500 mt-2 text-sm">
                  This may take a few seconds. Please don't close this page.
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="bg-red-50 rounded-full p-6 border-2 border-red-100">
                <AlertTriangle className="h-14 w-14 text-custom_red" />
              </div>
              <div className="text-center max-w-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">
                  Unable to Load Report
                </h2>
                <p className="text-gray-600 mb-2">{errorMsg}</p>
                <p className="text-gray-500 text-sm mb-6">
                  Your payment was successful. If this issue persists, please
                  contact us and we'll send the report directly to your email.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a href="mailto:truekinspection@gmail.com">
                    <Button className="bg-custom_red hover:bg-red-700 text-white px-8 py-5 rounded-lg w-full sm:w-auto">
                      Contact Support
                    </Button>
                  </a>
                  <Link href="/">
                    <Button
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 px-8 py-5 rounded-lg w-full sm:w-auto"
                    >
                      Return Home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Success state — report iframe */}
          {state === "success" && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 text-sm font-medium">
                  Your vehicle history report is ready. Scroll through the report
                  below or download it using the button above.
                </p>
              </div>

              {/* Report iframe container */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-500 font-medium">
                    📄 Full Vehicle History Report — VIN: {resolvedVin}
                  </span>
                  <Button
                    onClick={handleDownload}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1.5 text-custom_red border-custom_red hover:bg-red-50 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Save as File
                  </Button>
                </div>

                {/* The iframe renders the raw ClearVIN HTML */}
                <iframe
                  ref={iframeRef}
                  title="Vehicle History Report"
                  className="w-full"
                  style={{ height: "80vh", border: "none" }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>

              {/* Bottom download CTA */}
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-custom_red hover:bg-red-700 text-white px-10 py-5 rounded-lg shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-base"
                >
                  <Download className="h-5 w-5" />
                  Download Report as HTML
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

    </main>
  );
}

export default function ReportPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <Loader2 className="h-8 w-8 text-custom_red animate-spin" />
        </div>
      }
    >
      <ReportPreviewContent />
    </Suspense>
  );
}
