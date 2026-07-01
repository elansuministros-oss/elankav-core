export function ok(data = null, meta = {}) {
  return { ok: true, data, error: null, meta };
}

export function fail(code, message, details = null) {
  return { ok: false, data: null, error: { code, message, details }, meta: {} };
}

export function requireObject(payload, label = "payload") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`AI23_INVALID_${label.toUpperCase()}`);
  }
}

export function requireId(id, label = "id") {
  if (!id || typeof id !== "string") {
    throw new Error(`AI23_INVALID_${label.toUpperCase()}`);
  }
}

export function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function assertPositiveNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`AI23_INVALID_${label.toUpperCase()}`);
  }
  return n;
}
