import test from "node:test";
import assert from "node:assert/strict";
import { processSalesConversation } from "../lib/elan-sales-engine/index.js";

function normalized(body, patch = {}) {
  return {
    source: "WAHA",
    event: "message",
    session: "ELANKAV",
    messageId: `msg-${Math.random().toString(36).slice(2)}`,
    chatId: "50588889999@c.us",
    from: "50588889999@c.us",
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

function assertPremiumWhatsAppStyle(result) {
  const questionCount = (result.responseText.match(/\?/g) || []).length;

  assert.ok(result.responseText.length <= 600, `respuesta demasiado larga: ${result.responseText.length}`);
  assert.ok(questionCount <= 2, `demasiadas preguntas: ${questionCount}`);
  assert.match(result.responseText, /👋|👌|✨|🙌/);
}

test("responde saludo como asesor ELANVISUAL", async () => {
  const result = await processSalesConversation({ normalized: normalized("Hola") });

  assert.equal(result.shouldReply, true);
  assert.equal(result.analysis.business.unit, "ELANVISUAL");
  assert.match(result.responseText, /ELANVISUAL/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta rotulo general", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero un rotulo") });

  assert.equal(result.analysis.product.primaryProduct.id, "rotulo");
  assert.match(result.responseText, /medida/i);
  assert.match(result.responseText, /visual\.elankav\.com/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta boton luminoso", async () => {
  const result = await processSalesConversation({ normalized: normalized("Hola, quiero cotizar un boton luminoso") });

  assert.equal(result.analysis.product.primaryProduct.id, "boton-luminoso");
  assert.match(result.responseText, /botón luminoso/i);
  assert.match(result.responseText, /50 cm|60 cm|80 cm|1 metro/i);
  assert.match(result.responseText, /interior o exterior/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta letras 3D", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero letras 3D") });

  assert.equal(result.analysis.product.primaryProduct.id, "letras-3d");
  assert.match(result.responseText, /letras 3D/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta fachada ACM", async () => {
  const result = await processSalesConversation({ normalized: normalized("Necesito una fachada ACM") });

  assert.equal(result.analysis.product.primaryProduct.id, "fachada-acm");
  assert.match(result.responseText, /fachada ACM/i);
  assertPremiumWhatsAppStyle(result);
});

test("maneja precio sin inventar monto", async () => {
  const result = await processSalesConversation({ normalized: normalized("Cuanto cuesta?") });

  assert.equal(result.analysis.intents.price, true);
  assert.match(result.responseText, /precio serio/i);
  assert.doesNotMatch(result.responseText, /C\$\s*\d|\$\s*\d/);
  assertPremiumWhatsAppStyle(result);
});

test("maneja solicitud de visita tecnica", async () => {
  const result = await processSalesConversation({ normalized: normalized("Pueden visitar mi negocio?") });

  assert.equal(result.analysis.visit.detected, true);
  assert.match(result.responseText, /Ubicación|ubicación/i);
  assert.match(result.responseText, /visita técnica/i);
  assert.match(result.responseText, /costo de desplazamiento/i);
  assert.doesNotMatch(result.responseText, /no tenemos oficina/i);
  assertPremiumWhatsAppStyle(result);
});

test("maneja envio de medidas", async () => {
  const result = await processSalesConversation({ normalized: normalized("Te mando las medidas") });

  assert.equal(result.analysis.intents.measures, true);
  assert.match(result.responseText, /ancho x alto/i);
  assertPremiumWhatsAppStyle(result);
});

test("guarda consentimiento de marketing en analisis", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero recibir promociones") });

  assert.equal(result.analysis.marketingConsent.granted, true);
  assert.match(result.responseText, /promociones/i);
  assertPremiumWhatsAppStyle(result);
});

test("detecta seguimiento a 15 dias", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Escribeme en 15 dias"),
    now: new Date("2026-07-06T12:00:00.000Z"),
  });

  assert.equal(result.analysis.followUp.days, 15);
  assert.equal(result.analysis.followUp.followUpAt, "2026-07-21T12:00:00.000Z");
  assert.match(result.responseText, /quince dias/i);
  assertPremiumWhatsAppStyle(result);
});

test("no responde automaticamente eventos message.any", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Hola, quiero un boton luminoso", { event: "message.any" }),
  });

  assert.equal(result.shouldReply, false);
  assert.equal(result.analysis.reason, "evento_ignorado_para_respuesta");
});
