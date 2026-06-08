export const BRIDGE_VERSION = 'ELANKAV-CENTRAL-BRIDGE-v1';

const UNIDADES_OFICIALES = [
  { id: 'elanpet', codigo: 'PET', nombre: 'ELANPET', estado: 'Operativo' },
  { id: 'elanvisual', codigo: 'VIS', nombre: 'ELANKAV VISUAL', estado: 'Activo' },
  { id: 'elancenter', codigo: 'CENTER', nombre: 'ELANKAV CENTER', estado: 'Preparación' },
  { id: 'elansolar', codigo: 'SOL', nombre: 'ELANKAV SOLAR', estado: 'Preparación' },
  { id: 'elanai', codigo: 'AI', nombre: 'ELAN AI', estado: 'Diseño' },
];

const estadosActivos = [
  'Pendiente',
  'Nueva',
  'Nuevo',
  'Diseño',
  'Cotizar',
  'Diagnóstico',
  'Seguimiento',
  'Sin clasificar',
  'Lead nuevo',
  'Aprobado',
  'Producción',
];

const leerStorage = (clave, respaldo = []) => {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : respaldo;
  } catch {
    return respaldo;
  }
};

const numero = (valor) => Number(valor || 0);

export function dinero(valor = 0) {
  return `C$ ${numero(valor).toLocaleString('es-NI')}`;
}

const normalizarUnidadId = (valor = '') => {
  const texto = String(valor).toLowerCase();

  if (texto.includes('pet')) return 'elanpet';
  if (texto.includes('visual') || texto.includes('rotul')) return 'elanvisual';
  if (texto.includes('center') || texto.includes('centro')) return 'elancenter';
  if (texto.includes('solar')) return 'elansolar';
  if (texto.includes('ai') || texto.includes('ia')) return 'elanai';

  return 'elanvisual';
};

export function obtenerUnidad(unidades, unidadId) {
  return unidades.find((unidad) => unidad.id === unidadId) || null;
}

export function cargarDatosCRM() {
  const empresas = leerStorage('elankav_empresas');
  const contactos = leerStorage('elankav_contactos');
  const cotizaciones = leerStorage('elankav_cotizaciones');
  const pedidos = leerStorage('elankav_pedidos');
  const cobros = leerStorage('elankav_cobros');
  const comisiones = leerStorage('elankav_comisiones');
  const ordenesTrabajo = leerStorage('elankav_ordenes_trabajo');
  const produccion = leerStorage('elankav_produccion');
  const inventario = leerStorage('elankav_inventario');
  const materiales = leerStorage('elankav_materiales');
  const leadsWhatsApp = leerStorage('elankav_leads_whatsapp');
  const notificacionesCRM = leerStorage('elankav_notificaciones_crm');

  const operaciones = [
    ...cotizaciones.map((item) => ({
      id: item.id,
      unidadId: normalizarUnidadId(item.unidadNegocio || item.unidad || item.unidadId),
      unidad: item.unidadNegocio || item.unidad || 'ELANKAV VISUAL',
      tipo: 'Cotización',
      cliente: item.cliente || item.empresa || item.nombreCliente || 'Cliente sin nombre',
      estado: item.estado || 'Nueva',
      responsable: item.responsable || 'Ventas',
      total: numero(item.total || item.monto || item.valor),
      fecha: item.fecha || item.creado || item.actualizado || '',
    })),
    ...pedidos.map((item) => ({
      id: item.id,
      unidadId: normalizarUnidadId(item.unidadNegocio || item.unidad || item.unidadId),
      unidad: item.unidadNegocio || item.unidad || 'ELANKAV VISUAL',
      tipo: 'Pedido',
      cliente: item.cliente || item.empresa || item.contacto || 'Cliente sin nombre',
      estado: item.estado || 'Pendiente',
      responsable: item.responsable || 'Operaciones',
      total: numero(item.total || item.monto || item.valor),
      fecha: item.fecha || item.creado || item.actualizado || '',
    })),
    ...ordenesTrabajo.map((item) => ({
      id: item.id,
      unidadId: normalizarUnidadId(item.unidadNegocio || item.unidad || item.unidadId),
      unidad: item.unidadNegocio || item.unidad || 'ELANKAV VISUAL',
      tipo: 'Orden de Trabajo',
      cliente: item.cliente || item.empresa || item.proyecto || 'Proyecto sin nombre',
      estado: item.estado || 'Pendiente',
      responsable: item.responsable || 'Producción',
      total: numero(item.total || item.monto || item.valor),
      fecha: item.fecha || item.creado || item.actualizado || '',
    })),
    ...cobros.map((item) => ({
      id: item.id,
      unidadId: normalizarUnidadId(item.unidadNegocio || item.unidad || item.unidadId),
      unidad: item.unidadNegocio || item.unidad || 'ELANKAV VISUAL',
      tipo: 'Cobro',
      cliente: item.cliente || item.empresa || 'Cliente sin nombre',
      estado: item.estado || 'Pendiente',
      responsable: 'Finanzas',
      total: numero(item.montoCobrado || item.montoFactura || item.total),
      fecha: item.fechaCobro || item.fecha || item.actualizado || '',
    })),
  ];

  const leads = leadsWhatsApp.map((item) => ({
    id: item.id,
    unidadId: normalizarUnidadId(item.unidadNegocio || item.unidadDetectada || item.unidad || item.unidadId),
    unidad: item.unidadNegocio || item.unidadDetectada || item.unidad || 'Sin clasificar',
    cliente: item.cliente || item.nombre || item.telefono || 'Lead sin nombre',
    origen: item.origen || 'WhatsApp',
    etapa: item.estado || 'Lead nuevo',
    valorEstimado: numero(item.valorEstimado || item.monto || 0),
    probabilidad: numero(item.probabilidad || 30),
  }));

  const mensajes = leadsWhatsApp.map((item) => ({
    id: item.id,
    unidadId: normalizarUnidadId(item.unidadNegocio || item.unidadDetectada || item.unidad || item.unidadId),
    cliente: item.cliente || item.nombre || item.telefono || 'Contacto WhatsApp',
    mensaje: item.mensaje || item.descripcion || item.detalle || '',
    estado: item.estado || 'Sin clasificar',
    origen: item.origen || 'WhatsApp',
  }));

  return {
    version: BRIDGE_VERSION,
    unidades: UNIDADES_OFICIALES,
    empresas,
    clientes: contactos,
    contactos,
    cotizaciones,
    pedidos,
    cobros,
    comisiones,
    ordenesTrabajo,
    produccion,
    inventario,
    materiales,
    leads,
    mensajes,
    operaciones,
    notificacionesCRM,
    fuenteActual: 'CRM CENTRAL REAL vía LocalStorage',
  };
}

export function enriquecerConUnidad(items = [], unidades = []) {
  return items.map((item) => {
    const unidad = obtenerUnidad(unidades, item.unidadId);
    return {
      ...item,
      unidadCodigo: unidad?.codigo || 'N/D',
      unidadNombre: unidad?.nombre || item.unidad || 'Sin unidad',
      unidadEstado: unidad?.estado || 'Sin estado',
    };
  });
}

export function calcularEstadoGlobal({
  unidades = [],
  operaciones = [],
  leads = [],
  mensajes = [],
  empresas = [],
  clientes = [],
}) {
  const operacionesActivas = operaciones.filter((op) => estadosActivos.includes(op.estado)).length;
  const leadsActivos = leads.filter((lead) => estadosActivos.includes(lead.etapa)).length;
  const mensajesPendientes = mensajes.filter((msg) =>
    ['Sin clasificar', 'Lead nuevo', 'Pendiente', 'Nuevo'].includes(msg.estado)
  ).length;

  const ingresosVisibles = operaciones.reduce((acc, op) => acc + numero(op.total), 0);

  const ingresosProyectados = leads.reduce((acc, lead) => {
    const valor = numero(lead.valorEstimado);
    const probabilidad = numero(lead.probabilidad) / 100;
    return acc + valor * probabilidad;
  }, ingresosVisibles);

  return {
    version: BRIDGE_VERSION,
    modo: 'LAB_FRONTEND_CONTROL',
    listoParaIntegracion: true,
    unidades: unidades.length,
    operaciones: operaciones.length,
    operacionesActivas,
    leads: leads.length,
    leadsActivos,
    mensajes: mensajes.length,
    mensajesPendientes,
    empresas: empresas.length,
    clientes: clientes.length,
    ingresosVisibles,
    ingresosProyectados,
    fuenteActual: 'CRM CENTRAL REAL vía LocalStorage',
    fuenteFutura: 'Supabase / API Central',
  };
}

export function rankingUnidades({ unidades = [], operaciones = [], leads = [], mensajes = [] }) {
  return unidades
    .map((unidad) => {
      const operacionesUnidad = operaciones.filter((op) => op.unidadId === unidad.id);
      const leadsUnidad = leads.filter((lead) => lead.unidadId === unidad.id);
      const mensajesUnidad = mensajes.filter((msg) => msg.unidadId === unidad.id);
      const ingresos = operacionesUnidad.reduce((acc, op) => acc + numero(op.total), 0);
      const proyectado = leadsUnidad.reduce(
        (acc, lead) => acc + numero(lead.valorEstimado) * (numero(lead.probabilidad) / 100),
        ingresos
      );
      const carga = operacionesUnidad.length + leadsUnidad.length + mensajesUnidad.length;

      return {
        ...unidad,
        operaciones: operacionesUnidad.length,
        leads: leadsUnidad.length,
        mensajes: mensajesUnidad.length,
        ingresos,
        proyectado,
        carga,
      };
    })
    .sort((a, b) => b.proyectado - a.proyectado || b.carga - a.carga);
}

export function construirReporteEjecutivo(data) {
  const estado = calcularEstadoGlobal(data);
  const ranking = rankingUnidades(data);

  return {
    estado,
    ranking,
    alertas: [
      estado.mensajesPendientes > 0 && {
        nivel: 'Alta',
        titulo: 'Mensajes pendientes de clasificación',
        detalle: 'El Centro WhatsApp debe clasificar unidad, servicio, origen, cliente y estado del lead.',
      },
      estado.leadsActivos > 0 && {
        nivel: 'Media',
        titulo: 'Leads activos sin cierre',
        detalle: 'Los leads deben avanzar hacia cotización, pedido u orden de trabajo.',
      },
      {
        nivel: 'Sistema',
        titulo: 'CentralBridge conectado',
        detalle: 'El LAB ya lee datos reales del CRM CENTRAL usando LocalStorage.',
      },
    ].filter(Boolean),
  };
}