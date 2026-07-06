import { detectBusinessContext } from "./business-context-engine.js";
import { classifyCustomerMessage } from "./classification-engine.js";
import { ELAN_AI_COMMERCIAL_POLICY } from "./commercial-policy.js";
import { analyzeFollowUpPreference } from "./follow-up-engine.js";
import { calculateCommercialMaturity } from "./imc-engine.js";
import { detectSalesIntents } from "./intent-engine.js";
import { buildLeadFieldsFromSalesResult } from "./lead-engine.js";
import { analyzeMarketingConsent } from "./marketing-consent-engine.js";
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

function hasReplyableContent(normalized = {}, multimodal = {}) {
  return Boolean(normalized.body?.trim()) || (normalized.hasMedia && multimodal.supported) || multimodal.modality === "location";
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
    missingData: updatedMemory.missingData,
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
