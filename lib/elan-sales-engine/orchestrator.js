import { analyzeMarketingConsent } from "./marketing-consent-engine.js";
import { detectBusinessContext } from "./business-context-engine.js";
import { classifyCustomerMessage } from "./classification-engine.js";
import { ELAN_AI_COMMERCIAL_POLICY } from "./commercial-policy.js";
import { analyzeFollowUpPreference } from "./follow-up-engine.js";
import { calculateCommercialMaturity } from "./imc-engine.js";
import { detectSalesIntents } from "./intent-engine.js";
import { buildLeadFieldsFromSalesResult } from "./lead-engine.js";
import {
  getConversationMemory,
  getConversationStep,
  getCustomerIdentity,
  getEffectiveProductResult,
  markConversationStep,
  saveConversationMemory,
  updateConversationMemory,
} from "./memory-engine.js";
import { analyzeMultimodalInput } from "./multimodal-engine.js";
import { getNavigationForProduct } from "./navigation-engine.js";
import { resolveCommercialPricing } from "./pricing-resolver.js";
import { detectElanVisualProduct } from "./product-engine.js";
import { buildMaterialResolutionRequirement } from "./provider-material-resolution.js";
import { resolvePublicCatalog } from "./public-catalog-resolver.js";
import { generateCommercialResponse } from "./llm-response-generator.js";
import { analyzeVisitRequest } from "./visit-engine.js";
import { fachadasComercialesLetras3D01, rotuloAcrilicoBoton01, fachadaAcmLetrasAcrilicoLuzFrontal01, rotuloJalavistaDobleCara01 } from "./campaign-contexts.js";
import { normalizeText } from "./text-utils.js";

function hasReplyableContent(normalized = {}, multimodal = {}) {
  return Boolean(normalized.body?.trim()) || (normalized.hasMedia && multimodal.supported) || multimodal.modality === "location";
}

function includesAnyTerm(message = "", terms = []) {
  const normalized = normalizeText(message);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function detectHumanHandoff({ message = "", multimodal = {}, messageClassification = {}, memory = {}, pricing = {} } = {}) {
  const humanRequest = includesAnyTerm(message, [
    "quiero hablar con un asesor",
    "quiero hablar con asesor",
    "pasame con un asesor",
    "pasame con asesor",
    "pasame con una persona",
    "quiero hablar con una persona",
    "quiero hablar con alguien",
    "hablar con alguien",
    "no quiero hablar con una ia",
    "no quiero hablar con ia",
    "necesito un vendedor",
    "pasame con un vendedor",
    "quiero hablar con erick",
    "quiero hablar con el dueño",
    "llamame",
    "me pueden llamar",
    "que me llamen",
  ]);

  const paymentSignal =
    multimodal.modality === "image" &&
    includesAnyTerm(message, [
      "comprobante",
      "deposito",
      "depósito",
      "transferencia",
      "anticipo",
      "pago",
      "pagado",
      "ya pague",
      "ya pagué",
      "ya hice el deposito",
      "ya hice el depósito",
      "ya transferi",
      "ya transferí",
    ]);

  const paymentText = includesAnyTerm(message, [
    "comprobante",
    "deposito",
    "depósito",
    "transferencia",
    "anticipo",
    "pago",
    "pagado",
    "ya pague",
    "ya pagué",
    "ya hice el deposito",
    "ya hice el depósito",
    "ya transferi",
    "ya transferí",
  ]);

  const frustration = Boolean(messageClassification.categories?.frustration || messageClassification.categories?.mildInsult);

  const quoteReady = Boolean(memory.productId && memory.measure && memory.placement && memory.logoStatus && memory.photoReceived);
  const highIntent = Boolean(
    messageClassification.categories?.quoteRequest ||
      messageClassification.categories?.price ||
      pricing.canMentionPrice ||
      quoteReady
  );

  if (humanRequest) {
    return {
      required: true,
      reason: "human_request",
      label: "Cliente solicitó atención humana directa",
      priority: "alta",
    };
  }

    if (paymentSignal || paymentText) {
    return {
      required: true,
      reason: "payment_or_deposit",
      label: "Cliente mencionó pago, anticipo, transferencia o comprobante",
      priority: "critica",
    };
  }

  if (multimodal.modality === "image") {
    return {
      required: true,
      reason: "image_received",
      label: "Cliente envió una imagen para revisión",
      priority: "alta",
    };
  }

  if (frustration) {
    return {
      required: true,
      reason: "customer_frustration",
      label: "Cliente muestra molestia o frustración",
      priority: "alta",
    };
  }

  if (frustration) {
    return {
      required: true,
      reason: "customer_frustration",
      label: "Cliente muestra molestia o frustración",
      priority: "alta",
    };
  }

  if (quoteReady && highIntent) {
    return {
      required: true,
      reason: "high_closing_probability",
      label: "Cliente tiene datos suficientes y alta probabilidad de cierre",
      priority: "media",
    };
  }

  return {
    required: false,
    reason: "",
    label: "",
    priority: "",
  };
}

function nextQuestionForStep(step = "", memory = {}) {
  const questions = {
    ask_product: "¿En qué puedo apoyarte hoy?",
    ask_measure: "¿Qué medida aproximada querés?",
    ask_placement: "¿Será para interior o exterior?",
    ask_logo: "¿Ya tenés el logo en archivo o imagen?",
    ask_photo: "¿Podés enviarme una foto del lugar donde irá instalado?",
    ask_visit_location: "¿En qué ciudad o municipio está ubicado?",
    ask_marketing: "¿Te gustaría recibir promociones, novedades y descuentos de ELANVISUAL por WhatsApp?",
    ask_followup: "¿Cuándo preferís que vuelva a escribirte?",
    recover_context: "¿Seguimos con el dato pendiente?",
    ack_name_continue: "¿Seguimos con el dato pendiente?",
  };

  if (step === "share_public_price") {
    if (!memory.measure) return "¿Qué medida aproximada querés?";
    if (!memory.placement) return "¿Será para interior o exterior?";
    if (!memory.logoStatus) return "¿Ya tenés el logo en archivo o imagen?";
    return "¿Avanzamos con la cotización?";
  }

  return questions[step] || "";
}

function buildCustomerProfile(memory = {}, identity = {}) {
  return {
    customerKey: memory.customerKey || identity.customerKey,
    name: memory.name || "",
    phone: memory.phone || identity.phone || "",
    whatsappId: memory.whatsappId || identity.whatsappId || "",
    lid: memory.lid || identity.lid || "",
    businessName: memory.businessName || "",
    commercialStage: memory.commercialStage || "Exploracion",
    historySummary: memory.historySummary || "",
  };
}

export async function runElanAiSalesOrchestrator({ normalized = {}, now = new Date() } = {}) {
  const message = normalized.body || "";
  const multimodal = analyzeMultimodalInput(normalized);

  if (normalized.event !== "message" || !normalized.isInbound || !hasReplyableContent(normalized, multimodal)) {
    return {
      ok: true,
      shouldReply: false,
      responseText: "",
      analysis: {
        reason: normalized.event === "message" ? "evento_no_respondible" : "evento_ignorado_para_respuesta",
        multimodal,
      },
      leadFields: null,
    };
  }

  const identity = getCustomerIdentity(normalized);
  const initialMemory = getConversationMemory(normalized, { now: now.getTime() });
  const business = detectBusinessContext({ message, normalized });
  const detectedProduct = business.unit === "ELANVISUAL" ? detectElanVisualProduct(message) : detectElanVisualProduct("");
  const productBeforeMemory = getEffectiveProductResult(detectedProduct, initialMemory);
  const messageClassification = classifyCustomerMessage({
    message,
    normalized,
    multimodal,
    memory: initialMemory,
    productResult: productBeforeMemory,
  });
  const intents = detectSalesIntents(message, productBeforeMemory);
  const visit = analyzeVisitRequest(message);
  const followUp = analyzeFollowUpPreference(message, now);
  const marketingConsent = analyzeMarketingConsent(message);
  const updatedMemory = updateConversationMemory(initialMemory, {
    message,
    productResult: detectedProduct,
    multimodal,
    followUp,
    marketingConsent,
    visit,
    normalized,
    messageClassification,
  });
  const product = getEffectiveProductResult(detectedProduct, updatedMemory);
  const navigation = getNavigationForProduct(product.primaryProduct);
  const materialResolution = buildMaterialResolutionRequirement({
    normalized,
    productResult: product,
    memory: updatedMemory,
    now,
  });
  const catalog = resolvePublicCatalog({
    message,
    productResult: product,
    memory: updatedMemory,
  });
  const pricing = resolveCommercialPricing({
    catalog,
    productResult: product,
    materialResolution,
  });
  const humanHandoff = detectHumanHandoff({
    message,
    multimodal,
    messageClassification,
    memory: updatedMemory,
    pricing,
  });
  const step = getConversationStep(updatedMemory, {
    visit,
    multimodal,
    marketingConsent,
    followUp,
    messageClassification,
    pricing,
  });
  const imc = calculateCommercialMaturity({
    businessContext: business,
    productResult: product,
    intents,
    followUp,
    marketingConsent,
    multimodal,
  });
  const customerProfile = buildCustomerProfile(updatedMemory, identity);
  const generatorContext = {
    normalized,
    now: now.toISOString(),
    step,
    business,
    customerProfile,
    memory: updatedMemory,
    messageClassification,
    productResult: product,
    intents,
    visit,
    followUp,
    marketingConsent,
    navigation,
    materialResolution,
    catalog,
    pricing,
    multimodal,
    imc,
    humanHandoff,
    missingData: updatedMemory.missingData,
campaignContext: rotuloJalavistaDobleCara01,
    policy: ELAN_AI_COMMERCIAL_POLICY,
  };

  const generated = await generateCommercialResponse(generatorContext);
  const finalMemory = markConversationStep(updatedMemory, step, {
    lastQuestion: nextQuestionForStep(step, updatedMemory),
  });
  saveConversationMemory(finalMemory, { now: now.getTime() });

  const result = {
    ok: true,
    shouldReply: true,
    responseText: generated.text,
    analysis: {
      orchestrator: "ELAN_AI_SALES_ORCHESTRATOR_V1",
      generator: generated.generator,
      generatorError: generated.error || null,
      business,
      customerProfile: buildCustomerProfile(finalMemory, identity),
      product,
      intents,
      messageClassification,
      visit,
      followUp,
      marketingConsent,
      navigation,
      materialResolution,
      catalog,
      pricing,
      multimodal,
      imc,
      humanHandoff,
      memory: finalMemory,
      conversationStep: step,
      commercialPolicy: ELAN_AI_COMMERCIAL_POLICY,
    },
  };

  return {
    ...result,
    leadFields: buildLeadFieldsFromSalesResult(normalized, result),
  };
}