import { detectBusinessContext } from "./business-context-engine.js";
import { detectElanVisualProduct } from "./product-engine.js";
import { detectSalesIntents } from "./intent-engine.js";
import { getNavigationForProduct } from "./navigation-engine.js";
import { analyzeFollowUpPreference } from "./follow-up-engine.js";
import { analyzeMarketingConsent } from "./marketing-consent-engine.js";
import { analyzeVisitRequest } from "./visit-engine.js";
import { analyzeMultimodalInput } from "./multimodal-engine.js";
import { calculateCommercialMaturity } from "./imc-engine.js";
import { buildSalesResponse } from "./sales-engine.js";
import { buildLeadFieldsFromSalesResult } from "./lead-engine.js";
import {
  getConversationMemory,
  getConversationStep,
  getEffectiveProductResult,
  markConversationStep,
  saveConversationMemory,
  updateConversationMemory,
} from "./memory-engine.js";
import { buildMaterialResolutionRequirement } from "./provider-material-resolution.js";

export async function processSalesConversation({ normalized = {}, now = new Date() } = {}) {
  const message = normalized.body || "";
  const multimodal = analyzeMultimodalInput(normalized);
  const hasReplyableContent = Boolean(message.trim()) || (normalized.hasMedia && multimodal.supported) || multimodal.modality === "location";

  if (normalized.event !== "message" || !normalized.isInbound || !hasReplyableContent) {
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

  const business = detectBusinessContext({ message, normalized });
  const detectedProduct = business.unit === "ELANVISUAL" ? detectElanVisualProduct(message) : detectElanVisualProduct("");
  const memory = getConversationMemory(normalized.chatId, { now: now.getTime() });
  const product = getEffectiveProductResult(detectedProduct, memory);
  const intents = detectSalesIntents(message, product);
  const visit = analyzeVisitRequest(message);
  const followUp = analyzeFollowUpPreference(message, now);
  const marketingConsent = analyzeMarketingConsent(message);
  const updatedMemory = updateConversationMemory(memory, {
    message,
    productResult: detectedProduct,
    multimodal,
    followUp,
    marketingConsent,
    visit,
  });
  const effectiveProduct = getEffectiveProductResult(detectedProduct, updatedMemory);
  const effectiveNavigation = getNavigationForProduct(effectiveProduct.primaryProduct);
  const materialResolution = buildMaterialResolutionRequirement({
    normalized,
    productResult: effectiveProduct,
    memory: updatedMemory,
    now,
  });
  const conversationStep = getConversationStep(updatedMemory, {
    visit,
    multimodal,
    marketingConsent,
    followUp,
  });
  const imc = calculateCommercialMaturity({
    businessContext: business,
    productResult: effectiveProduct,
    intents,
    followUp,
    marketingConsent,
    multimodal,
  });

  const responseText = buildSalesResponse({
    intents,
    productResult: effectiveProduct,
    visit,
    navigation: effectiveNavigation,
    followUp,
    marketingConsent,
    imc,
    memory: updatedMemory,
    conversationStep,
    multimodal,
  });
  const finalMemory = markConversationStep(updatedMemory, conversationStep);
  saveConversationMemory(finalMemory, { now: now.getTime() });

  const result = {
    ok: true,
    shouldReply: true,
    responseText,
    analysis: {
      business,
      product: effectiveProduct,
      intents,
      visit,
      followUp,
      marketingConsent,
      navigation: effectiveNavigation,
      materialResolution,
      multimodal,
      imc,
      memory: finalMemory,
      conversationStep,
    },
  };

  return {
    ...result,
    leadFields: buildLeadFieldsFromSalesResult(normalized, result),
  };
}
