const BUTTON_ACRYLIC_SALES_FLOW = Object.freeze({
  productId: 'boton-acrilico',
  version: 'ECL-001C',
  stages: Object.freeze([
    Object.freeze({
      id: 'interest',
      objective: 'confirmar si es interior o exterior',
      maxQuestionsPerReply: 1
    }),
    Object.freeze({
      id: 'quotation',
      objective: 'presentar variante, medida y precio oficial',
      maxQuestionsPerReply: 1
    }),
    Object.freeze({
      id: 'logo-received',
      objective: 'generar muestra automáticamente',
      action: 'generate-render',
      requiresCustomerRequest: false
    }),
    Object.freeze({
      id: 'presentation',
      objective: 'mostrar propuesta visual y explicar solo lo necesario'
    }),
    Object.freeze({
      id: 'positive-emotion',
      objective: 'aprovechar aceptación y avanzar al cierre',
      triggerExamples: Object.freeze([
        'bello',
        'me encanta',
        'precioso',
        'me gusta',
        'qué bonito'
      ]),
      prohibitedActions: Object.freeze([
        'generate-unrequested-second-render',
        'restart-discovery',
        'repeat-full-specification'
      ]),
      recommendedReply:
        'Quedaría súper elegante. Podés enviarme una foto del lugar donde lo colocarás y te lo visualizamos mejor en el espacio real.'
    }),
    Object.freeze({
      id: 'closing',
      objective: 'explicar anticipo, saldo, cobertura y siguiente paso',
      payment: Object.freeze({ advancePercent: 60, balancePercent: 40 })
    }),
    Object.freeze({
      id: 'payment-route',
      objective: 'presentar medios de pago habilitados desde configuración oficial',
      neverInventAccountData: true
    }),
    Object.freeze({
      id: 'production-handoff',
      objective: 'crear proyecto y orden solo después de validación de pago'
    })
  ])
});

export { BUTTON_ACRYLIC_SALES_FLOW };
