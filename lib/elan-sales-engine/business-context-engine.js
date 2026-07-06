import { normalizeText } from "./text-utils.js";

export const BUSINESS_UNITS = [
  {
    unit: "ELANVISUAL",
    serviceCategory: "Rotulacion, impresion y publicidad visual",
    keywords: [
      "rotulo",
      "rotulos",
      "rotulacion",
      "luminoso",
      "boton",
      "letras 3d",
      "fachada",
      "acm",
      "impresion",
      "vinil",
      "microperforado",
      "pvc",
      "acrilico",
      "senalizacion",
      "banner",
      "publicidad visual",
      "logo",
      "marca",
    ],
  },
  {
    unit: "ELANPET",
    serviceCategory: "Productos para mascotas y veterinarias",
    keywords: [
      "mascota",
      "perro",
      "gato",
      "veterinaria",
      "alimento",
      "concentrado",
      "collar",
      "arena",
      "accesorio mascota",
    ],
  },
  {
    unit: "ELANHOME",
    serviceCategory: "Iluminacion decorativa, alfombras y hogar",
    keywords: [
      "lampara",
      "iluminacion",
      "alfombra",
      "decoracion",
      "hogar",
      "casa",
      "accesorios del hogar",
      "cuadro",
      "jardin",
    ],
  },
  {
    unit: "ELANCENTER",
    serviceCategory: "Arquitectura, remodelacion y gestion de proyectos",
    keywords: [
      "arquitectura",
      "remodelacion",
      "construccion",
      "supervision",
      "proyecto",
      "obra",
      "plano",
      "diseno arquitectonico",
      "gestion de proyecto",
    ],
  },
  {
    unit: "ELANTRANSPORTE",
    serviceCategory: "Transporte, logistica, instalaciones y distribucion",
    keywords: [
      "transporte",
      "logistica",
      "envio",
      "entrega",
      "distribucion",
      "instalacion",
      "traslado",
      "flete",
    ],
  },
];

function findKeywordMatches(message, keywords = []) {
  const text = normalizeText(message);
  return keywords.filter((keyword) => text.includes(normalizeText(keyword)));
}

function scoreBusinessUnit(message, unitConfig) {
  const matches = findKeywordMatches(message, unitConfig.keywords);
  const score = matches.reduce((total, keyword) => total + Math.max(1, normalizeText(keyword).split(" ").length), 0);

  return {
    ...unitConfig,
    score,
    matches,
  };
}

export function detectBusinessContext({ message = "", normalized = {} } = {}) {
  const fullMessage = `${message} ${normalized.body || ""}`.trim();
  const scoredUnits = BUSINESS_UNITS.map((unitConfig) => scoreBusinessUnit(fullMessage, unitConfig));
  const best = scoredUnits.reduce((winner, current) => (current.score > winner.score ? current : winner), scoredUnits[0]);

  if (!best || best.score <= 0) {
    const fallback = BUSINESS_UNITS[0];

    return {
      unit: fallback.unit,
      serviceCategory: fallback.serviceCategory,
      confidence: 0.35,
      reason: "default_v1_elanvisual",
      matchedKeywords: [],
      supportedUnits: BUSINESS_UNITS.map((item) => item.unit),
      scores: scoredUnits.map(({ unit, score }) => ({ unit, score })),
    };
  }

  return {
    unit: best.unit,
    serviceCategory: best.serviceCategory,
    confidence: Math.min(0.98, 0.45 + best.score * 0.12),
    reason: "keyword_match",
    matchedKeywords: best.matches,
    supportedUnits: BUSINESS_UNITS.map((item) => item.unit),
    scores: scoredUnits.map(({ unit, score }) => ({ unit, score })),
  };
}
