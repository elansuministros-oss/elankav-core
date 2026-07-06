export function calculateCommercialMaturity({
  businessContext = {},
  productResult = {},
  intents = {},
  followUp = {},
  marketingConsent = {},
  multimodal = {},
} = {}) {
  const factors = [];
  let score = 10;

  if (businessContext.unit) {
    score += Math.round((businessContext.confidence || 0) * 10);
    factors.push(`unidad:${businessContext.unit}`);
  }

  if (productResult.detected) {
    score += 22;
    factors.push("producto_detectado");
  }

  if (intents.price) {
    score += 15;
    factors.push("precio_cotizacion");
  }

  if (intents.measures) {
    score += 20;
    factors.push("medidas");
  }

  if (intents.visit) {
    score += 18;
    factors.push("visita");
  }

  if (followUp.detected && followUp.wantsFollowUp !== false) {
    score += 12;
    factors.push("seguimiento_solicitado");
  }

  if (marketingConsent.detected && marketingConsent.granted) {
    score += 8;
    factors.push("consentimiento_marketing");
  }

  if (["image", "pdf", "location"].includes(multimodal.modality)) {
    score += 10;
    factors.push(`multimodal:${multimodal.modality}`);
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const stage =
    boundedScore >= 75
      ? "Alta probabilidad de cierre"
      : boundedScore >= 50
        ? "Oportunidad"
        : boundedScore >= 25
          ? "Interes"
          : "Exploracion";

  return {
    score: boundedScore,
    stage,
    factors,
  };
}
