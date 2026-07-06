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

test("responde saludo como asesor ELANVISUAL", async () => {
  const result = await processSalesConversation({ normalized: normalized("Hola") });

  assert.equal(result.shouldReply, true);
  assert.equal(result.analysis.business.unit, "ELANVISUAL");
  assert.match(result.responseText, /asesor comercial de ELANVISUAL/i);
});

test("detecta rotulo general", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero un rotulo") });

  assert.equal(result.analysis.product.primaryProduct.id, "rotulo");
  assert.match(result.responseText, /medidas/i);
  assert.match(result.responseText, /visual\.elankav\.com/i);
});

test("detecta boton luminoso", async () => {
  const result = await processSalesConversation({ normalized: normalized("Necesito un boton luminoso") });

  assert.equal(result.analysis.product.primaryProduct.id, "boton-luminoso");
  assert.match(result.responseText, /diametro|medida/i);
});

test("detecta letras 3D", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero letras 3D") });

  assert.equal(result.analysis.product.primaryProduct.id, "letras-3d");
  assert.match(result.responseText, /Letras 3D/i);
});

test("detecta fachada ACM", async () => {
  const result = await processSalesConversation({ normalized: normalized("Necesito una fachada ACM") });

  assert.equal(result.analysis.product.primaryProduct.id, "fachada-acm");
  assert.match(result.responseText, /Fachada ACM/i);
});

test("maneja precio sin inventar monto", async () => {
  const result = await processSalesConversation({ normalized: normalized("Cuanto cuesta?") });

  assert.equal(result.analysis.intents.price, true);
  assert.match(result.responseText, /precio serio/i);
  assert.doesNotMatch(result.responseText, /C\$\s*\d|\$\s*\d/);
});

test("maneja solicitud de visita tecnica", async () => {
  const result = await processSalesConversation({ normalized: normalized("Pueden visitar mi negocio?") });

  assert.equal(result.analysis.visit.detected, true);
  assert.match(result.responseText, /ubicacion/i);
  assert.match(result.responseText, /visita tecnica/i);
  assert.match(result.responseText, /costo de desplazamiento/i);
  assert.doesNotMatch(result.responseText, /no tenemos oficina/i);
});

test("maneja envio de medidas", async () => {
  const result = await processSalesConversation({ normalized: normalized("Te mando las medidas") });

  assert.equal(result.analysis.intents.measures, true);
  assert.match(result.responseText, /ancho x alto/i);
});

test("guarda consentimiento de marketing en analisis", async () => {
  const result = await processSalesConversation({ normalized: normalized("Quiero recibir promociones") });

  assert.equal(result.analysis.marketingConsent.granted, true);
  assert.match(result.responseText, /promociones/i);
});

test("detecta seguimiento a 15 dias", async () => {
  const result = await processSalesConversation({
    normalized: normalized("Escribeme en 15 dias"),
    now: new Date("2026-07-06T12:00:00.000Z"),
  });

  assert.equal(result.analysis.followUp.days, 15);
  assert.equal(result.analysis.followUp.followUpAt, "2026-07-21T12:00:00.000Z");
  assert.match(result.responseText, /quince dias/i);
});
