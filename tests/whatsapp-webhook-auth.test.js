import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/whatsapp.js";
import { clearWebhookReplyMemory } from "../lib/whatsapp/webhook-idempotency.js";

const ORIGINAL_ENV = {
  WAHA_WEBHOOK_SECRET: process.env.WAHA_WEBHOOK_SECRET,
  WAHA_WEBHOOK_REQUIRE_SECRET: process.env.WAHA_WEBHOOK_REQUIRE_SECRET,
  WAHA_WEBHOOK_SESSION: process.env.WAHA_WEBHOOK_SESSION,
  WAHA_SESSION: process.env.WAHA_SESSION,
  WAHA_BASE_URL: process.env.WAHA_BASE_URL,
  ELAN_AI_DISABLE_LLM: process.env.ELAN_AI_DISABLE_LLM,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function buildWahaEvent(session = "ELANKAV", patch = {}) {
  const payloadPatch = patch.payload || {};

  return {
    event: patch.event || "message",
    id: patch.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    session,
    payload: {
      id: payloadPatch.id || `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      chatId: payloadPatch.chatId || "50588889999@c.us",
      from: payloadPatch.from || "50588889999@c.us",
      fromMe: payloadPatch.fromMe ?? false,
      type: payloadPatch.type || "chat",
      body: payloadPatch.body ?? "Hola",
      hasMedia: payloadPatch.hasMedia ?? false,
      timestamp: payloadPatch.timestamp || 1783344000,
    },
  };
}

async function callWebhook({ body, headers = {} } = {}) {
  const req = {
    method: "POST",
    url: "/api/whatsapp?action=webhook",
    headers,
    body,
  };

  const result = {};
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      result.status = this.statusCode;
      result.payload = payload;
      return payload;
    },
  };

  await handler(req, res);
  return result;
}

test.afterEach(() => {
  restoreEnv();
  clearWebhookReplyMemory();
});

test.beforeEach(() => {
  process.env.ELAN_AI_DISABLE_LLM = "true";
});

test("acepta webhook WAHA valido por sesion permitida aunque no envie secreto", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;
  delete process.env.WAHA_BASE_URL;

  const result = await callWebhook({ body: buildWahaEvent("ELANKAV") });

  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.received, true);
});

test("rechaza webhook sin secreto cuando la sesion no coincide", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;

  const result = await callWebhook({ body: buildWahaEvent("OTRA_SESION") });

  assert.equal(result.status, 401);
  assert.equal(result.payload.ok, false);
});

test("mantiene compatibilidad con header secreto correcto", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  process.env.WAHA_WEBHOOK_REQUIRE_SECRET = "true";
  delete process.env.WAHA_BASE_URL;

  const result = await callWebhook({
    body: buildWahaEvent("ELANKAV"),
    headers: {
      "X-Waha-Secret": "secret-configurado-en-vercel",
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
});

test("ignora message.any para respuesta automatica", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;
  delete process.env.WAHA_BASE_URL;

  const result = await callWebhook({
    body: buildWahaEvent("ELANKAV", {
      event: "message.any",
      payload: {
        id: "dup-any-001",
        body: "Hola, quiero un boton luminoso",
        timestamp: 1783344001,
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.salesEngine.shouldReply, false);
  assert.equal(result.payload.reply.skipped, true);
  assert.equal(result.payload.salesEngine.analysis.reason, "Evento WAHA ignorado para respuesta automatica");
});

test("marca duplicado y no reenvia respuesta por messageId", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;
  delete process.env.WAHA_BASE_URL;

  const body = buildWahaEvent("ELANKAV", {
    id: "evt-dup-message",
    payload: {
      id: "msg-dup-001",
      body: "Hola, quiero un boton luminoso",
      timestamp: 1783344002,
    },
  });

  const first = await callWebhook({ body });
  const second = await callWebhook({ body });

  assert.equal(first.status, 200);
  assert.equal(first.payload.salesEngine.shouldReply, true);
  assert.equal(first.payload.idempotency.duplicate, false);

  assert.equal(second.status, 200);
  assert.equal(second.payload.salesEngine.shouldReply, false);
  assert.equal(second.payload.idempotency.duplicate, true);
  assert.equal(second.payload.reply.skipped, true);
});

test("ignora fromMe=true para respuesta automatica", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;

  const result = await callWebhook({
    body: buildWahaEvent("ELANKAV", {
      payload: {
        id: "from-me-001",
        fromMe: true,
        body: "Mensaje propio",
        timestamp: 1783344003,
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.salesEngine.shouldReply, false);
  assert.equal(result.payload.reply.skipped, true);
});

test("acepta foto sin texto y genera respuesta automatica", async () => {
  process.env.WAHA_WEBHOOK_SECRET = "secret-configurado-en-vercel";
  process.env.WAHA_SESSION = "ELANKAV";
  delete process.env.WAHA_WEBHOOK_REQUIRE_SECRET;
  delete process.env.WAHA_BASE_URL;

  const result = await callWebhook({
    body: buildWahaEvent("ELANKAV", {
      payload: {
        id: "photo-no-text-001",
        body: "",
        type: "image",
        hasMedia: true,
        timestamp: 1783344004,
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.salesEngine.shouldReply, true);
  assert.match(result.payload.salesEngine.responseText, /Gracias por la foto/i);
});
