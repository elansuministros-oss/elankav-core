import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { pregunta = "", datos = {} } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
    }

    const respuesta = await client.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content:
            "Sos ELAN KAVTORÉ, asistente operativo de ELANKAV. Respondés con precisión ejecutiva sobre CRM, pedidos, clientes, producción, inventario, proveedores y decisiones comerciales.",
        },
        {
          role: "user",
          content: `Pregunta: ${pregunta}\n\nDatos CRM:\n${JSON.stringify(datos).slice(0, 12000)}`,
        },
      ],
    });

    return res.status(200).json({
      ok: true,
      respuesta: respuesta.output_text,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
