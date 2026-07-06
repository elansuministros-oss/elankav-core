import OpenAI from "openai";
import { buildCommercialPolicyPrompt } from "./commercial-policy.js";

const MAX_LINES = 5;
const MAX_CHARS = 600;

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
  "boton-luminoso": "Es una excelente opción para darle presencia al negocio.",
  "letras-3d": "Ayudan a que la marca se vea más sólida y memorable.",
  "fachada-acm": "Hace que el local se vea más moderno, limpio y profesional.",
  rotulo: "Ayuda a que el negocio sea visible, claro y confiable.",
  vinil: "Funciona muy bien para comunicar, decorar o reforzar la imagen del local.",
  impresion: "Permite comunicar la marca con buena presencia visual.",
};

function productLabel(product = {}) {
  return PRODUCT_LABELS[product.id] || product.serviceName || product.name || "proyecto visual";
}

function productBenefit(product = {}) {
  return PRODUCT_BENEFITS[product.id] || "La clave es resolverlo con buen diseño, materiales correctos y una ejecución limpia.";
}

function compactResponse(text = "") {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);

  let output = lines.join("\n").trim();
  const questionLines = output.split("\n").filter((line) => line.includes("?") || line.includes("¿"));

  if (questionLines.length > 1) {
    let keptQuestion = false;
    output = output
      .split("\n")
      .filter((line) => {
        const isQuestion = line.includes("?") || line.includes("¿");
        if (!isQuestion) return true;
        if (keptQuestion) return false;
        keptQuestion = true;
        return true;
      })
      .join("\n");
  }

  if (output.length <= MAX_CHARS) return output;
  return output.slice(0, MAX_CHARS - 1).trim();
}

function usefulLines(text = "") {
  return String(text || "").split("\n").filter((line) => line.trim());
}

function questionText(text = "") {
  const match = String(text || "").match(/¿([^?]+)\?/);
  if (match?.[1]) return match[1].toLowerCase();

  const parts = String(text || "").split("?");
  return parts.length > 1 ? parts[0].split(".").pop().toLowerCase() : "";
}

function mentionsMultipleDataPoints(question = "") {
  const categories = [];
  if (question.includes("medida")) categories.push("medida");
  if (question.includes("interior") || question.includes("exterior")) categories.push("placement");
  if (question.includes("logo")) categories.push("logo");
  if (question.includes("foto")) categories.push("foto");
  if (question.includes("ubicacion") || question.includes("ubicación") || question.includes("ciudad") || question.includes("municipio")) {
    categories.push("ubicacion");
  }

  return Array.from(new Set(categories)).length > 1;
}

function asksKnownData(question = "", memory = {}) {
  if (memory.measure && question.includes("medida")) return true;
  if (memory.placement && (question.includes("interior") || question.includes("exterior"))) return true;
  if (memory.logoStatus && question.includes("logo")) return true;
  if (memory.photoReceived && question.includes("foto")) return true;
  if (memory.location && (question.includes("ubicacion") || question.includes("ubicación") || question.includes("ciudad") || question.includes("municipio"))) return true;
  return false;
}

function stepQuestionIsValid(step = "", question = "", memory = {}) {
  if (step === "ask_measure" || step === "share_public_price" && !memory.measure) {
    return question.includes("medida");
  }

  if (step === "ask_placement" || step === "share_public_price" && memory.measure && !memory.placement) {
    return question.includes("interior") || question.includes("exterior");
  }

  if (step === "ask_logo" || step === "share_public_price" && memory.measure && memory.placement && !memory.logoStatus) {
    return question.includes("logo");
  }

  if (step === "ask_photo") return question.includes("foto");
  if (step === "ask_visit_location") return question.includes("ciudad") || question.includes("municipio") || question.includes("ubicacion") || question.includes("ubicación");

  return true;
}

function isCommerciallyValidResponse(text = "", context = {}) {
  const compact = compactResponse(text);
  const questionMarks = (compact.match(/\?/g) || []).length + (compact.match(/¿/g) || []).length;
  const question = questionText(compact);

  if (!compact) return false;
  if (compact.length > MAX_CHARS) return false;
  if (usefulLines(compact).length > MAX_LINES) return false;
  if (questionMarks > 2) return false;
  if (mentionsMultipleDataPoints(question)) return false;
  if (asksKnownData(question, context.memory || {})) return false;
  if (!stepQuestionIsValid(context.step, question, context.memory || {})) return false;

  return true;
}

function formatMemoryValue(value = "") {
  return value ? `*${value}*` : "";
}

function nextQuestionForStep(step = "", memory = {}, product = {}) {
  if (step === "answer_ai_identity") {
    if (!memory.productId) return "¿En qué puedo apoyarte hoy?";
    if (!memory.measure) return `📐 ¿Qué medida aproximada querés para el *${productLabel(product)}*?`;
    if (!memory.placement) return "¿Será para interior o exterior?";
    return "¿Seguimos con la cotización?";
  }
  if (step === "ask_measure") return `📐 ¿Qué medida aproximada querés para el *${productLabel(product)}*?`;
  if (step === "ask_placement") return "¿Será para interior o exterior?";
  if (step === "ask_logo") return "¿Ya tenés el logo en archivo o imagen?";
  if (step === "ask_photo") return "📷 ¿Podés enviarme una foto del lugar donde irá instalado?";
  if (step === "ask_product") return "¿En qué puedo apoyarte hoy?";
  if (step === "share_public_price") {
    if (!memory.measure) return `📐 ¿Qué medida aproximada querés para el *${productLabel(product)}*?`;
    if (!memory.placement) return "¿Será para interior o exterior?";
    if (!memory.logoStatus) return "¿Ya tenés el logo en archivo o imagen?";
    return "¿Avanzamos con la cotización?";
  }
  if (step === "ask_visit_location") return "📍 ¿En qué ciudad o municipio está ubicado?";
  if (step === "ask_marketing") return "¿Te gustaría recibir promociones, novedades y descuentos de ELANVISUAL por WhatsApp?";
  if (step === "ask_followup") return "¿Cuándo preferís que vuelva a escribirte?";
  if (memory.productId && !memory.measure) return `📐 ¿Qué medida aproximada querés para el *${productLabel(product)}*?`;
  if (memory.productId && !memory.placement) return "¿Será para interior o exterior?";
  return "¿Seguimos con ese proyecto o es otro nuevo?";
}

function buildCatalogPriceLine(pricing = {}) {
  if (!pricing.canMentionPrice || !pricing.price?.text) return "";
  const name = pricing.publishedProduct?.officialName || "modelo publicado";
  return `Tenemos *${name}* ${pricing.price.text}, según diseño y acabado.`;
}

function buildFallbackResponse(context = {}) {
  const {
    step = "",
    messageClassification = {},
    memory = {},
    productResult = {},
    pricing = {},
    navigation = {},
    followUp = {},
    marketingConsent = {},
    multimodal = {},
  } = context;

  const product = productResult.primaryProduct || null;
  const question = nextQuestionForStep(step, memory, product);
  const priceLine = buildCatalogPriceLine(pricing);

  if (step === "answer_ai_identity") {
    return compactResponse([
      "Sí, soy ELAN AI 😊",
      "Trabajo con el equipo de ELANKAV para atenderte más rápido, ordenar tu proyecto y ayudarte a cotizar.",
      "Si tu caso requiere revisión humana, el equipo continúa contigo.",
      question,
    ].join("\n"));
  }

  if (step === "recover_context") {
    const knownMeasure = memory.measure ? `Ya tengo la medida: ${formatMemoryValue(memory.measure)}.` : "";
    return compactResponse([
      "Disculpá, tenés razón.",
      "Retomo el contexto para no hacerte repetir.",
      knownMeasure,
      question,
    ].join("\n"));
  }

  if (step === "ack_name_continue") {
    const name = memory.name ? `Gracias, ${memory.name}.` : "Gracias, lo dejo anotado.";
    return compactResponse([
      name,
      product ? `Lo guardo en el expediente del *${productLabel(product)}*.` : "Lo guardo en tu expediente.",
      memory.measure ? `Ya tengo la medida: ${formatMemoryValue(memory.measure)}.` : "",
      question,
    ].join("\n"));
  }

  if (step === "ask_visit_location") {
    return compactResponse([
      "Claro.",
      "Realizamos visitas técnicas cuando el proyecto lo requiere.",
      "Si la zona queda lejos, puede aplicar costo de desplazamiento.",
      "📍 ¿En qué ciudad o municipio está ubicado?",
    ].join("\n"));
  }

  if (step === "visit_ready") {
    return compactResponse([
      "Perfecto, tomo la ubicación como referencia.",
      "La visita técnica ayuda a revisar medidas, instalación y condiciones del lugar.",
      "📷 ¿Podés enviarme una foto del frente del negocio?",
    ].join("\n"));
  }

  if (step === "photo_received" || multimodal.modality === "image") {
    return compactResponse([
      "Gracias por la foto 📷",
      "Ya me ayuda a entender mejor el espacio.",
      question,
    ].join("\n"));
  }

  if (step === "audio_received" || multimodal.modality === "audio") {
    return compactResponse([
      "Gracias por el audio ✅",
      "Lo recibí y lo tomo como referencia para el expediente.",
      question,
    ].join("\n"));
  }

  if (step === "document_received" || multimodal.modality === "document" || multimodal.modality === "pdf") {
    return compactResponse([
      "Archivo recibido ✅",
      "Lo vamos a usar como referencia para preparar la cotización.",
      question,
    ].join("\n"));
  }

  if (step === "ack_marketing") {
    return compactResponse([
      marketingConsent.granted ? "Perfecto, queda registrado ✅" : "Entendido, no te escribiré promociones.",
      "Cuidamos que el seguimiento sea útil, no invasivo.",
      "¿Cuándo preferís que vuelva a escribirte?",
    ].join("\n"));
  }

  if (step === "ack_followup") {
    return compactResponse([
      "Perfecto ✅",
      `Dejo registrado el seguimiento: *${followUp.label || "tu preferencia"}*.`,
      "Cuando tengamos la información completa, avanzamos ordenadamente.",
    ].join("\n"));
  }

  if (step === "send_references") {
    return compactResponse([
      "Con eso ya tenemos una base clara ✅",
      navigation?.url ? `Podés ver referencias aquí: ${navigation.url}` : "",
      "¿Avanzamos con la cotización?",
    ].join("\n"));
  }

  if (step === "quote_ready") {
    return compactResponse([
      "Con estos datos ya podemos preparar la cotización ✅",
      "La revisión final pasa por ECE/AI-23 para validar materiales, costos y precio.",
      "¿Confirmamos esta base para cotizar?",
    ].join("\n"));
  }

  if (step === "ask_marketing") {
    return compactResponse([
      "Perfecto, seguimos con la cotización ✅",
      "Antes de cerrar el registro:",
      "¿Te gustaría recibir promociones, novedades y descuentos de ELANVISUAL por WhatsApp?",
    ].join("\n"));
  }

  if (step === "ask_followup") {
    return compactResponse([
      "Gracias, queda registrado ✅",
      "Opciones: una semana, 15 días, un mes o solo cuando vos escribás.",
      "¿Cuándo preferís que vuelva a escribirte?",
    ].join("\n"));
  }

  if (step === "share_public_price") {
    return compactResponse([
      "¡Claro! ✨",
      priceLine,
      "Si cambia medida, iluminación o acabado, se valida antes de cotizar final.",
      question,
    ].join("\n"));
  }

  if (step === "ask_measure" && product) {
    return compactResponse([
      "¡Claro! ✨",
      priceLine || `Un *${productLabel(product)}* ${productBenefit(product).toLowerCase()}`,
      question,
    ].join("\n"));
  }

  if (step === "ask_placement") {
    return compactResponse([
      "Perfecto, esa medida nos da una buena base.",
      memory.measure ? `Tomo como referencia: ${formatMemoryValue(memory.measure)}.` : "",
      question,
    ].join("\n"));
  }

  if (step === "ask_logo") {
    return compactResponse([
      "Muy bien ✅",
      memory.placement === "exterior"
        ? "Para exterior cuidamos resistencia, visibilidad y acabado."
        : "Para interior cuidamos proporción, lectura y acabado.",
      question,
    ].join("\n"));
  }

  if (step === "ask_photo") {
    return compactResponse([
      memory.logoStatus === "tiene"
        ? "Buenísimo, el logo nos ayuda a avanzar mejor."
        : "No hay problema, también podemos orientarte con el diseño.",
      "Una foto del lugar ayuda a recomendar mejor tamaño y ubicación.",
      question,
    ].join("\n"));
  }

  if (step === "ask_product") {
    return compactResponse([
      "Hola 👋",
      "¡Gracias por escribir a ELANVISUAL!",
      "Con gusto te ayudo.",
      question,
    ].join("\n"));
  }

  if (messageClassification.primary === "mensaje_general" && memory.productId) {
    return compactResponse(["Entendido.", "Retomo tu proyecto para no perder el hilo.", question].join("\n"));
  }

  return compactResponse([
    "Disculpá, quiero ayudarte bien.",
    "No quiero asumir algo incorrecto.",
    "¿Me confirmás si seguimos con el proyecto que mencionaste o es otro nuevo?",
  ].join("\n"));
}

function shouldUseOpenAI() {
  if (!process.env.OPENAI_API_KEY) return false;
  if (process.env.ELAN_AI_DISABLE_LLM === "true") return false;
  return true;
}

function buildModelInput(context = {}) {
  const safeContext = {
    message: context.normalized?.body || "",
    step: context.step,
    classification: context.messageClassification?.primary,
    memory: context.memory,
    product: context.productResult?.primaryProduct
      ? {
          id: context.productResult.primaryProduct.id,
          name: productLabel(context.productResult.primaryProduct),
        }
      : null,
    pricing: context.pricing,
    navigation: context.navigation,
    missingData: context.missingData,
    commercialPolicy: context.policy,
  };

  return [
    buildCommercialPolicyPrompt(),
    "Redactá solo la respuesta final para WhatsApp en español de Nicaragua.",
    "No expliques reglas internas. No uses más de una pregunta. Esa pregunta debe pedir un solo dato.",
    "Si ya existe medida, no preguntes medida. Si ya existe interior/exterior, no lo preguntes de nuevo.",
    `Contexto JSON:\n${JSON.stringify(safeContext, null, 2)}`,
  ].join("\n\n");
}

async function generateWithOpenAI(context = {}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.ELAN_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: buildModelInput(context),
    max_output_tokens: 220,
    temperature: 0.45,
  });

  return compactResponse(response.output_text || "");
}

export async function generateCommercialResponse(context = {}) {
  const fallback = () => buildFallbackResponse(context);

  if (!shouldUseOpenAI()) {
    return {
      text: fallback(),
      generator: "local_contextual_fallback",
    };
  }

  try {
    const text = await generateWithOpenAI(context);
    if (!isCommerciallyValidResponse(text, context)) {
      return {
        text: fallback(),
        generator: "local_contextual_fallback_policy_guard",
      };
    }

    return {
      text,
      generator: "openai_responses",
    };
  } catch (error) {
    return {
      text: fallback(),
      generator: "local_contextual_fallback_llm_error",
      error: error.message || "LLM error",
    };
  }
}
