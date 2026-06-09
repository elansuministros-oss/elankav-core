export function crearLeadDesdeWhatsApp(resultado = {}) {
  const fecha = new Date().toISOString();

  return {
    id: `lead-wa-${Date.now()}`,
    origen: 'WhatsApp',
    fechaRegistro: fecha,
    cliente: 'Pendiente de identificar',
    mensajeOriginal: resultado.mensajeOriginal || '',
    unidadNegocio: resultado.unidadDetectada || 'Sin clasificar',
    servicioSolicitado: resultado.servicioDetectado || 'Consulta general',
    tipoCliente: resultado.tipoCliente || 'Prospecto',
    estado: resultado.estadoLead || 'Nuevo',
    prioridad: resultado.prioridad || 'Media',
    respuestaSugerida: resultado.respuestaSugerida || '',
    creadoPor: 'ELAN AI',
    listoParaCRM: true,
  };
}

export function guardarLeadTemporalCRM(lead) {
  const clave = 'elankav_leads_whatsapp_pendientes';

  const actuales = JSON.parse(localStorage.getItem(clave) || '[]');
  const actualizados = [lead, ...actuales];

  localStorage.setItem(clave, JSON.stringify(actualizados));

  return actualizados;
}

export function obtenerLeadsTemporalesCRM() {
  return JSON.parse(localStorage.getItem('elankav_leads_whatsapp_pendientes') || '[]');
}