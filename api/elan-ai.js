/* eslint-disable no-console */

import {
  continueDesignRequest,
  createDesignRequest,
  getDesignRequestStatus,
  getPublicDesignGallery
} from '../services/designPortalService.js';
import {
  createElanVideo,
  generateElanImage,
  getElanVideoStatus,
} from '../services/elanCreativeService.js';

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

const ALLOWED_ORIGINS = new Set([
  "https://visual.elankav.com",
  "https://elankav-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function isAllowedOrigin(origin = "") {
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      url.hostname.startsWith("elanvisual-platform-") &&
      url.hostname.endsWith("-elanpetvercelapp.vercel.app");
  } catch {
    return false;
  }
}

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function extractMessage(payload = {}) {
  const direct = String(payload.mensaje || payload.message || payload.prompt || "").trim();
  if (direct) return direct;

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i] || {};
    if (String(item.role || '').toLowerCase() !== 'user') continue;
    if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
    if (Array.isArray(item.content)) {
      const text = item.content
        .filter((part) => part?.type === 'input_text' || part?.type === 'text')
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
      if (text) return text;
    }
  }
  return '';
}

function buildRuntimeSummary(payload = {}) {
  const runtime = payload.runtime_context || {};
  const business = runtime.businessContext || payload.contexto || {};
  const caps = payload.capabilities || runtime.capabilities || {};

  return {
    platform: runtime.platform || payload.unidad || 'ELANKAV',
    channel: runtime.channel || payload.canal || 'web',
    pathname: runtime.pathname || null,
    role: runtime.role || null,
    activeCustomer: business.clienteActivo || null,
    activeProject: business.proyectoActivo || null,
    activeQuotation: business.cotizacionActiva || null,
    activeOrder: business.pedidoActivo || null,
    capabilities: {
      canRequestDesign: Boolean(caps.canRequestDesign),
      canRequestImage: Boolean(caps.canRequestImage),
      canRequestVideo: Boolean(caps.canRequestVideo),
      canViewMargins: Boolean(caps.canViewMargins),
      canManageMasterPricing: Boolean(caps.canManageMasterPricing),
    },
  };
}

function detectCreativeIntent(message = '') {
  const text = String(message || '').toLowerCase();
  const video = /\b(video|reel|clip|animaci[oó]n)\b/.test(text) &&
    /\b(haz|haceme|hacer|crea|crear|genera|generar|produce|producir|prepara|preparar)\b/.test(text);
  if (video) return 'video';

  const image = /\b(imagen|render|mockup|dise[nñ]o|propuesta visual|visualizaci[oó]n)\b/.test(text) &&
    /\b(haz|haceme|hacer|crea|crear|genera|generar|dise[nñ]a|dise[nñ]ar|renderiza|renderizar|prepara|preparar)\b/.test(text);
  if (image) return 'image';

  return null;
}

function buildUserContent(payload, message) {
  const content = [{ type: 'input_text', text: message }];
  const files = Array.isArray(payload.archivos_temporales) ? payload.archivos_temporales : [];

  for (const file of files) {
    if (String(file?.tipo || '').startsWith('image/') && file?.dataUrl) {
      content.push({
        type: 'input_image',
        image_url: file.dataUrl,
        detail: 'auto',
      });
    }
  }
  return content;
}

async function handleChat(payload = {}) {
  const apiKey = process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY no configurada en CORE.",
    };
  }

  const mensaje = extractMessage(payload);

  if (!mensaje) {
    return {
      ok: false,
      error: "Mensaje vacío.",
    };
  }

  const runtime = buildRuntimeSummary(payload);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ELAN_AI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: 'input_text',
              text: [
                "Eres ELAN, copiloto operativo del ecosistema ELANKAV.",
                "Usa el contexto de pantalla solo para entender a qué módulo, cliente, proyecto o cotización se refiere el usuario.",
                "No inventes operaciones ejecutadas: si no existe una herramienta conectada, explica que la acción requiere integración.",
                "No reveles lógica interna de costos, fórmulas privadas, márgenes ni precios maestros cuando el rol no tenga permiso.",
                "Las mutaciones empresariales sensibles deben ejecutarse por CONNECT y con autorización validada del lado servidor.",
                `Contexto runtime: ${JSON.stringify(runtime)}`,
              ].join('\n'),
            },
          ],
        },
        {
          role: "user",
          content: buildUserContent(payload, mensaje),
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || "Error consultando OpenAI.",
      raw: data,
    };
  }

  return {
    ok: true,
    tipo: "elan-ai-chat",
    respuesta: data.output_text || "",
    runtime,
  };
}

async function handleCopilot(payload = {}) {
  const message = extractMessage(payload);
  if (!message) return { ok: false, error: 'Mensaje vacío.' };

  const capabilities = payload.capabilities || payload.runtime_context?.capabilities || {};
  const intent = detectCreativeIntent(message);

  if (intent === 'image' && capabilities.canRequestImage) {
    const media = await generateElanImage({ prompt: message });
    return {
      ok: true,
      tipo: 'elan-ai-image',
      respuesta: 'Imagen generada por ELAN. Revisala antes de incorporarla al proyecto o enviarla al cliente.',
      media: [media],
    };
  }

  if (intent === 'video' && capabilities.canRequestVideo) {
    const job = await createElanVideo({ prompt: message });
    return {
      ok: true,
      tipo: 'elan-ai-video',
      respuesta: `Video solicitado. Estado: ${job.status}.`,
      video_job: job,
    };
  }

  return handleChat(payload);
}

export default async function handler(req, res) {
  cors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    if (String(req.query?.resource || '') === 'design-gallery') {
      try {
        const items = await getPublicDesignGallery();
        return send(res, 200, { ok: true, items });
      } catch {
        return send(res, 503, {
          ok: false,
          error: 'La galería de diseños no está disponible temporalmente.'
        });
      }
    }

    return send(res, 200, {
      ok: true,
      endpoint: "/api/elan-ai",
      version: "ELAN COPILOT 01",
      status: "ready",
      capabilities: [
        'chat',
        'vision',
        'image-generation',
        'video-generation',
        'design-request',
      ],
      nota: "Las mutaciones empresariales oficiales continúan por CONNECT.",
    });
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      ok: false,
      error: "Metodo no permitido.",
    });
  }

  try {
    const payload = req.body || {};
    const tipo = String(payload.tipo || payload.type || (payload.modo === 'copilot' ? 'copilot' : 'chat')).trim();

    if (tipo === 'image-generation') {
      const media = await generateElanImage({
        prompt: extractMessage(payload),
        size: payload.size || '1024x1024',
      });
      return send(res, 200, {
        ok: true,
        tipo: 'elan-ai-image',
        respuesta: 'Imagen generada por ELAN.',
        media: [media],
      });
    }

    if (tipo === 'video-generation') {
      const job = await createElanVideo({
        prompt: extractMessage(payload),
        seconds: payload.seconds || '4',
        size: payload.size || '720x1280',
      });
      return send(res, 202, {
        ok: true,
        tipo: 'elan-ai-video',
        respuesta: `Video solicitado. Estado: ${job.status}.`,
        video_job: job,
      });
    }

    if (tipo === 'video-status') {
      const job = await getElanVideoStatus(payload.videoId || payload.video_id);
      return send(res, 200, { ok: true, tipo: 'elan-ai-video-status', video_job: job });
    }

    if (tipo === 'design-request-action') {
      try {
        const result = await continueDesignRequest(payload);
        return send(res, 202, {
          ok: true,
          result,
          message: result.action === 'render'
            ? 'Estamos preparando el render hiperrealista.'
            : 'Estamos preparando una nueva versión con los cambios.'
        });
      } catch (error) {
        const invalid = [
          'DESIGN_STATUS_ACCESS_INVALID',
          'DESIGN_STATUS_NOT_FOUND',
          'DESIGN_FOLLOWUP_ACTION_INVALID',
          'DESIGN_FOLLOWUP_INSTRUCTIONS_REQUIRED',
          'DESIGN_FOLLOWUP_RENDER_TYPE_REQUIRED',
          'DESIGN_FOLLOWUP_ENVIRONMENT_REQUIRED',
          'DESIGN_FOLLOWUP_NOT_READY',
          'DESIGN_FOLLOWUP_RESULT_REQUIRED',
          'DESIGN_FOLLOWUP_CONFLICT'
        ].includes(error?.code);
        return send(res, invalid ? 400 : 503, {
          ok: false,
          error: invalid
            ? error.message
            : 'No fue posible continuar la solicitud.'
        });
      }
    }

    if (tipo === 'design-request-status') {
      try {
        const result = await getDesignRequestStatus({
          requestCode: payload.requestCode,
          accessToken: payload.accessToken
        });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        const notFound = [
          'DESIGN_STATUS_ACCESS_INVALID',
          'DESIGN_STATUS_NOT_FOUND'
        ].includes(error?.code);
        return send(res, notFound ? 404 : 503, {
          ok: false,
          error: notFound
            ? 'Solicitud no encontrada.'
            : 'No fue posible consultar la propuesta.'
        });
      }
    }

    if (tipo === 'design-request') {
      try {
        const result = await createDesignRequest(payload);
        return send(res, 201, {
          ok: true,
          result,
          message: 'Solicitud recibida. La propuesta continuará por WhatsApp.'
        });
      } catch (error) {
        const invalid = String(error?.code || '').startsWith('DESIGN_') &&
          ![
            'DESIGN_SUPABASE_NOT_CONFIGURED',
            'DESIGN_FILE_UPLOAD_FAILED',
            'DESIGN_REQUEST_INSERT_FAILED'
          ].includes(error.code);

        return send(res, invalid ? 400 : 503, {
          ok: false,
          error: invalid
            ? error.message
            : 'No fue posible registrar la solicitud. Intentá nuevamente.'
        });
      }
    }

    if (tipo === 'copilot') {
      const result = await handleCopilot(payload);
      return send(res, result.ok ? (result.video_job ? 202 : 200) : 400, result);
    }

    if (tipo === "chat" || tipo === "elan-ai" || tipo === "mensaje") {
      const result = await handleChat(payload);
      return send(res, result.ok ? 200 : 400, result);
    }

    return send(res, 400, {
      ok: false,
      error: "Tipo no soportado por /api/elan-ai.",
      tipo,
      tipos_soportados: [
        "copilot",
        "chat",
        "elan-ai",
        "mensaje",
        "image-generation",
        "video-generation",
        "video-status",
        "design-request",
        "design-request-status",
        "design-request-action"
      ],
      nota: "EMC ya no se procesa aquí. Usar /api/emc-import.",
    });
  } catch (error) {
    console.error("ERROR /api/elan-ai:", error);

    return send(res, 500, {
      ok: false,
      endpoint: "/api/elan-ai",
      code: error?.code || 'ELAN_AI_INTERNAL_ERROR',
      error: error.message || "Error interno en ELAN AI.",
    });
  }
}
