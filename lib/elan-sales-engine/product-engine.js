import { normalizeText } from "./text-utils.js";

export const ELANVISUAL_PRODUCTS = [
  {
    id: "boton-luminoso",
    name: "boton luminoso",
    serviceName: "Boton luminoso",
    webPath: "/rotulos",
    aliases: ["boton luminoso", "boton", "botones", "caja de luz circular", "redondo luminoso"],
    questions: ["diametro o medida aproximada", "si va interior o exterior", "logo o arte disponible", "ubicacion de instalacion"],
  },
  {
    id: "letras-3d",
    name: "letras 3D",
    serviceName: "Letras 3D",
    webPath: "/letras-3d",
    aliases: ["letras 3d", "letra 3d", "letras volumetricas", "letras corporeas", "letras en relieve"],
    questions: ["texto o logo", "altura aproximada de letras", "material deseado", "si llevan iluminacion"],
  },
  {
    id: "fachada-acm",
    name: "fachada ACM",
    serviceName: "Fachada ACM",
    webPath: "/fachadas-acm",
    aliases: ["fachada acm", "acm", "alucobond", "fachada", "revestimiento acm"],
    questions: ["medidas de la fachada", "foto frontal del local", "ubicacion", "si requiere rotulo o letras encima"],
  },
  {
    id: "rotulo",
    name: "rotulo",
    serviceName: "Rotulo comercial",
    webPath: "/rotulos",
    aliases: ["rotulo", "rotulos", "rotulacion", "rotulo luminoso", "letrero", "anuncio"],
    questions: ["medidas", "si sera luminoso o sin luz", "interior o exterior", "foto del lugar"],
  },
  {
    id: "impresion",
    name: "impresion",
    serviceName: "Impresion",
    webPath: "/impresion",
    aliases: ["impresion", "imprimir", "banner", "lona", "sticker", "afiche", "full color"],
    questions: ["material", "medidas", "cantidad", "arte listo para imprimir"],
  },
  {
    id: "vinil",
    name: "vinil",
    serviceName: "Vinil",
    webPath: "/vinil",
    aliases: ["vinil", "vinilo", "vinil adhesivo", "vinil frost", "vinil decorativo"],
    questions: ["tipo de vinil", "medidas", "superficie donde se aplicara", "si requiere instalacion"],
  },
  {
    id: "microperforado",
    name: "microperforado",
    serviceName: "Vinil microperforado",
    webPath: "/vinil-microperforado",
    aliases: ["microperforado", "micro perforado", "vinil microperforado", "one way vision"],
    questions: ["medidas del vidrio", "cantidad de ventanas", "arte o logo", "ubicacion para instalacion"],
  },
  {
    id: "pvc",
    name: "PVC",
    serviceName: "PVC",
    webPath: "/pvc",
    aliases: ["pvc", "pvc espumado", "foam", "foam board"],
    questions: ["espesor", "medidas", "uso interior o exterior", "acabado requerido"],
  },
  {
    id: "acrilico",
    name: "acrilico",
    serviceName: "Acrilico",
    webPath: "/acrilico",
    aliases: ["acrilico", "acrilicos", "plexiglas", "metacrilato"],
    questions: ["espesor", "medidas", "si requiere corte o grabado", "uso final"],
  },
  {
    id: "senalizacion",
    name: "senalizacion",
    serviceName: "Senalizacion",
    webPath: "/senalizacion",
    aliases: ["senalizacion", "senaletica", "senales", "senal", "placas", "indicadores"],
    questions: ["tipo de senal", "cantidad", "material deseado", "ubicacion de instalacion"],
  },
];

function productScore(message, product) {
  const text = normalizeText(message);
  const matches = product.aliases.filter((alias) => text.includes(normalizeText(alias)));
  const score = matches.reduce((total, alias) => total + normalizeText(alias).length, 0);

  return {
    ...product,
    matches,
    score,
  };
}

export function detectElanVisualProduct(message = "") {
  const scored = ELANVISUAL_PRODUCTS.map((product) => productScore(message, product))
    .filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score);

  const primaryProduct = scored[0] || null;

  return {
    detected: Boolean(primaryProduct),
    primaryProduct,
    products: scored,
  };
}
