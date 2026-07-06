import { includesAny, normalizeText } from "./text-utils.js";

const PRESENTATION_PATTERNS = [
  /\bsoy\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})\b/i,
  /\bme\s+llamo\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})\b/i,
  /\bmi\s+nombre\s+es\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})\b/i,
];

function titleName(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractCustomerName(message = "") {
  for (const pattern of PRESENTATION_PATTERNS) {
    const match = String(message || "").match(pattern);
    if (match?.[1]) return titleName(match[1]);
  }

  return "";
}

function detectStandaloneNo(message = "") {
  const text = normalizeText(message);
  return /^(no|nop|negativo|no gracias|gracias no)$/.test(text);
}

export function classifyCustomerMessage({ message = "", normalized = {}, multimodal = {}, memory = {}, productResult = {} } = {}) {
  const text = normalizeText(message);
  const name = extractCustomerName(message);
  const hasText = Boolean(text);

  const categories = {
    greeting: hasText && /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/.test(text),
    personalPresentation: Boolean(name),
    quoteRequest: includesAny(message, ["cotizacion", "cotizar", "presupuesto", "quiero", "necesito", "me interesa"]),
    specificProduct: Boolean(productResult.detected || productResult.primaryProduct || memory.productId),
    measure: Boolean(
      text.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|m|mts|metros)?\s*[x*]\s*\d+(?:[.,]\d+)?\s*(?:cm|centimetros|m|mts|metros)?\b/) ||
        text.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|centimetro|m|mts|metro|metros)\b/)
    ),
    placement: includesAny(message, ["interior", "exterior", "adentro", "afuera", "intemperie", "fachada"]),
    location: multimodal.modality === "location" || includesAny(message, ["managua", "masaya", "granada", "leon", "chinandega", "matagalpa", "esteli"]),
    objection: includesAny(message, ["muy caro", "caro", "lo pienso", "despues", "después", "no estoy seguro"]),
    frustration: includesAny(message, ["ya te dije", "te dije", "ya dije", "me estas repitiendo", "me estás repitiendo", "no entiendes", "no entendiste"]),
    aiQuestion: includesAny(message, ["eres una ia", "sos una ia", "eres ia", "sos ia", "eres robot", "sos robot", "quien eres", "quién eres"]),
    test: includesAny(message, ["probando", "test", "prueba"]),
    mildInsult: includesAny(message, ["estas loca", "estás loca", "loco", "tonta", "tonto"]),
    rejection: detectStandaloneNo(message),
    price: includesAny(message, ["cuanto cuesta", "cuánto cuesta", "precio", "precios", "costo", "vale", "cuanto vale", "cuánto vale"]),
    followUp: includesAny(message, ["semana", "15 dias", "15 días", "quince dias", "quince días", "un mes", "escribeme", "escríbeme"]),
    promotions: includesAny(message, ["promociones", "descuentos", "novedades", "ofertas"]),
    photo: multimodal.modality === "image",
    audio: multimodal.modality === "audio",
    document: multimodal.modality === "document" || multimodal.modality === "pdf",
    locationPayload: multimodal.modality === "location",
  };

  return {
    categories,
    primary:
      categories.aiQuestion
        ? "pregunta_sobre_ia"
        : categories.frustration || categories.mildInsult
          ? "frustracion"
          : categories.personalPresentation
            ? "presentacion_personal"
            : categories.price
              ? "precio"
              : categories.measure
                ? "medida"
                : categories.placement
                  ? "interior_exterior"
                  : categories.quoteRequest || categories.specificProduct
                    ? "solicitud_comercial"
                    : categories.greeting
                      ? "saludo"
                      : categories.photo
                        ? "foto"
                        : categories.audio
                          ? "audio"
                          : categories.document
                            ? "documento"
                            : "mensaje_general",
    extracted: {
      customerName: name,
    },
    raw: {
      message,
      type: normalized.type || "",
    },
  };
}
