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

export async function processSalesConversation({ normalized = {}, now = new Date() } = {}) {
  const message = normalized.body || "";

  if (!normalized.isInbound || !message.trim()) {
    return {
      ok: true,
      shouldReply: false,
      responseText: "",
      analysis: {
        reason: "evento_no_respondible",
        multimodal: analyzeMultimodalInput(normalized),
      },
      leadFields: null,
    };
  }

  const multimodal = analyzeMultimodalInput(normalized);
  const business = detectBusinessContext({ message, normalized });
  const product = business.unit === "ELANVISUAL" ? detectElanVisualProduct(message) : detectElanVisualProduct("");
  const intents = detectSalesIntents(message, product);
  const visit = analyzeVisitRequest(message);
  const followUp = analyzeFollowUpPreference(message, now);
  const marketingConsent = analyzeMarketingConsent(message);
  const navigation = getNavigationForProduct(product.primaryProduct);
  const imc = calculateCommercialMaturity({
    businessContext: business,
    productResult: product,
    intents,
    followUp,
    marketingConsent,
    multimodal,
  });

  const responseText = buildSalesResponse({
    intents,
    productResult: product,
    visit,
    navigation,
    followUp,
    marketingConsent,
    imc,
  });

  const result = {
    ok: true,
    shouldReply: true,
    responseText,
    analysis: {
      business,
      product,
      intents,
      visit,
      followUp,
      marketingConsent,
      navigation,
      multimodal,
      imc,
    },
  };

  return {
    ...result,
    leadFields: buildLeadFieldsFromSalesResult(normalized, result),
  };
}
