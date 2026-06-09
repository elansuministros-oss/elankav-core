import { clasificarMensajeWhatsApp } from '../src/ai/WhatsAppAIEngine.js';
import { crearLeadDesdeWhatsApp } from '../src/ai/CRMLeadBridge.js';

const VERIFY_TOKEN = 'ELANKAV_VERIFY_2026';

function extraerMensajesWhatsApp(body = {}) {
  const mensajesProcesados = [];

  const entries = Array.isArray(body.entry) ? body.entry : [];

  entries.forEach((entry) => {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    changes.forEach((change) => {
      const value = change.value || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const metadata = value.metadata || {};

      messages.forEach((message) => {
        const contacto = contacts.find((c) => c.wa_id === message.from) || {};

        const texto =
          message?.text?.body ||
          message?.button?.text ||
          message?.interactive?.button_reply?.title ||
          message?.interactive?.list_reply?.title ||
          '';

        mensajesProcesados.push({
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
    });
  });

  return mensajesProcesados;
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Token de verificación inválido');
  }

  if (req.method === 'POST') {
    try {
      const mensajes = extraerMensajesWhatsApp(req.body);

      const leads = mensajes.map((item) => {
        const analisis = clasificarMensajeWhatsApp(item.mensaje);

        return crearLeadDesdeWhatsApp({
          ...analisis,
          telefono: item.telefono,
          waId: item.waId,
          nombreCliente: item.nombreCliente,
          mensajeId: item.mensajeId,
          tipoMensaje: item.tipoMensaje,
          phoneNumberId: item.phoneNumberId,
          displayPhoneNumber: item.displayPhoneNumber,
          wabaId: item.wabaId,
        });
      });

      console.log(
        'ELAN AI / WhatsApp Webhook:',
        JSON.stringify(
          {
            recibido: true,
            totalMensajes: mensajes.length,
            totalLeads: leads.length,
            leads,
            raw: req.body,
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        recibido: true,
        sistema: 'ELAN AI',
        destino: 'CRM CENTRAL',
        totalMensajes: mensajes.length,
        totalLeads: leads.length,
        leads,
      });
    } catch (error) {
      console.error('Error procesando webhook WhatsApp:', error);

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