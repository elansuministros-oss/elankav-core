const MAX_WHATSAPP_CHARS = 600;

const PRODUCT_LABELS = {
  "boton-luminoso": "botón luminoso",
  "letras-3d": "letras 3D",
  "fachada-acm": "fachada ACM",
  rotulo: "rótulo",
  impresion: "impresión",
  vinil: "vinil",
  microperforado: "vinil microperforado",
  pvc: "PVC",
  acrilico: "acrílico",
  senalizacion: "señalización",
};

function labelProduct(product = {}) {
  return PRODUCT_LABELS[product.id] || product.serviceName || product.name || "producto visual";
}

function cleanMessage(lines = []) {
  const text = lines
    .filter((line) => line !== null && line !== undefined)
    .map((line) => String(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= MAX_WHATSAPP_CHARS) return text;

  return `${text.slice(0, 548).trim()}\n\nTe guío paso a paso. ✨`;
}

function addNavigation(lines, navigation) {
  if (!navigation?.shouldSend || !navigation.url) return;
  lines.push("Mientras tanto podés ver referencias aquí:");
  lines.push(navigation.url);
}

function productPrompt(product = {}) {
  if (product.id === "boton-luminoso") {
    return [
      "Para orientarte bien necesito 2 datos:",
      "",
      "1️⃣ ¿Qué medida aproximada querés?",
      "Ej: 50 cm, 60 cm, 80 cm o 1 metro.",
      "",
      "2️⃣ ¿Será para interior o exterior?",
    ];
  }

  if (product.id === "letras-3d") {
    return [
      "Para guiarte bien necesito 2 datos:",
      "",
      "1️⃣ ¿Qué texto o logo llevaría?",
      "2️⃣ ¿Las querés con luz o sin luz?",
    ];
  }

  if (product.id === "fachada-acm") {
    return [
      "Para orientarte mejor necesito 2 datos:",
      "",
      "1️⃣ ¿Tenés una foto del frente?",
      "2️⃣ ¿Medida aproximada de la fachada?",
    ];
  }

  if (product.id === "rotulo") {
    return [
      "Para orientarte bien necesito 2 datos:",
      "",
      "1️⃣ ¿Qué medida aproximada tendría?",
      "2️⃣ ¿Lo querés luminoso o sin luz?",
    ];
  }

  return [
    "Para orientarte bien necesito 2 datos:",
    "",
    "1️⃣ ¿Qué medida aproximada necesitás?",
    "2️⃣ ¿Es para interior o exterior?",
  ];
}

function buildVisitResponse() {
  return cleanMessage([
    "Sí, claro 👌",
    "Podemos coordinar una *visita técnica*.",
    "",
    "Para revisarlo, pasame:",
    "",
    "1️⃣ ¿Ubicación del negocio?",
    "2️⃣ ¿Foto del frente o del área?",
    "",
    "Si está lejos, puede aplicar costo de desplazamiento; te lo confirmamos antes. ✨",
  ]);
}

function buildPriceResponse({ productResult, navigation }) {
  const product = productResult.primaryProduct;
  const label = product ? labelProduct(product) : "el proyecto";
  const lines = [
    "Claro 👋",
    `Te puedo ayudar a cotizar *${label}*.`,
    "",
    "Para darte un precio serio necesito primero:",
    "",
    "1️⃣ ¿Medida aproximada?",
    "2️⃣ ¿Interior o exterior?",
    "",
    "No te doy un número al aire; así cuidamos que la cotización salga bien. ✨",
  ];

  if (product) addNavigation(lines, navigation);
  lines.push("Mandame esos datos y avanzamos.");

  return cleanMessage(lines);
}

function buildMeasuresResponse({ productResult, navigation }) {
  const product = productResult.primaryProduct;
  const lines = [
    "Perfecto 👌",
    "Mandame la medida en *ancho x alto*.",
    "",
    "También ayuda una foto del lugar para orientarte mejor.",
  ];

  if (product) addNavigation(lines, navigation);

  lines.push("Con eso preparo el siguiente paso para cotizarlo bien. ✨");
  return cleanMessage(lines);
}

function buildProductResponse({ productResult, navigation }) {
  const product = productResult.primaryProduct;

  if (!product) {
    return cleanMessage([
      "Hola 👋",
      "¡Bienvenido a *ELANVISUAL*!",
      "",
      "Te ayudo con rótulos, botones luminosos, letras 3D, fachadas ACM, vinil e impresión.",
      "",
      "¿Qué producto querés cotizar?",
      "Si tenés foto o medida aproximada, mandámela y avanzamos. ✨",
    ]);
  }

  const label = labelProduct(product);
  const lines = [
    "Hola 👋",
    `¡Claro! Te puedo ayudar con un *${label}* para tu negocio.`,
    "",
    ...productPrompt(product),
    "",
  ];

  addNavigation(lines, navigation);
  lines.push("Cuando me pasés esos datos, preparo el siguiente paso para cotizarlo. ✨");

  return cleanMessage(lines);
}

function buildConsentOrFollowUpResponse({ productResult, navigation, followUp, marketingConsent }) {
  const lines = [];

  if (marketingConsent?.detected) {
    lines.push(
      marketingConsent.granted
        ? "¡Perfecto! 🙌\nTe dejo marcado para recibir promociones, descuentos y novedades de ELANVISUAL."
        : "Entendido 👌\nNo te marcaré para promociones."
    );
  }

  if (followUp?.detected) {
    if (followUp.wantsFollowUp === false) {
      lines.push("Listo, dejo marcado que no deseas seguimiento comercial.");
    } else if (followUp.followUpAt) {
      lines.push(`Perfecto 👌\nTe escribo en *${followUp.label.toLowerCase()}* para dar seguimiento.`);
    } else {
      lines.push("Perfecto 👌\nQueda para cuando vos lo solicités.");
    }
  }

  if (productResult.detected) {
    addNavigation(lines, navigation);
  }

  lines.push("Cuando querás cotizar algo, escribime por aquí. ✨");
  return cleanMessage(lines);
}

export function buildSalesResponse({ intents = {}, productResult = {}, visit = {}, navigation = {}, followUp = {}, marketingConsent = {} } = {}) {
  if (visit.detected) {
    return buildVisitResponse();
  }

  if (intents.price) {
    return buildPriceResponse({ productResult, navigation });
  }

  if (intents.measures) {
    return buildMeasuresResponse({ productResult, navigation });
  }

  if ((marketingConsent.detected || followUp.detected) && !productResult.detected) {
    return buildConsentOrFollowUpResponse({ productResult, navigation, followUp, marketingConsent });
  }

  if (productResult.detected || intents.productInquiry) {
    return buildProductResponse({ productResult, navigation });
  }

  return buildProductResponse({ productResult, navigation });
}
