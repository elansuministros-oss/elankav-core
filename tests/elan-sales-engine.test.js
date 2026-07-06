import test from "node:test";
import assert from "node:assert/strict";
import { clearConversationMemory, processSalesConversation } from "../lib/elan-sales-engine/index.js";

process.env.ELAN_AI_DISABLE_LLM = "true";

let sequence = 0;

function normalized(body, patch = {}) {
  sequence += 1;

  return {
    source: "WAHA",
    event: "message",
    session: "ELANKAV",
    messageId: patch.messageId || `msg-${sequence}`,
    chatId: patch.chatId || "50588889999@c.us",
    from: patch.from || patch.chatId || "50588889999@c.us",
    to: "",
    fromMe: false,
    type: "chat",
    body,
    hasMedia: false,
    timestamp: "2026-07-06T12:00:00.000Z",
    isMessage: true,
    isInbound: true,
    isLeadCandidate: true,
    ...patch,
  };
}

function usefulLines(text = "") {
  return String(text).split("\n").filter((line) => line.trim());
}

function assertPremiumWhatsAppStyle(result) {
  const questionCount = (result.responseText.match(/\?/g) || []).length + (result.responseText.match(/¿/g) || []).length;
  assert.ok(result.responseText.length <= 600, `respuesta demasiado larga: ${result.responseText.length}`);
  assert.ok(usefulLines(result.responseText).length <= 5, `demasiadas lineas: ${usefulLines(result.responseText).length}`);
  assert.ok(questionCount <= 2, `demasiadas marcas de pregunta: ${questionCount}`);
}

test.afterEach(() => {
  clearConversationMemory();
});

test("saluda como asesor premium, no como chatbot", async () => {
  const result = await processSalesConversation({ normalized: normalized("Hola") });

  assert.equal(result.shouldReply, true);
  assert.match(result.responseText, /Gracias por escribir a ELANVISUAL/i);
  assert.match(result.responseText, /Con gusto te ayudo/i);
  assert.match(result.responseText, /En qué puedo apoyarte hoy/i);
  assert.doesNotMatch(result.responseText, /Bienvenido/i);
  assert.equal(result.analysis.orchestrator, "ELAN_AI_SALES_ORCHESTRATOR_V1");
  assertPremiumWhatsAppStyle(result);
});

test("usa catálogo público para precio de botón sin inventar monto", async () => {
  const result = await processSalesConversation({ normalized: normalized("Hola quiero cotizar un botón luminoso") });

  assert.equal(result.analysis.product.primaryProduct.id, "boton-luminoso");
  assert.equal(result.analysis.pricing.source, "public_catalog");
  assert.equal(result.analysis.pricing.price.text, "desde USD 100");
  assert.match(result.responseText, /desde USD 100/i);
  assert.match(result.responseText, /medida aproximada/i);
  assert.doesNotMatch(result.responseText, /Qué producto/i);
  assertPremiumWhatsAppStyle(result);
});

test("mantiene memoria por número aunque cambie chatId entre LID y c.us", async () => {
  const from = "50511112222@c.us";
  const first = await processSalesConversation({
    normalized: normalized("Cotización de un rótulo luminoso", {
      chatId: "123456789@lid",
      from,
    }),
  });
  const second = await processSalesConversation({
    normalized: normalized("60*100cm", {
      chatId: from,
      from,
    }),
  });
  const third = await processSalesConversation({
    normalized: normalized("Interior", {
      chatId: from,
      from,
    }),
  });

  assert.match(first.responseText, /medida aproximada/i);
  assert.match(second.responseText, /interior o exterior/i);
  assert.doesNotMatch(second.responseText, /Hola|Gracias por escribir|medida aproximada/i);
  assert.match(third.responseText, /logo/i);
  assert.doesNotMatch(third.responseText, /medida aproximada/i);
  assert.equal(third.analysis.memory.measure, "60*100cm");
  assert.equal(third.analysis.memory.placement, "interior");
  assertPremiumWhatsAppStyle(first);
  assertPremiumWhatsAppStyle(second);
  assertPremiumWhatsAppStyle(third);
});

test("guarda presentación personal sin reiniciar saludo ni preguntar producto ya conocido", async () => {
  const chatId = "50522223333@c.us";

  await processSalesConversation({ normalized: normalized("Quiero letras 3D", { chatId }) });
  await processSalesConversation({ normalized: normalized("80 cm", { chatId }) });

  const result = await processSalesConversation({ normalized: normalized("Soy Erick Cano", { chatId }) });

  assert.equal(result.analysis.memory.name, "Erick Cano");
  assert.match(result.responseText, /Erick/i);
  assert.match(result.responseText, /interior o exterior/i);
  assert.doesNotMatch(result.responseText, /Hola|Qué producto/i);
  assertPremiumWhatsAppStyle(result);
});

test("recupera contexto ante frustración y no repite datos", async () => {
  const chatId = "50533334444@c.us";

  await processSalesConversation({ normalized: normalized("Quiero un rótulo luminoso", { chatId }) });
  await processSalesConversation({ normalized: normalized("60x100 cm", { chatId }) });

  const result = await processSalesConversation({ normalized: normalized("Ya te dije", { chatId }) });

  assert.match(result.responseText, /Disculpá/i);
  assert.match(result.responseText, /60x100 cm/i);
  assert.match(result.responseText, /interior o exterior/i);
  assert.doesNotMatch(result.responseText, /medida aproximada/i);
  assertPremiumWhatsAppStyle(result);
});

test("responde con transparencia cuando preguntan si es IA", async () => {
  const result = await processSalesConversation({ normalized: normalized("Eres una IA?") });

  assert.match(result.responseText, /Sí, soy ELAN AI/i);
  assert.match(result.responseText, /equipo de ELANKAV/i);
  assert.match(result.responseText, /equipo continúa contigo/i);
  assertPremiumWhatsAppStyle(result);
});

test("maneja insulto leve sin vender agresivamente", async () => {
  const chatId = "50544445555@c.us";

  await processSalesConversation({ normalized: normalized("Quiero un botón luminoso", { chatId }) });
  await processSalesConversation({ normalized: normalized("60 cm", { chatId }) });
  const result = await processSalesConversation({ normalized: normalized("Estás loca", { chatId }) });

  assert.match(result.responseText, /Disculpá/i);
  assert.match(result.responseText, /Retomo el contexto/i);
  assert.doesNotMatch(result.responseText, /promoción|descuento/i);
  assertPremiumWhatsAppStyle(result);
});

test("continúa por etapas sin repetir datos ya obtenidos", async () => {
  const chatId = "50555556666@c.us";

  const first = await processSalesConversation({ normalized: normalized("Quiero un botón luminoso", { chatId }) });
  const second = await processSalesConversation({ normalized: normalized("60 cm", { chatId }) });
  const third = await processSalesConversation({ normalized: normalized("Exterior", { chatId }) });
  const fourth = await processSalesConversation({ normalized: normalized("No", { chatId }) });

  assert.match(first.responseText, /desde USD 100/i);
  assert.match(second.responseText, /interior o exterior/i);
  assert.doesNotMatch(second.responseText, /medida aproximada/i);
  assert.match(third.responseText, /logo/i);
  assert.match(fourth.responseText, /foto/i);
  assert.equal(fourth.analysis.memory.logoStatus, "no_tiene");
  [first, second, third, fourth].forEach(assertPremiumWhatsAppStyle);
});

test("responde primero gracias por la foto", async () => {
  const result = await processSalesConversation({
    normalized: normalized("", {
      type: "image",
      hasMedia: true,
      body: "",
      isLeadCandidate: false,
    }),
  });

  assert.match(result.responseText, /^Gracias por la foto 📷/);
  assertPremiumWhatsAppStyle(result);
});

test("recibe audio sin decir que no puede escucharlo", async () => {
  const result = await processSalesConversation({
    normalized: normalized("", {
      type: "audio",
      hasMedia: true,
      body: "",
      isLeadCandidate: false,
    }),
  });

  assert.match(result.responseText, /Gracias por el audio/i);
  assert.doesNotMatch(result.responseText, /no puedo escuchar|no puedo/i);
  assertPremiumWhatsAppStyle(result);
});

test("registra documentos para cotización", async () => {
  const result = await processSalesConversation({
    normalized: normalized("", {
      type: "document",
      hasMedia: true,
      fileName: "logo.ai",
      mimeType: "application/postscript",
      body: "",
      isLeadCandidate: false,
    }),
  });

  assert.match(result.responseText, /Archivo recibido/i);
  assert.match(result.responseText, /cotización/i);
  assertPremiumWhatsAppStyle(result);
});

test("maneja solicitud de visita técnica con una sola pregunta", async () => {
  const result = await processSalesConversation({ normalized: normalized("Pueden visitar mi negocio?") });

  assert.equal(result.analysis.visit.detected, true);
  assert.match(result.responseText, /visitas técnicas/i);
  assert.match(result.responseText, /ciudad o municipio/i);
  assert.doesNotMatch(result.responseText, /no tenemos oficina/i);
  assertPremiumWhatsAppStyle(result);
});

test("guarda consentimiento de marketing y pide seguimiento", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero recibir promociones") });

  assert.equal(result.analysis.marketingConsent.granted, true);
  assert.match(result.responseText, /queda registrado/i);
  assert.match(result.responseText, /Cuándo preferís/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta seguimiento a 15 días", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Escríbeme en 15 días"),
    now: new Date("2026-07-06T12:00:00.000Z"),
  });

  assert.equal(result.analysis.followUp.days, 15);
  assert.equal(result.analysis.followUp.followUpAt, "2026-07-21T12:00:00.000Z");
  assert.match(result.responseText, /seguimiento/i);
  assertPremiumWhatsAppStyle(result);
});

test("no responde automáticamente eventos message.any", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Hola, quiero un botón luminoso", { event: "message.any" }),
  });

  assert.equal(result.shouldReply, false);
  assert.equal(result.analysis.reason, "evento_ignorado_para_respuesta");
});
