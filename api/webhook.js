const VERIFY_TOKEN = 'ELANKAV_VERIFY_2026';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function clasificarMensajeWhatsApp(mensaje = '') {
  const texto = mensaje.toLowerCase();

  let unidadDetectada = 'Sin clasificar';
  let servicioDetectado = 'Consulta general';
  let prioridad = 'Media';

  if (texto.includes('perro') || texto.includes('gato') || texto.includes('mascota')) {
    unidadDetectada = 'ELANPET';
    servicioDetectado = 'Producto para mascota';
  }

  if (texto.includes('rótulo') || texto.includes('rotulo') || texto.includes('banner') || texto.includes('vinil')) {
    unidadDetectada = 'ELANVISUAL';
    servicioDetectado = 'Rotulación / impresión';
  }

  if (texto.includes('computadora') || texto.includes('curso') || texto.includes('diseño gráfico')) {
    unidadDetectada = 'ELANCENTER';
    servicioDetectado = 'Centro tecnológico / diseño';
  }

  if (texto.includes('solar') || texto.includes('lámpara') || texto.includes('decoración') || texto.includes('casa')) {
    unidadDetectada = 'ELANHOME';
    servicioDetectado = 'Hogar / decoración / energía';
  }

  if (texto.includes('urgente') || texto.includes('hoy') || texto.includes('mañana')) {
    prioridad = 'Alta';
  }

  return {
    unidadDetectada,
    servicioDetectado,
    tipoCliente: 'Prospecto',
    estadoLead: 'Nuevo',
    prioridad,
    respuestaSugerida:
      'Hola, gracias por escribir a ELANKAV. Ya recibimos tu solicitud. Para ayudarte mejor, compártenos medidas, ubicación y una foto de referencia si aplica.',
  };
}

function crearLeadDesdeWhatsApp(resultado = {}) {
  return {
    origen: 'WhatsApp Cloud API',
    nombre: resultado.nombreCliente || 'Cliente WhatsApp',
    whatsapp: resultado.telefono || resultado.waId || '',
    mensaje: resultado.mensajeOriginal || '',
    unidad_negocio: resultado.unidadDetectada || 'Sin clasificar',
    servicio_solicitado: resultado.servicioDetectado || 'Consulta general',
    tipo_cliente: resultado.tipoCliente || 'Prospecto',
    estado: resultado.estadoLead || 'Nuevo',
    prioridad: resultado.prioridad || 'Media',
    respuesta_sugerida: resultado.respuestaSugerida || '',
    mensaje_original: resultado.mensajeOriginal || '',
    creado_por: 'ELAN AI',
    listo_para_crm: true,
    procesado: false,
  };
}

async function guardarLeadEnSupabase(lead) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('ELAN AI / Supabase no configurado en variables de entorno.');
    return { ok: false, error: 'Supabase no configurado' };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads_whatsapp`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(lead),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('ELAN AI / Error guardando lead en Supabase:', data);
    return { ok: false, error: data };
  }

  console.log('ELAN AI / Lead guardado en Supabase:', data);
  return { ok: true, data };
}

function extraerEventosWhatsApp(body = {}) {
  const eventos = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];

  entries.forEach((entry) => {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    changes.forEach((change) => {
      const value = change.value || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      const metadata = value.metadata || {};

      if (messages.length > 0) {
        messages.forEach((message) => {
          const contacto = contacts.find((c) => c.wa_id === message.from) || {};

          const texto =
            message?.text?.body ||
            message?.button?.text ||
            message?.interactive?.button_reply?.title ||
            message?.interactive?.list_reply?.title ||
            '';

          eventos.push({
            tipoEvento: 'mensaje',
            mensajeId: message.id || `msg-${Date.now()}`,
            telefono: message.from || '',
            waId: contacto.wa_id || message.from || '',
            nombreCliente: contacto.profile?.name || 'Cliente WhatsApp',
            mensaje: texto,
            tipoMensaje: message.type || 'desconocido',
            phoneNumberId: metadata.phone_number_id || '',
            displayPhoneNumber: metadata.display_phone_number || '',
            wabaId: entry.id || '',
            field: change.field || '',
          });
        });

        return;
      }

      if (statuses.length > 0) {
        statuses.forEach((status) => {
          eventos.push({
            tipoEvento: 'status',
            mensajeId: status.id || '',
            estado: status.status || '',
            telefono: status.recipient_id || '',
            timestamp: status.timestamp || '',
            phoneNumberId: metadata.phone_number_id || '',
            displayPhoneNumber: metadata.display_phone_number || '',
            wabaId: entry.id || '',
            field: change.field || '',
          });
        });

        return;
      }

      eventos.push({
        tipoEvento: 'sin_mensaje',
        phoneNumberId: metadata.phone_number_id || '',
        displayPhoneNumber: metadata.display_phone_number || '',
        wabaId: entry.id || '',
        field: change.field || '',
      });
    });
  });

  return eventos;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('ELAN AI / Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Token de verificación inválido');
  }

  if (req.method === 'POST') {
    try {
      const eventos = extraerEventosWhatsApp(req.body);
      const mensajes = eventos.filter((evento) => evento.tipoEvento === 'mensaje');

      const leads = [];

      for (const item of mensajes) {
        const analisis = clasificarMensajeWhatsApp(item.mensaje);

        const lead = crearLeadDesdeWhatsApp({
          ...analisis,
          telefono: item.telefono,
          waId: item.waId,
          nombreCliente: item.nombreCliente,
          mensajeOriginal: item.mensaje,
        });

        const guardado = await guardarLeadEnSupabase(lead);

        leads.push({
          ...lead,
          guardadoSupabase: guardado.ok,
          errorSupabase: guardado.error || null,
        });
      }

      return res.status(200).json({
        ok: true,
        recibido: true,
        sistema: 'ELAN AI',
        destino: 'Supabase / CRM CENTRAL',
        totalEventos: eventos.length,
        totalMensajes: mensajes.length,
        totalLeads: leads.length,
        leads,
      });
    } catch (error) {
      console.error('ELAN AI / ERROR procesando webhook WhatsApp:', error);

      return res.status(200).json({
        ok: false,
        recibido: true,
        error: 'Error interno procesando webhook',
      });
    }
  }

  return res.status(405).json({
    ok: false,
    error: 'Método no permitido',
  });
}