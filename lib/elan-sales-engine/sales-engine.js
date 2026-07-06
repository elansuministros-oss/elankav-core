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

const PRODUCT_BENEFITS = {
  "boton-luminoso": "Los botones luminosos son ideales para darle mayor visibilidad a un negocio.",
  "letras-3d": "Las letras 3D elevan la presencia de marca y se ven muy bien en fachadas o recepción.",
  "fachada-acm": "Una fachada ACM ayuda a que el negocio se vea más sólido, moderno y profesional.",
  rotulo: "Un buen rótulo ayuda a que el negocio se vea claro, visible y confiable.",
  vinil: "El vinil funciona muy bien para comunicar, decorar o reforzar la imagen del local.",
  impresion: "La impresión correcta ayuda a que la marca se vea limpia y profesional.",
};

function labelProduct(product = {}) {
  return PRODUCT_LABELS[product.id] || product.serviceName || product.name || "producto visual";
}

function productBenefit(product = {}) {
  return PRODUCT_BENEFITS[product.id] || "La clave es que se vea claro, bien fabricado y coherente con tu marca.";
}

function cleanMessage(lines = []) {
  const text = lines
    .filter((line) => line !== null && line !== undefined)
    .map((line) => String(line).trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= MAX_WHATSAPP_CHARS) return text;
  return `${text.slice(0, 548).trim()}\n\nTe guío paso a paso. ✨`;
}

function compactUrl(navigation = {}) {
  return navigation?.shouldSend && navigation.url ? navigation.url : "";
}

function buildGreeting() {
  return cleanMessage([
    "Hola 👋",
    "¡Gracias por escribir a ELANVISUAL!",
    "Con gusto te ayudo.",
    "¿En qué puedo apoyarte hoy?",
  ]);
}

function buildAskMeasure(product) {
  return cleanMessage([
    "✨ Excelente elección.",
    productBenefit(product),
    `📐 ¿Qué medida aproximada necesitás para el *${labelProduct(product)}*?`,
  ]);
}

function buildAskPlacement(memory = {}) {
  return cleanMessage([
    "Perfecto, esa medida nos da una buena base.",
    memory.measure ? `Tomo como referencia: *${memory.measure}*.` : "",
    "¿Será para interior o exterior?",
  ]);
}

function buildAskLogo(memory = {}) {
  const context =
    memory.placement === "exterior"
      ? "Para exterior cuidamos materiales, visibilidad y resistencia."
      : "Para interior cuidamos acabado, lectura y proporción.";

  return cleanMessage([
    "Muy bien ✅",
    context,
    "¿Ya tenés el logo en archivo o imagen?",
  ]);
}

function buildAskPhoto(memory = {}) {
  const logoLine =
    memory.logoStatus === "tiene"
      ? "Buenísimo, ese logo nos ayuda a avanzar mejor."
      : "No hay problema, también podemos orientarte con el diseño.";

  return cleanMessage([
    logoLine,
    "Una foto del lugar nos ayuda a recomendar mejor tamaño y ubicación.",
    "📷 ¿Podés enviarme una foto de donde irá instalado?",
  ]);
}

function buildReferences(product, navigation = {}) {
  const url = compactUrl(navigation);

  return cleanMessage([
    "Gracias, con eso ya tenemos una base clara. ✅",
    "Te dejo referencias para que veás el estilo visual:",
    url,
    "¿Avanzamos con la cotización?",
  ]);
}

function buildQuoteReady() {
  return cleanMessage([
    "✅ Con estos datos ya podemos preparar la cotización.",
    "La idea es que salga ordenada y sin inventar precios.",
    "¿Confirmamos esta base para cotizar?",
  ]);
}

function buildAskMarketing() {
  return cleanMessage([
    "Perfecto, seguimos con la cotización. ✅",
    "Antes de cerrar el registro:",
    "¿Te gustaría recibir promociones, novedades y descuentos de ELANVISUAL por WhatsApp?",
  ]);
}

function buildAskFollowUp() {
  return cleanMessage([
    "Gracias, queda registrado. ✅",
    "¿Cuándo preferís que vuelva a escribirte?",
    "Opciones: una semana, 15 días, un mes o solo cuando vos escribás.",
  ]);
}

function buildVisitResponse(memory = {}) {
  if (memory.location) {
    return cleanMessage([
      "Claro, realizamos visitas técnicas cuando el proyecto lo requiere.",
      `📍 Tomo como referencia: *${memory.location}*.`,
      "¿Podés enviarme una foto del frente del negocio?",
    ]);
  }

  return cleanMessage([
    "Claro.",
    "Realizamos visitas técnicas cuando el proyecto lo requiere.",
    "📍 ¿En qué ciudad o municipio está ubicado?",
  ]);
}

function buildPhotoResponse(product, navigation = {}, memory = {}) {
  if (!memory.productId) {
    return cleanMessage([
      "Gracias por la foto 📷",
      "Ya nos ayuda a entender mejor el espacio.",
      "¿Qué producto querés cotizar?",
    ]);
  }

  if (memory.productId && memory.measure && memory.placement && memory.logoStatus) {
    const url = compactUrl(navigation);

    return cleanMessage([
      "Gracias por la foto 📷",
      "Con eso ya tenemos una base clara.",
      url,
      "¿Avanzamos con la cotización?",
    ]);
  }

  return cleanMessage([
    "Gracias por la foto 📷",
    "Ya nos ayuda a entender mejor el espacio.",
    memory.measure ? "¿Será para interior o exterior?" : "📐 ¿Qué medida aproximada necesitás?",
  ]);
}

function buildAudioResponse(memory = {}) {
  return cleanMessage([
    "Gracias por el audio ✅",
    "Lo recibí y lo tomaré como referencia para la cotización.",
    memory.productId ? "📐 ¿Qué medida aproximada necesitás?" : "¿Qué producto querés cotizar?",
  ]);
}

function buildDocumentResponse(memory = {}) {
  return cleanMessage([
    "Archivo recibido ✅",
    "Lo vamos a usar como referencia para preparar la cotización.",
    memory.productId ? "📐 ¿Qué medida aproximada necesitás?" : "¿Qué producto querés cotizar?",
  ]);
}

function buildMarketingAck(marketingConsent = {}) {
  return cleanMessage([
    marketingConsent.granted ? "Perfecto, queda registrado. ✅" : "Entendido, no te marcaré para promociones. ✅",
    "Cuidamos mucho el seguimiento para que sea útil, no invasivo.",
    "¿Cuándo preferís que vuelva a escribirte?",
  ]);
}

function buildFollowUpAck(followUp = {}) {
  const label = followUp.label || "tu preferencia";

  return cleanMessage([
    "Perfecto ✅",
    `Dejo registrado el seguimiento: *${label}*.`,
    "Cuando tengamos la información completa, avanzamos con la cotización.",
  ]);
}

function buildPriceResponse(product, memory = {}) {
  if (product?.id && !memory.measure) return buildAskMeasure(product);

  return cleanMessage([
    "Con gusto te ayudo con el precio.",
    "Para cotizar bien no conviene dar un número al aire.",
    "📐 ¿Qué medida aproximada necesitás?",
  ]);
}

export function buildSalesResponse({
  intents = {},
  productResult = {},
  visit = {},
  navigation = {},
  followUp = {},
  marketingConsent = {},
  memory = {},
  conversationStep = "",
  multimodal = {},
} = {}) {
  const product = productResult.primaryProduct;

  if (visit.detected || conversationStep === "ask_visit_location" || conversationStep === "visit_ready") {
    return buildVisitResponse(memory);
  }

  if (multimodal.modality === "audio" || conversationStep === "audio_received") {
    return buildAudioResponse(memory);
  }

  if (multimodal.modality === "document" || multimodal.modality === "pdf" || conversationStep === "document_received") {
    return buildDocumentResponse(memory);
  }

  if (multimodal.modality === "image" || conversationStep === "photo_received") {
    return buildPhotoResponse(product, navigation, memory);
  }

  if (conversationStep === "ack_marketing") return buildMarketingAck(marketingConsent);
  if (conversationStep === "ack_followup") return buildFollowUpAck(followUp);

  if (intents.price && !productResult.detected && !memory.productId) {
    return buildPriceResponse(product, memory);
  }

  if (conversationStep === "ask_product") return buildGreeting();
  if (conversationStep === "ask_measure" && product) return buildAskMeasure(product);
  if (conversationStep === "ask_placement") return buildAskPlacement(memory);
  if (conversationStep === "ask_logo") return buildAskLogo(memory);
  if (conversationStep === "ask_photo") return buildAskPhoto(memory);
  if (conversationStep === "send_references" && product) return buildReferences(product, navigation);
  if (conversationStep === "quote_ready") return buildQuoteReady();
  if (conversationStep === "ask_marketing") return buildAskMarketing();
  if (conversationStep === "ask_followup") return buildAskFollowUp();

  if (product) return buildAskMeasure(product);
  return buildGreeting();
}
