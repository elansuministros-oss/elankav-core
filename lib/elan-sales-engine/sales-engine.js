import { getFollowUpQuestion } from "./follow-up-engine.js";
import { getMarketingConsentQuestion } from "./marketing-consent-engine.js";

function productQuestions(product) {
  if (!product?.questions?.length) {
    return "medidas, ubicacion, foto de referencia y si ya tenes logo o arte";
  }

  return product.questions.join(", ");
}

function appendNavigation(lines, navigation) {
  if (!navigation?.shouldSend || !navigation.url) return;
  lines.push(`Para que veas referencias visuales, te dejo la pagina correcta: ${navigation.url}`);
}

function appendRelationshipLines(lines, followUp, marketingConsent) {
  if (followUp?.detected) {
    if (followUp.wantsFollowUp === false) {
      lines.push("Perfecto, dejo marcado que no deseas seguimiento comercial.");
    } else if (followUp.followUpAt) {
      lines.push(`Perfecto, dejo seguimiento para ${followUp.label.toLowerCase()}.`);
    } else {
      lines.push("Perfecto, dejamos el seguimiento para cuando vos lo solicites.");
    }
  } else {
    lines.push(getFollowUpQuestion());
  }

  if (marketingConsent?.detected) {
    if (marketingConsent.granted) {
      lines.push("Listo, dejo marcado que queres recibir promociones, descuentos y novedades.");
    } else {
      lines.push("Entendido, no te marco para promociones.");
    }
  } else {
    lines.push(getMarketingConsentQuestion());
  }
}

function buildVisitResponse({ productResult, navigation, followUp, marketingConsent }) {
  const product = productResult.primaryProduct;
  const lines = [
    "Claro, podemos coordinar una visita tecnica.",
    "Enviame la ubicacion del negocio y, si podes, una foto del frente o del punto donde iria instalado.",
    "La visita sirve para revisar medidas, estructura, acceso electrico, visibilidad e instalacion. Si la ubicacion esta lejos, puede aplicar costo de desplazamiento; te lo confirmamos antes de movernos.",
  ];

  if (product) {
    lines.push(`Para avanzar con ${product.serviceName}, tambien necesito: ${productQuestions(product)}.`);
    appendNavigation(lines, navigation);
  }

  appendRelationshipLines(lines, followUp, marketingConsent);
  return lines.join("\n");
}

function buildPriceResponse({ productResult, navigation, followUp, marketingConsent }) {
  const product = productResult.primaryProduct;
  const target = product ? product.serviceName.toLowerCase() : "el producto";
  const lines = [
    `Te puedo cotizar ${target}, pero para darte un precio serio necesito validar medidas, materiales, iluminacion, ubicacion de instalacion y si ya tenes arte o logo.`,
    "Prefiero no soltarte un numero al aire: en rotulacion un cambio pequeno de medida, altura o instalacion puede mover el costo.",
  ];

  if (product) {
    lines.push(`Mandame ${productQuestions(product)} y preparo el siguiente paso de cotizacion.`);
    appendNavigation(lines, navigation);
  } else {
    lines.push("Decime si buscas rotulo, boton luminoso, letras 3D, fachada ACM, impresion, vinil, acrilico, PVC o senalizacion.");
  }

  appendRelationshipLines(lines, followUp, marketingConsent);
  return lines.join("\n");
}

function buildMeasuresResponse({ productResult, navigation, followUp, marketingConsent }) {
  const product = productResult.primaryProduct;
  const lines = [
    "Perfecto, mandame las medidas en ancho x alto, una foto del lugar y la ubicacion aproximada de instalacion.",
    "Si el producto va iluminado, tambien indicame si hay punto electrico cerca. Con eso te asesoro mejor y evitamos una cotizacion floja.",
  ];

  if (product) {
    lines.push(`Para ${product.serviceName}, me ayuda mucho que incluyas: ${productQuestions(product)}.`);
    appendNavigation(lines, navigation);
  }

  appendRelationshipLines(lines, followUp, marketingConsent);
  return lines.join("\n");
}

function buildProductResponse({ productResult, navigation, followUp, marketingConsent }) {
  const product = productResult.primaryProduct;

  if (!product) {
    const lines = [
      "Con gusto te ayudo desde ELANVISUAL.",
      "Decime que necesitas: rotulo, boton luminoso, letras 3D, fachada ACM, impresion, vinil, acrilico, PVC o senalizacion.",
      "Si ya tenes medidas, logo o foto del lugar, mandamelo y te oriento con el siguiente paso.",
    ];

    appendRelationshipLines(lines, followUp, marketingConsent);
    return lines.join("\n");
  }

  const lines = [
    `Excelente, ${product.serviceName} es una buena opcion cuando se busca presencia comercial y lectura clara de marca.`,
    `Para asesorarte bien necesito: ${productQuestions(product)}.`,
    "Con esa informacion te digo que conviene y pasamos a una cotizacion ordenada, sin inventar precios.",
  ];

  appendNavigation(lines, navigation);
  appendRelationshipLines(lines, followUp, marketingConsent);
  return lines.join("\n");
}

function buildConsentOrFollowUpResponse({ productResult, navigation, followUp, marketingConsent }) {
  const lines = [];

  if (marketingConsent?.detected) {
    lines.push(
      marketingConsent.granted
        ? "Listo, dejo marcado que queres recibir promociones, descuentos y novedades de ELANVISUAL."
        : "Entendido, no te marco para promociones."
    );
  }

  if (followUp?.detected) {
    if (followUp.wantsFollowUp === false) {
      lines.push("Tambien dejo marcado que no deseas seguimiento comercial.");
    } else if (followUp.followUpAt) {
      lines.push(`Perfecto, dejo seguimiento para ${followUp.label.toLowerCase()}.`);
    } else {
      lines.push("Perfecto, dejamos el seguimiento para cuando vos lo solicites.");
    }
  }

  if (productResult.detected) {
    lines.push(`Sobre ${productResult.primaryProduct.serviceName}, mandame ${productQuestions(productResult.primaryProduct)} y avanzamos.`);
    appendNavigation(lines, navigation);
  } else {
    lines.push("Cuando estes listo, contame que producto visual necesitas y te asesoro con gusto.");
  }

  return lines.join("\n");
}

export function buildSalesResponse({ intents = {}, productResult = {}, visit = {}, navigation = {}, followUp = {}, marketingConsent = {} } = {}) {
  if (visit.detected) {
    return buildVisitResponse({ productResult, navigation, followUp, marketingConsent });
  }

  if (intents.price) {
    return buildPriceResponse({ productResult, navigation, followUp, marketingConsent });
  }

  if (intents.measures) {
    return buildMeasuresResponse({ productResult, navigation, followUp, marketingConsent });
  }

  if ((marketingConsent.detected || followUp.detected) && !productResult.detected && !intents.productInquiry) {
    return buildConsentOrFollowUpResponse({ productResult, navigation, followUp, marketingConsent });
  }

  if (productResult.detected || intents.productInquiry) {
    return buildProductResponse({ productResult, navigation, followUp, marketingConsent });
  }

  return [
    "Hola, soy asesor comercial de ELANVISUAL. Con gusto te ayudo.",
    "Contame que necesitas: rotulo, boton luminoso, letras 3D, fachada ACM, impresion, vinil, acrilico, PVC o senalizacion.",
    "Si ya tenes medidas, logo o una foto del lugar, mandamela y te oriento con el siguiente paso.",
    getFollowUpQuestion(),
    getMarketingConsentQuestion(),
  ].join("\n");
}
