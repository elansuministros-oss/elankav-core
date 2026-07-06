import { ELANVISUAL_PRODUCTS } from "./product-engine.js";
import { includesAny, normalizeText } from "./text-utils.js";

const STORE_KEY = "__ELAN_SALES_CONVERSATION_MEMORY__";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CITY_TERMS = [
  "managua",
  "masaya",
  "granada",
  "leon",
  "chinandega",
  "matagalpa",
  "esteli",
  "jinotepe",
  "carazo",
  "rivas",
  "juigalpa",
  "chontales",
  "ocotal",
  "jinotega",
  "boaco",
];

function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map();
  }

  return globalThis[STORE_KEY];
}

function cleanupExpired(store, now) {
  for (const [key, item] of store.entries()) {
    if (item.expiresAt <= now) store.delete(key);
  }
}

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
}

function normalizeWhatsappId(value = "") {
  const text = String(value || "").trim();
  return text.includes("@") ? text : "";
}

export function getCustomerIdentity(normalized = {}) {
  const chatId = normalized.chatId || "";
  const from = normalized.from || "";
  const lid = normalized.lid || normalized.participant || normalized.author || "";
  const phone = normalizePhone(normalized.customerPhone || from || chatId);
  const whatsappId = normalizeWhatsappId(chatId) || normalizeWhatsappId(from);
  const lidId = String(lid || "").includes("@lid") ? String(lid).trim() : "";
  const fallback = `${normalized.session || "WAHA"}:${chatId || from || "unknown"}`;

  return {
    customerKey: phone ? `phone:${phone}` : whatsappId ? `wa:${whatsappId}` : lidId ? `lid:${lidId}` : `session:${fallback}`,
    phone,
    whatsappId,
    lid: lidId,
    fallback,
  };
}

function createEmptyMemory(chatId = "", identity = {}) {
  return {
    customerKey: identity.customerKey || chatId,
    chatId,
    whatsappId: identity.whatsappId || "",
    lid: identity.lid || "",
    phone: identity.phone || "",
    name: "",
    businessName: "",
    productId: "",
    measure: "",
    placement: "",
    logoStatus: "",
    photoReceived: false,
    documentReceived: false,
    audioReceived: false,
    location: "",
    referencesSent: false,
    priceShared: false,
    quoteStarted: false,
    quoteConfirmed: false,
    marketingConsent: "",
    marketingAsked: false,
    followUpPreference: "",
    followUpAsked: false,
    intent: "",
    lastQuestion: "",
    missingData: [],
    historySummary: "",
    commercialStage: "Exploracion",
    lastStep: "",
    updatedAt: new Date().toISOString(),
  };
}

function getProductById(productId = "") {
  return ELANVISUAL_PRODUCTS.find((product) => product.id === productId) || null;
}

export function extractMeasure(message = "") {
  const normalized = normalizeText(message);
  const pair = normalized.match(
    /\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|m|mts|metros)?\s*[x*×]\s*\d+(?:[.,]\d+)?\s*(?:cm|centimetros|m|mts|metros)?\b/
  );
  if (pair) return pair[0];

  const single = normalized.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|centimetro|m|mts|metro|metros)\b/);
  if (single) return single[0];

  return "";
}

function extractLooseMeasure(message = "") {
  const normalized = normalizeText(message);
  const loose = normalized.match(/\b\d+(?:[.,]\d+)?\b/);
  return loose ? loose[0] : "";
}

export function extractPlacement(message = "") {
  if (includesAny(message, ["exterior", "afuera", "intemperie", "calle", "fachada"])) return "exterior";
  if (includesAny(message, ["interior", "adentro", "dentro", "local", "recepcion", "recepción"])) return "interior";
  return "";
}

function extractLogoStatus(message = "") {
  if (includesAny(message, ["no tengo logo", "no tenemos logo", "no tengo arte", "no tengo diseno", "no tengo diseño"])) {
    return "no_tiene";
  }

  if (includesAny(message, ["tengo logo", "tenemos logo", "te mando el logo", "envio logo", "mando logo", "arte listo", "diseño listo", "diseno listo"])) {
    return "tiene";
  }

  return "";
}

function extractLocation(message = "", multimodal = {}) {
  if (multimodal.modality === "location") return "ubicacion_enviada";

  const normalized = normalizeText(message);
  const city = CITY_TERMS.find((term) => normalized.includes(term));
  return city || "";
}

function isAffirmative(message = "") {
  return includesAny(message, ["si", "sí", "ok", "dale", "claro", "correcto", "confirmo", "avancemos", "esta bien", "está bien"]);
}

function isNegative(message = "") {
  return includesAny(message, ["no", "negativo", "todavia no", "todavía no", "aun no", "aún no"]);
}

function normalizeMemoryInput(input = {}) {
  if (typeof input === "string") {
    return {
      chatId: input,
      identity: { customerKey: input },
    };
  }

  const identity = getCustomerIdentity(input);
  return {
    chatId: input.chatId || input.from || identity.customerKey,
    identity,
  };
}

function appendHistorySummary(memory = {}, message = "", messageClassification = {}) {
  const line = message ? `${messageClassification.primary || "mensaje"}: ${message}` : "";
  return [memory.historySummary, line].filter(Boolean).join(" | ").slice(-500);
}

export function getMissingData(memory = {}) {
  const missing = [];

  if (!memory.productId) missing.push("producto");
  if (!memory.measure) missing.push("medidas");
  if (!memory.placement) missing.push("interior/exterior");
  if (!memory.logoStatus) missing.push("logo");
  if (!memory.photoReceived) missing.push("foto");

  return missing;
}

function getCommercialStage(memory = {}) {
  if (memory.quoteStarted || memory.photoReceived) return "Alta probabilidad de cierre";
  if (memory.productId && memory.measure && memory.placement) return "Oportunidad";
  if (memory.productId || memory.measure) return "Interes";
  return "Exploracion";
}

export function getConversationMemory(input = "", { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = getStore();
  cleanupExpired(store, now);
  const { chatId, identity } = normalizeMemoryInput(input);
  const key = identity.customerKey || chatId;

  const current = store.get(key);
  if (current?.memory) return current.memory;

  const memory = createEmptyMemory(chatId, identity);
  store.set(key, { memory, expiresAt: now + ttlMs });
  return memory;
}

export function updateConversationMemory(memory = createEmptyMemory(), context = {}) {
  const {
    message = "",
    productResult = {},
    multimodal = {},
    followUp = {},
    marketingConsent = {},
    visit = {},
    normalized = {},
    messageClassification = {},
  } = context;
  const identity = getCustomerIdentity(normalized);

  const next = {
    ...createEmptyMemory(memory.chatId || normalized.chatId || "", identity),
    ...memory,
    customerKey: memory.customerKey || identity.customerKey,
    chatId: normalized.chatId || memory.chatId,
    whatsappId: identity.whatsappId || memory.whatsappId || "",
    lid: identity.lid || memory.lid || "",
    phone: identity.phone || memory.phone || "",
    updatedAt: new Date().toISOString(),
  };

  if (messageClassification.extracted?.customerName) {
    next.name = messageClassification.extracted.customerName;
  }

  if (productResult.primaryProduct?.id) next.productId = productResult.primaryProduct.id;

  const measure = extractMeasure(message) || (memory.lastStep === "ask_measure" ? extractLooseMeasure(message) : "");
  if (measure) next.measure = measure;

  const placement = extractPlacement(message);
  if (placement) next.placement = placement;

  let logoStatus = extractLogoStatus(message);
  if (!logoStatus && memory.lastStep === "ask_logo") {
    if (isAffirmative(message)) logoStatus = "tiene";
    if (isNegative(message) || messageClassification.categories?.rejection) logoStatus = "no_tiene";
  }
  if (logoStatus) next.logoStatus = logoStatus;

  const location = extractLocation(message, multimodal);
  if (location) next.location = location;

  if (multimodal.modality === "image") next.photoReceived = true;
  if (multimodal.modality === "audio") next.audioReceived = true;
  if (multimodal.modality === "document" || multimodal.modality === "pdf") next.documentReceived = true;

  if (followUp.detected) {
    next.followUpPreference = followUp.label || followUp.option || "seguimiento_definido";
    next.followUpAsked = true;
  }

  if (!followUp.detected && memory.lastStep === "ask_followup" && isNegative(message)) {
    next.followUpPreference = "Solo cuando el cliente escriba nuevamente";
    next.followUpAsked = true;
  }

  if (marketingConsent.detected) {
    next.marketingConsent = marketingConsent.status;
    next.marketingAsked = true;
  }

  if (!marketingConsent.detected && memory.lastStep === "ask_marketing") {
    if (isAffirmative(message)) {
      next.marketingConsent = "granted";
      next.marketingAsked = true;
    }

    if (isNegative(message)) {
      next.marketingConsent = "denied";
      next.marketingAsked = true;
    }
  }

  if (next.quoteStarted && isAffirmative(message)) {
    next.quoteConfirmed = true;
  }

  if (visit.detected) {
    next.lastStep = "visit";
  }

  next.intent = messageClassification.primary || next.intent || "";
  next.historySummary = appendHistorySummary(next, message, messageClassification);
  next.missingData = getMissingData(next);
  next.commercialStage = getCommercialStage(next);

  return next;
}

export function saveConversationMemory(memory = {}, { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const key = memory.customerKey || memory.chatId;
  if (!key) return memory;

  getStore().set(key, {
    memory,
    expiresAt: now + ttlMs,
  });

  return memory;
}

export function getEffectiveProductResult(productResult = {}, memory = {}) {
  if (productResult.detected) return productResult;

  const product = getProductById(memory.productId);
  if (!product) return productResult;

  return {
    detected: true,
    primaryProduct: product,
    products: [product],
    fromMemory: true,
  };
}

export function getConversationStep(memory = {}, context = {}) {
  const { visit = {}, multimodal = {}, marketingConsent = {}, followUp = {}, messageClassification = {}, pricing = {} } = context;

  if (messageClassification.categories?.aiQuestion) return "answer_ai_identity";
  if (messageClassification.categories?.frustration || messageClassification.categories?.mildInsult) return "recover_context";
  if (messageClassification.categories?.personalPresentation && memory.productId) return "ack_name_continue";

  if (marketingConsent.detected) return "ack_marketing";
  if (followUp.detected) return "ack_followup";
  if (memory.lastStep === "ask_marketing" && memory.marketingConsent) return "ask_followup";

  if (visit.detected && !memory.location) return "ask_visit_location";
  if (visit.detected && memory.location) return "visit_ready";

    if (multimodal.modality === "audio") return "audio_received";
  if (multimodal.modality === "document" || multimodal.modality === "pdf") return "document_received";
  if (multimodal.modality === "image") return "photo_received";

  if (!memory.productId) return "ask_product";
  if (
    pricing.canMentionPrice &&
    !memory.priceShared &&
    (messageClassification.categories?.price || messageClassification.categories?.quoteRequest || !memory.lastStep)
  ) {
    return "share_public_price";
  }
  if (!memory.measure) return "ask_measure";
  if (!memory.placement) return "ask_placement";
    if (!memory.logoStatus) return "ask_logo";
  if (!memory.quoteStarted) return "quote_ready";
  if (!memory.photoReceived) return "ask_photo";
  if (!memory.referencesSent) return "send_references";
  if (memory.quoteConfirmed && !memory.marketingAsked && !memory.marketingConsent) return "ask_marketing";
  if (memory.marketingConsent && !memory.followUpAsked && !memory.followUpPreference) return "ask_followup";

  return "continue";
}

export function markConversationStep(memory = {}, step = "", context = {}) {
  const next = { ...memory, lastStep: step, updatedAt: new Date().toISOString() };

  if (step === "send_references") next.referencesSent = true;
  if (step === "quote_ready") next.quoteStarted = true;
  if (step === "ask_marketing") next.marketingAsked = true;
  if (step === "ask_followup") next.followUpAsked = true;
  if (step === "share_public_price") next.priceShared = true;
  if (context.lastQuestion) next.lastQuestion = context.lastQuestion;
  next.missingData = getMissingData(next);
  next.commercialStage = getCommercialStage(next);

  return next;
}

export function clearConversationMemory() {
  getStore().clear();
}