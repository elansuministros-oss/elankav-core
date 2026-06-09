import { clasificarMensajeWhatsApp } from '../src/ai/WhatsAppAIEngine.js';
import { crearLeadDesdeWhatsApp } from '../src/ai/CRMLeadBridge.js';

const VERIFY_TOKEN = 'ELANKAV_VERIFY_2026';

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

export default function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('ELAN AI / Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }

    console.warn('ELAN AI / Verificación rechazada', {
      mode,
      tokenRecibido: token,
    });

    return res.status(403).send('Token de verificación inválido');
  }

  if (req.method === 'POST') {
    try {
      const eventos = extraerEventosWhatsApp(req.body);
      const mensajes = eventos.filter((evento) => evento.tipoEvento === 'mensaje');
      const statuses = eventos.filter((evento) => evento.tipoEvento === 'status');
      const sinMensaje = eventos.filter((evento) => evento.tipoEvento === 'sin_mensaje');

      const leads = mensajes.map((item) => {
        const analisis = clasificarMensajeWhatsApp(item.mensaje);

        const lead = crearLeadDesdeWhatsApp({
          ...analisis,
          telefono: item.telefono,
          waId: item.waId,
          nombreCliente: item.nombreCliente,
          mensajeId: item.mensajeId,
          tipoMensaje: item.tipoMensaje,
          phoneNumberId: item.phoneNumberId,
          displayPhoneNumber: item.displayPhoneNumber,
          wabaId: item.wabaId,
          mensajeOriginal: item.mensaje,
          origen: 'WhatsApp Cloud API',
        });

        console.log(
          'ELAN AI / LEAD GENERADO:',
          JSON.stringify(
            {
              mensajeId: item.mensajeId,
              telefono: item.telefono,
              waId: item.waId,
              nombreCliente: item.nombreCliente,
              mensaje: item.mensaje,
              analisis,
              lead,
            },
            null,
            2
          )
        );

        return lead;
      });

      console.log(
        'ELAN AI / WhatsApp Webhook RESUMEN:',
        JSON.stringify(
          {
            recibido: true,
            tipoBody: req.body?.object || 'desconocido',
            totalEventos: eventos.length,
            totalMensajes: mensajes.length,
            totalStatuses: statuses.length,
            totalSinMensaje: sinMensaje.length,
            totalLeads: leads.length,
            eventos,
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
        totalEventos: eventos.length,
        totalMensajes: mensajes.length,
        totalStatuses: statuses.length,
        totalSinMensaje: sinMensaje.length,
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