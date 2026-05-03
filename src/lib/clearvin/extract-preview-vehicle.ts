import { extractVehicleSummaryFromClearVinHtml } from "@/lib/clearvin-vehicle-summary";

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function deepFindVehicle(obj: unknown, depth = 0): { year?: string; make?: string; model?: string } {
  if (depth > 12 || obj === null || obj === undefined) return {};

  if (typeof obj === "string") {
    if (obj.includes("<html") || obj.includes("<!DOCTYPE")) {
      return extractVehicleSummaryFromClearVinHtml(obj);
    }
    return {};
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindVehicle(item, depth + 1);
      if (found.year || found.make || found.model) return found;
    }
    return {};
  }

  if (typeof obj !== "object") return {};

  const rec = obj as Record<string, unknown>;

  const year =
    pickString(rec, [
      "modelYear",
      "ModelYear",
      "year",
      "Year",
      "vehicleYear",
      "VehicleYear",
    ]) ?? undefined;
  const make =
    pickString(rec, [
      "make",
      "Make",
      "manufacturer",
      "Manufacturer",
      "vehicleMake",
      "VehicleMake",
    ]) ?? undefined;
  const model =
    pickString(rec, ["model", "Model", "vehicleModel", "VehicleModel"]) ?? undefined;

  if (year || make || model) {
    return { year, make, model };
  }

  for (const v of Object.values(rec)) {
    const found = deepFindVehicle(v, depth + 1);
    if (found.year || found.make || found.model) return found;
  }

  return {};
}

/**
 * Best-effort year/make/model from ClearVin preview JSON (shape varies by API version).
 */
export function extractVehicleSummaryFromClearVinPreview(
  payload: unknown,
): { year?: string; make?: string; model?: string } {
  if (typeof payload === "string") {
    return extractVehicleSummaryFromClearVinHtml(payload);
  }
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const root = payload as Record<string, unknown>;
  const inner =
    root.result && typeof root.result === "object"
      ? (root.result as Record<string, unknown>)
      : root;

  const fromDecode = deepFindVehicle(inner);
  if (fromDecode.year || fromDecode.make || fromDecode.model) {
    return fromDecode;
  }

  return deepFindVehicle(root);
}
