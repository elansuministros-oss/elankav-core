import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/whatsapp.js";

const ORIGINAL_ENV = {
  WAHA_WEBHOOK_SECRET: process.env.WAHA_WEBHOOK_SECRET,
  WAHA_WEBHOOK_REQUIRE_SECRET: process.env.WAHA_WEBHOOK_REQUIRE_SECRET,
  WAHA_WEBHOOK_SESSION: process.env.WAHA_WEBHOOK_SESSION,
  WAHA_SESSION: process.env.WAHA_SESSION,
  WAHA_BASE_URL: process.env.WAHA_BASE_URL,
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

function buildWahaEvent(session = "ELANKAV") {
  return {
    event: "message",
    session,
    payload: {
      id: `auth-test-${Date.now()}`,
      chatId: "50588889999@c.us",
      from: "50588889999@c.us",
      fromMe: false,
      type: "chat",
      body: "Hola",
      timestamp: 1783344000,
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

test.afterEach(restoreEnv);

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
