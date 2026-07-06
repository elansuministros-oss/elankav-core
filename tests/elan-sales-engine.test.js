import test from "node:test";
import assert from "node:assert/strict";
import { clearConversationMemory, processSalesConversation } from "../lib/elan-sales-engine/index.js";

function normalized(body, patch = {}) {
  return {
    source: "WAHA",
    event: "message",
    session: "ELANKAV",
    messageId: `msg-${Math.random().toString(36).slice(2)}`,
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
  const questionCount = (result.responseText.match(/\?/g) || []).length;
  assert.ok(result.responseText.length <= 600, `respuesta demasiado larga: ${result.responseText.length}`);
  assert.ok(usefulLines(result.responseText).length <= 5, `demasiadas lineas: ${usefulLines(result.responseText).length}`);
  assert.ok(questionCount <= 1, `demasiadas preguntas: ${questionCount}`);
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
  assertPremiumWhatsAppStyle(result);
});

test("si el cliente ya dijo producto, no vuelve a preguntar producto", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero un boton luminoso") });

  assert.equal(result.analysis.product.primaryProduct.id, "boton-luminoso");
  assert.match(result.responseText, /Excelente elección/i);
  assert.match(result.responseText, /medida aproximada/i);
  assert.doesNotMatch(result.responseText, /Qué producto/i);
  assertPremiumWhatsAppStyle(result);
});

test("conduce por etapas sin repetir datos ya obtenidos", async () => {
  const chatId = "50511112222@c.us";

  const first = await processSalesConversation({ normalized: normalized("Quiero un boton luminoso", { chatId }) });
  const second = await processSalesConversation({ normalized: normalized("60 cm", { chatId }) });
  const third = await processSalesConversation({ normalized: normalized("Exterior", { chatId }) });
  const fourth = await processSalesConversation({ normalized: normalized("Si, tengo logo", { chatId }) });

  assert.match(first.responseText, /medida aproximada/i);
  assert.match(second.responseText, /interior o exterior/i);
  assert.doesNotMatch(second.responseText, /medida aproximada/i);
  assert.match(third.responseText, /logo/i);
  assert.match(fourth.responseText, /foto/i);

  [first, second, third, fourth].forEach(assertPremiumWhatsAppStyle);
});

test("envia referencias especificas despues de recibir la foto", async () => {
  const chatId = "50522223333@c.us";

  await processSalesConversation({ normalized: normalized("Quiero un boton luminoso", { chatId }) });
  await processSalesConversation({ normalized: normalized("60 cm", { chatId }) });
  await processSalesConversation({ normalized: normalized("Exterior", { chatId }) });
  await processSalesConversation({ normalized: normalized("Tengo logo", { chatId }) });

  const result = await processSalesConversation({
    normalized: normalized("", {
      chatId,
      type: "image",
      hasMedia: true,
      body: "",
      isLeadCandidate: false,
    }),
  });

  assert.match(result.responseText, /^Gracias por la foto 📷/);
  assert.match(result.responseText, /visual\.elankav\.com\/rotulos/i);
  assert.match(result.responseText, /Avanzamos con la cotización/i);
  assertPremiumWhatsAppStyle(result);
});

test("maneja precio sin discutir ni inventar monto", async () => {
  const result = await processSalesConversation({ normalized: normalized("Cuanto cuesta?") });

  assert.equal(result.analysis.intents.price, true);
  assert.match(result.responseText, /no conviene dar un número al aire/i);
  assert.doesNotMatch(result.responseText, /C\$\s*\d|\$\s*\d/);
  assertPremiumWhatsAppStyle(result);
});

test("maneja solicitud de visita tecnica con una sola pregunta", async () => {
  const result = await processSalesConversation({ normalized: normalized("Pueden visitar mi negocio?") });

  assert.equal(result.analysis.visit.detected, true);
  assert.match(result.responseText, /visitas técnicas/i);
  assert.match(result.responseText, /ciudad o municipio/i);
  assert.doesNotMatch(result.responseText, /no tenemos oficina/i);
  assertPremiumWhatsAppStyle(result);
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

test("registra documentos para cotizacion", async () => {
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

test("guarda consentimiento de marketing y pide seguimiento", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero recibir promociones") });

  assert.equal(result.analysis.marketingConsent.granted, true);
  assert.match(result.responseText, /queda registrado/i);
  assert.match(result.responseText, /Cuándo preferís/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta seguimiento a 15 dias", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Escribeme en 15 dias"),
    now: new Date("2026-07-06T12:00:00.000Z"),
  });

  assert.equal(result.analysis.followUp.days, 15);
  assert.equal(result.analysis.followUp.followUpAt, "2026-07-21T12:00:00.000Z");
  assert.match(result.responseText, /seguimiento/i);
  assertPremiumWhatsAppStyle(result);
});

test("no responde automaticamente eventos message.any", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Hola, quiero un boton luminoso", { event: "message.any" }),
  });

  assert.equal(result.shouldReply, false);
  assert.equal(result.analysis.reason, "evento_ignorado_para_respuesta");
});
