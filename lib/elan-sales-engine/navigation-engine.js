const DEFAULT_ELANVISUAL_BASE_URL = "https://visual.elankav.com";

function getEnv(name) {
  if (typeof process === "undefined") return "";
  return process.env?.[name] || "";
}

function getElanVisualBaseUrl() {
  return String(getEnv("ELANVISUAL_WEB_BASE_URL") || getEnv("VITE_ELANVISUAL_WEB_BASE_URL") || DEFAULT_ELANVISUAL_BASE_URL)
    .replace(/\/$/, "");
}

function parseProductUrlOverrides() {
  const raw = getEnv("ELANVISUAL_PRODUCT_URLS_JSON");
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function joinUrl(baseUrl, path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}/${String(path || "").replace(/^\/+/, "")}`;
}

export function getNavigationForProduct(product = null) {
  if (!product) {
    return {
      shouldSend: false,
      url: "",
      label: "",
      reason: "sin_producto",
    };
  }

  const overrides = parseProductUrlOverrides();
  const path = overrides[product.id] || product.webPath || "/";
  const url = joinUrl(getElanVisualBaseUrl(), path);

  return {
    shouldSend: true,
    url,
    label: product.serviceName || product.name,
    reason: "producto_detectado",
  };
}
