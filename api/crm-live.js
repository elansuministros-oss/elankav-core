const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

async function leerTabla(tabla) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) return [];
  return await res.json();
}

function extraerEstadoApp(rows = [], id = 'global') {
  const fila = rows.find((item) => item.id === id) || rows[0];
  return fila?.data || {};
}

export default async function handler(req, res) {
  try {
    const [
      leadsWhatsapp,
      pedidos,
      usuarios,
      veterinarias,
      comisiones,
      cuentasBancarias,
      elanpetAppState,
      elanvisualAppState,
    ] = await Promise.all([
      leerTabla('leads_whatsapp'),
      leerTabla('pedidos'),
      leerTabla('usuarios'),
      leerTabla('veterinarias'),
      leerTabla('comisiones'),
      leerTabla('cuentas_bancarias'),
      leerTabla('elanpet_app_state'),
      leerTabla('elanvisual_app_state'),
    ]);

    const petState = extraerEstadoApp(elanpetAppState);
    const visualState = extraerEstadoApp(elanvisualAppState);

    const data = {
      fuente: 'SUPABASE ELANPET LIVE',
      destino: 'ELAN KAVTORE',
      version: 'KAV-SUPABASE-01',
      actualizadoEn: new Date().toISOString(),

      empresas: [
        ...(petState.empresas || []),
        ...(visualState.empresas || []),
      ],

      clientes: [
        ...(petState.clientes || []),
        ...(visualState.clientes || []),
        ...veterinarias.map((v) => ({
          id: v.id,
          nombre: v.nombre || v.empresa || 'Veterinaria',
          unidad: 'ELANPET',
          whatsapp: v.telefono || v.whatsapp || '',
          estado: v.estado || 'Activo',
          origen: 'Veterinaria',
        })),
      ],

      pedidos: [
        ...(petState.pedidos || []),
        ...(visualState.pedidos || []),
        ...pedidos,
      ],

      leads: [
        ...(petState.leads || []),
        ...(visualState.leads || []),
        ...leadsWhatsapp.map((l) => ({
          id: l.id,
          nombre: l.nombre || 'Lead WhatsApp',
          cliente: l.nombre || l.telefono || 'WhatsApp',
          mensaje: l.mensaje || '',
          unidad: l.unidad_detectada || 'Sin unidad',
          unidadDetectada: l.unidad_detectada || 'Sin unidad',
          servicioDetectado: l.servicio_detectado || '',
          tipoCliente: l.tipo_cliente || '',
          estado: l.estado_lead || 'Pendiente',
          prioridad: l.prioridad || 'Media',
          origen: l.origen || 'WhatsApp',
          respuestaSugerida: l.respuesta_sugerida || '',
          fecha: l.fecha || l.created_at,
        })),
      ],

      mensajes: leadsWhatsapp,
      cobros: [...(petState.cobros || []), ...(visualState.cobros || [])],
      cotizaciones: [...(petState.cotizaciones || []), ...(visualState.cotizaciones || [])],
      produccion: [...(petState.produccion || []), ...(visualState.produccion || [])],
      inventario: [...(petState.inventario || []), ...(visualState.inventario || [])],
      materiales: [...(petState.materiales || []), ...(visualState.materiales || [])],
      comisiones,
      cuentasBancarias,
      usuarios,
      veterinarias,

      metadata: {
        fuenteActual: 'Supabase ELANPET live',
        fallback: 'crm-central.json',
        modo: 'LIVE',
      },
    };

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
    });
  }
}
