import { normalizeText } from "./text-utils.js";

const DEFAULT_PUBLIC_CATALOG = Object.freeze([
  Object.freeze({
    id: "boton-transparente",
    productId: "boton-luminoso",
    officialName: "Botón Transparente",
    priceFrom: 100,
    currency: "USD",
    measureBase: "60 x 60 cm",
    description:
      "Botón circular en acrílico transparente con relieve y acabado limpio para marcas comerciales.",
    url: "https://visual.elankav.com/rotulos",
    source: "ELANVISUAL src/data/aiProductProfiles.js",
    aliases: ["boton transparente", "boton luminoso", "boton", "rotulo estilo boton", "rótulo estilo botón"],
  }),
  Object.freeze({
    id: "boton-con-impresion",
    productId: "boton-luminoso",
    officialName: "Botón con Impresión",
    priceFrom: 130,
    currency: "USD",
    measureBase: "60 x 60 cm",
    description: "Botón circular con impresión full color y acabado comercial de alta visibilidad.",
    url: "https://visual.elankav.com/rotulos",
    source: "ELANVISUAL src/data/aiProductProfiles.js",
    aliases: ["boton con impresion", "boton impreso", "boton full color"],
  }),
  Object.freeze({
    id: "boton-impresion-uv-premium",
    productId: "boton-luminoso",
    officialName: "Botón Impresión UV Premium",
    priceFrom: 150,
    currency: "USD",
    measureBase: "60 x 60 cm",
    description: "Botón premium con impresión UV directa y presencia visual superior.",
    url: "https://visual.elankav.com/rotulos",
    source: "ELANVISUAL src/data/aiProductProfiles.js",
    aliases: ["boton uv", "boton impresion uv", "boton premium uv"],
  }),
  Object.freeze({
    id: "boton-premium-combinado",
    productId: "boton-luminoso",
    officialName: "Botón Premium Combinado",
    priceFrom: 190,
    currency: "USD",
    measureBase: "80 x 80 cm a 110 x 110 cm",
    description: "Botón personalizado con combinación de materiales, volumen e iluminación según diseño.",
    url: "https://visual.elankav.com/rotulos",
    source: "ELANVISUAL src/data/aiProductProfiles.js",
    aliases: ["boton premium", "boton combinado", "boton personalizado"],
  }),
]);

function readCatalogFromEnv() {
  const raw = process.env.ELANVISUAL_PUBLIC_CATALOG_JSON || "";
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreCatalogItem(item = {}, { message = "", productId = "" } = {}) {
  const text = normalizeText(message);
  const aliases = [item.officialName, item.nombre, item.name, ...(item.aliases || [])].filter(Boolean);
  const aliasScore = aliases.reduce((score, alias) => {
    const key = normalizeText(alias);
    return text.includes(key) ? score + key.length : score;
  }, 0);
  const productScore = productId && item.productId === productId ? 30 : 0;

  return {
    ...item,
    score: aliasScore + productScore,
  };
}

export function getElanVisualPublicCatalog() {
  return [...readCatalogFromEnv(), ...DEFAULT_PUBLIC_CATALOG];
}

export function resolvePublicCatalog({ message = "", productResult = {}, memory = {} } = {}) {
  const productId = productResult.primaryProduct?.id || memory.productId || "";
  const catalog = getElanVisualPublicCatalog();
  const matches = catalog
    .map((item) => scoreCatalogItem(item, { message, productId }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestMatch = matches[0] || null;

  return {
    source: "ELANVISUAL_PUBLIC_CATALOG",
    detected: Boolean(bestMatch),
    productId,
    bestMatch,
    matches,
  };
}
