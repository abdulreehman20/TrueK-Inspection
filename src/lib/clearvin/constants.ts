export const CLEARVIN_BASE = "https://www.clearvin.com/rest/vendor";

export const CLEARVIN_LOGIN_URL = `${CLEARVIN_BASE}/login`;

/** JWT lifetime per ClearVin documentation (minutes). */
export const CLEARVIN_TOKEN_TTL_MS = 120 * 60 * 1000;

/** Re-authenticate this many ms before nominal expiry to avoid mid-request expiry. */
export const CLEARVIN_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const CLEARVIN_FETCH_TIMEOUT_MS = 60_000;
