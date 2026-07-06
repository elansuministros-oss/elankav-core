function formatMoney({ amount, currency = "USD", mode = "desde" } = {}) {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return "";
  const value = Number(amount);
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${mode} ${currency} ${formatted}`;
}

export function resolveCommercialPricing({ catalog = {}, productResult = {}, materialResolution = {} } = {}) {
  const published = catalog.bestMatch || null;
  const hasPublishedPrice = Number.isFinite(Number(published?.priceFrom)) && Number(published.priceFrom) > 0;

  if (published && hasPublishedPrice) {
    const price = {
      mode: "desde",
      currency: published.currency || "USD",
      amount: Number(published.priceFrom),
      text: formatMoney({
        amount: Number(published.priceFrom),
        currency: published.currency || "USD",
        mode: "desde",
      }),
    };

    return {
      source: "public_catalog",
      canMentionPrice: true,
      publishedProduct: {
        id: published.id,
        officialName: published.officialName || published.nombre || published.name,
        description: published.description || "",
        url: published.url || "",
        source: published.source || catalog.source || "",
      },
      price,
      policy:
        "Precio publicado de referencia. Si cambia medida, acabado, iluminación o instalación, se valida técnicamente antes de cotizar final.",
    };
  }

  return {
    source: productResult.detected ? "ece_ai23_required" : "pending_product",
    canMentionPrice: false,
    publishedProduct: null,
    price: null,
    policy:
      "No hay precio publicado seguro para esta solicitud. ELAN AI prepara datos; ECE/AI-23 calcula costo, precio final, PDF y cotización.",
    materialResolutionStatus: materialResolution.estadoGeneral || "pendiente_validacion_ece_ai23",
  };
}
