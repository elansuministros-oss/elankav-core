import { includesAny, normalizeText } from "./text-utils.js";

const INTENT_TERMS = {
  greeting: ["hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches"],
  price: ["cuanto cuesta", "precio", "precios", "costo", "vale"],
  visit: ["pueden visitar", "visitar mi negocio", "visita", "venir a mi negocio", "llegar al local", "vienen al local"],
  measures: ["medidas", "medida", "ancho", "alto", "te mando las medidas", "envio medidas", "mandar medidas"],
  marketingConsent: ["promociones", "descuentos", "ofertas", "novedades", "quiero recibir promociones"],
  followUp: ["escribeme", "escribime", "me escriben", "una semana", "15 dias", "quince dias", "un mes", "seguimiento"],
  purchase: ["quiero", "necesito", "busco", "me interesa", "requiero", "ocupo"],
};

export function detectSalesIntents(message = "", productResult = {}) {
  const text = normalizeText(message);
  const greetingOnly = INTENT_TERMS.greeting.some((term) => text === normalizeText(term));
  const hasMeasureValue = Boolean(
    text.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|m|mts|metros)?\s*[x*×]\s*\d+(?:[.,]\d+)?/) ||
      text.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|centimetros|centimetro|m|mts|metro|metros)\b/)
  );

  return {
    greeting: includesAny(message, INTENT_TERMS.greeting),
    greetingOnly,
    productInquiry: Boolean(productResult.detected) || includesAny(message, INTENT_TERMS.purchase),
    price: includesAny(message, INTENT_TERMS.price),
    visit: includesAny(message, INTENT_TERMS.visit),
    measures: hasMeasureValue || includesAny(message, INTENT_TERMS.measures),
    marketingConsent: includesAny(message, INTENT_TERMS.marketingConsent),
    followUp: includesAny(message, INTENT_TERMS.followUp),
    purchase: includesAny(message, INTENT_TERMS.purchase),
  };
}
