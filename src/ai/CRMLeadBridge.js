export function crearLeadDesdeWhatsApp(resultado = {}) {
  const fecha = new Date().toISOString();

  return {
    id: `lead-wa-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    origen: 'WhatsApp',
    fechaRegistro: fecha,

    cliente: resultado.nombreCliente || 'Cliente WhatsApp',
    telefono: resultado.telefono || '',
    waId: resultado.waId || '',
    mensajeId: resultado.mensajeId || '',
    tipoMensaje: resultado.tipoMensaje || '',

    mensajeOriginal: resultado.mensajeOriginal || '',
    unidadNegocio: resultado.unidadDetectada || 'Sin clasificar',
    servicioSolicitado: resultado.servicioDetectado || 'Consulta general',
    tipoCliente: resultado.tipoCliente || 'Prospecto',
    estado: resultado.estadoLead || 'Nuevo',
    prioridad: resultado.prioridad || 'Media',
    respuestaSugerida: resultado.respuestaSugerida || '',

    phoneNumberId: resultado.phoneNumberId || '',
    displayPhoneNumber: resultado.displayPhoneNumber || '',
    wabaId: resultado.wabaId || '',

    creadoPor: 'ELAN AI',
    listoParaCRM: true,
  };
}

export function guardarLeadTemporalCRM(lead) {
  const clave = 'elankav_leads_whatsapp_pendientes';

  if (typeof window === 'undefined' || !window.localStorage) {
    console.log('Lead generado en servidor:', JSON.stringify(lead, null, 2));
    return [lead];
  }

  const actuales = JSON.parse(localStorage.getItem(clave) || '[]');
  const actualizados = [lead, ...actuales];

  localStorage.setItem(clave, JSON.stringify(actualizados));

  return actualizados;
}

export function obtenerLeadsTemporalesCRM() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  return JSON.parse(localStorage.getItem('elankav_leads_whatsapp_pendientes') || '[]');
}