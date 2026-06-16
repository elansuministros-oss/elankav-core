import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método no permitido" });
    }

    const { pregunta = "", datos = {} } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY no configurada" });
    }

    const respuesta = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Sos ELAN KAVTORÉ, asistente operativo personal de ELANKAV. Respondés con precisión ejecutiva, claro y directo. Analizás CRM, pedidos, clientes, cobros, producción, inventario, proveedores y decisiones comerciales. No inventés datos.",
        },
        {
          role: "user",
          content: `Pregunta: ${pregunta}\n\nDatos disponibles:\n${JSON.stringify(datos).slice(0, 12000)}`,
        },
      ],
    });

    return res.status(200).json({
      ok: true,
      respuesta: respuesta.output_text || "OpenAI respondió sin texto.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
      tipo: error.name || "OpenAIError",
    });
  }
}
