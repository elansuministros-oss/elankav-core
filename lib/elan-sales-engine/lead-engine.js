import { compactText, stripWhatsAppSuffix } from "./text-utils.js";
import { summarizeMaterialResolution } from "./provider-material-resolution.js";

function getPriority(imc = {}) {
  if ((imc.score || 0) >= 50) return "Alta";
  return "Media";
}

function getLeadStatus(imc = {}) {
  if (!imc.stage || imc.stage === "Exploracion") return "Nuevo";
  return imc.stage;
}

function getClientType(message = "") {
  const text = message.toLowerCase();
  if (["empresa", "negocio", "local", "tienda", "farmacia", "hotel", "restaurante", "clinica"].some((term) => text.includes(term))) {
    return "Empresa";
  }

  return "Prospecto";
}

export function buildSalesLeadSummary(analysis = {}) {
  const product = analysis.product?.primaryProduct?.serviceName || "Consulta visual";
  const imc = analysis.imc ? `${analysis.imc.score}/100 ${analysis.imc.stage}` : "IMC pendiente";
  const followUp = analysis.followUp?.detected ? analysis.followUp.label : "Seguimiento por definir";
  const marketing =
    analysis.marketingConsent?.status === "granted"
      ? "Promociones: acepta"
      : analysis.marketingConsent?.status === "denied"
        ? "Promociones: no acepta"
        : "Promociones: pendiente";

  const materials = summarizeMaterialResolution(analysis.materialResolution);

  return compactText(`${product} | ${materials} | ${imc} | ${followUp} | ${marketing}`, 240);
}

export function buildLeadFieldsFromSalesResult(normalized = {}, salesResult = {}) {
  const analysis = salesResult.analysis || {};
  const product = analysis.product?.primaryProduct;
  const business = analysis.business || {};
  const imc = analysis.imc || {};
  const materialResolution = analysis.materialResolution || {};
  const message = normalized.body || "";

  return {
    origen: "WAHA",
    nombre: normalized.from || normalized.chatId || "Cliente WhatsApp",
    whatsapp: stripWhatsAppSuffix(normalized.chatId || normalized.from || ""),
    mensaje: message,
    unidad_negocio: business.unit || "ELANVISUAL",
    servicio_solicitado: buildSalesLeadSummary(analysis),
    tipo_cliente: getClientType(message),
    estado: getLeadStatus(imc),
    prioridad: getPriority(imc),
    respuesta_sugerida: compactText(salesResult.responseText || "", 1800),
    mensaje_original: message,
    creado_por: "ELAN AI Sales Engine V1",
    listo_para_crm: true,
    procesado: false,
    source: "WAHA",
    message_id: normalized.messageId || null,
    chat_id: normalized.chatId || null,
    producto_detectado: product?.serviceName || null,
    material_probable: (materialResolution.materiales || []).map((item) => item.nombre).filter(Boolean).join(", ") || null,
    tecnologia_probable: (materialResolution.tecnologia || []).map((item) => item.nombre).filter(Boolean).join(", ") || null,
    estado_materiales: materialResolution.estadoGeneral || null,
    requerimiento_ece_ai23: materialResolution.shouldRequestResolution ? JSON.stringify(materialResolution).slice(0, 4000) : null,
    imc_score: imc.score ?? null,
    imc_stage: imc.stage || null,
  };
}
