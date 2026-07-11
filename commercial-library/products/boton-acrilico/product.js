const BUTTON_ACRYLIC_PRODUCT = Object.freeze({
  id: 'boton-acrilico',
  version: 'ECL-001A',
  status: 'active',
  platforms: Object.freeze([
    'elanvisual',
    'elan-ai',
    'elankav-orchestrator'
  ]),
  category: 'rotulacion',
  name: 'Rótulo estilo botón en acrílico',
  description:
    'Rótulo circular o cuadrado de proporción 1:1, fabricado en acrílico transparente de 3 mm, con variantes de impresión, relieve y acabados premium.',
  dimensions: Object.freeze({
    shape: 'square-or-round',
    baseCm: 60,
    maxStandardCm: 120,
    stepCm: 10,
    manualReviewBelowCm: 60,
    manualReviewAboveCm: 120
  }),
  materialRules: Object.freeze({
    primaryMaterial: 'acrilico-transparente',
    thicknessMm: 3,
    standoffs: 4,
    wallSeparation: true,
    interiorDefault: true,
    neverAssumeOtherThickness: true
  }),
  pricingRule: Object.freeze({
    currency: 'USD',
    baseSizeCm: 60,
    incrementEveryCm: 10,
    incrementAmount: 20,
    nonStandardStepPolicy: 'manual-review'
  }),
  variants: Object.freeze([
    Object.freeze({
      id: 'boton-transparente',
      commercialName: 'Botón Transparente',
      basePrice: 100,
      finish: 'acrilico transparente con gráfica limpia',
      printing: 'según arte aprobado',
      relief: 'sin relieve premium',
      renderPromptId: 'boton-transparente'
    }),
    Object.freeze({
      id: 'boton-con-impresion',
      commercialName: 'Botón con Impresión',
      basePrice: 130,
      finish: 'impresión aplicada sobre acrílico',
      printing: 'full color',
      relief: 'sin relieve premium',
      renderPromptId: 'boton-con-impresion'
    }),
    Object.freeze({
      id: 'boton-impresion-uv-premium',
      commercialName: 'Botón Impresión UV Premium',
      basePrice: 150,
      finish: 'impresión UV premium',
      printing: 'UV',
      relief: 'acabado premium',
      renderPromptId: 'boton-impresion-uv-premium'
    }),
    Object.freeze({
      id: 'boton-premium-combinado',
      commercialName: 'Botón Premium Combinado',
      basePrice: 190,
      finish: 'combinación de impresión, capas y acabados especiales',
      printing: 'mixta',
      relief: 'sí',
      renderPromptId: 'boton-premium-combinado'
    })
  ]),
  commercialRules: Object.freeze({
    paymentAdvancePercent: 60,
    paymentBalancePercent: 40,
    logoReceivedAction: 'generate-render-automatically',
    positiveEmotionAction: 'move-to-closing',
    askInstallationPhotoAfterPositiveReaction: true,
    doNotGenerateSecondRenderWithoutReason: true,
    doNotInventSpecifications: true
  })
});

export { BUTTON_ACRYLIC_PRODUCT };
