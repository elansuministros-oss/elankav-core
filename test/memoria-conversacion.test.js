import test from "node:test";
import assert from "node:assert/strict";

import {
  construirContextoActualizado,
  guardarMemoriaConversacion,
  normalizarWhatsApp,
  obtenerIdentificadorConversacion,
  obtenerMemoriaConversacion,
} from "../lib/memoria-conversacion.js";

function crearSupabaseFalso(store) {
  return {
    from(table) {
      assert.equal(table, "elan_ai_conversaciones");

      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "conversation_id");

              return {
                async maybeSingle() {
                  return {
                    data: store.get(value) || null,
                    error: null,
                  };
                },
              };
            },
          };
        },
        async upsert(row) {
          store.set(row.conversation_id, row);
          return { error: null };
        },
      };
    },
  };
}

test("crea un identificador estable por WhatsApp", () => {
  assert.equal(normalizarWhatsApp("+505 8888-7777"), "50588887777");
  assert.equal(obtenerIdentificadorConversacion("+505 8888-7777"), "whatsapp:50588887777");
});

test("actualiza contexto con usuario y asistente", () => {
  const contexto = construirContextoActualizado({
    contextoPrevio: [{ role: "user", content: "Hola" }],
    mensajeUsuario: "Continuemos",
    respuestaAsistente: "Retomemos la solicitud anterior.",
  });

  assert.deepEqual(contexto.slice(-2), [
    { role: "user", content: "Continuemos" },
    { role: "assistant", content: "Retomemos la solicitud anterior." },
  ]);
});

test("recupera la conversación después de recrear el cliente del proceso", async () => {
  const storePersistente = new Map();
  const primerCliente = crearSupabaseFalso(storePersistente);

  const inicial = await obtenerMemoriaConversacion({
    supabase: primerCliente,
    whatsapp: "+505 8888-7777",
  });

  assert.equal(inicial.estado, "nueva");
  assert.deepEqual(inicial.contexto, []);

  const guardado = await guardarMemoriaConversacion({
    supabase: primerCliente,
    whatsapp: "+505 8888-7777",
    contextoPrevio: inicial.contexto,
    mensajeUsuario: "Hola",
    respuestaAsistente: "Hola, soy ELAN AI. Te ayudo con tu solicitud.",
  });

  assert.equal(guardado.ok, true);
  assert.equal(guardado.estado, "guardada");

  const clienteTrasReinicio = crearSupabaseFalso(storePersistente);
  const recuperada = await obtenerMemoriaConversacion({
    supabase: clienteTrasReinicio,
    whatsapp: "+505 8888-7777",
  });

  assert.equal(recuperada.estado, "recuperada");
  assert.deepEqual(recuperada.contexto, [
    { role: "user", content: "Hola" },
    { role: "assistant", content: "Hola, soy ELAN AI. Te ayudo con tu solicitud." },
  ]);
});
