import {
  clientesIniciales,
  empresasIniciales,
  leadsIniciales,
  mensajesWhatsApp,
  operacionesIniciales,
  tareasIA,
  timelineInicial,
  unidadesGrupo,
  kavtoreSalas,
} from '../data/coreData';

const STORAGE_KEYS = {
  empresas: 'elankav_empresas',
  contactos: 'elankav_contactos',
  clientes: 'elankav_clientes',
  cotizaciones: 'elankav_cotizaciones',
  pedidos: 'elankav_pedidos',
  ordenesTrabajo: 'elankav_ordenes_trabajo',
  produccion: 'elankav_produccion',
  cobros: 'elankav_cobros',
  comisiones: 'elankav_comisiones',
  inventario: 'elankav_inventario',
  materiales: 'elankav_materiales',
  leads: 'elankav_leads_whatsapp',
  notificaciones: 'elankav_notificaciones_crm',
  proveedores: 'elankav_proveedores',
  compras: 'elankav_compras',
  cuentasPorCobrar: 'elankav_cuentas_por_cobrar',
  cuentasPorPagar: 'elankav_cuentas_por_pagar',
};

export const dinero = (valor = 0, moneda = 'C$') => {
  const numero = Number(valor || 0);
  return `${moneda} ${numero.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const normalizarTexto = (valor = '') =>
  String(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const leerStorage = (key, fallback = []) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }

    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn(`CentralBridge no pudo leer ${key}`, error);
    return fallback;
  }
};

const obtenerMonto = (item = {}) => Number(item.total || item.monto || item.valor || item.importe || 0);

const obtenerUnidad = (item = {}) =>
  item.unidad || item.unidadDetectada || item.unidadNegocio || item.area || item.categoria || 'Sin unidad';

const obtenerEstado = (item = {}) => item.estado || item.estatus || item.status || 'Sin estado';

const estaPendiente = (item = {}) => {
  const estado = normalizarTexto(obtenerEstado(item));
  return [
    'pendiente',
    'nueva',
    'nuevo',
    'diseno',
    'aprobado',
    'produccion',
    'seguimiento',
    'lead nuevo',
    'sin clasificar',
    'en seguimiento',
  ].includes(estado);
};

export function enriquecerConUnidad(items = [], unidades = unidadesGrupo) {
  return items.map((item) => {
    const unidadNombre = obtenerUnidad(item);
    const unidad = unidades.find(
      (unidadItem) =>
        normalizarTexto(unidadItem.nombre) === normalizarTexto(unidadNombre) ||
        normalizarTexto(unidadItem.codigo) === normalizarTexto(unidadNombre) ||
        normalizarTexto(unidadItem.id) === normalizarTexto(unidadNombre)
    );

    return {
      ...item,
      unidad: unidad?.nombre || unidadNombre,
      unidadId: unidad?.id || item.unidadId || normalizarTexto(unidadNombre).replace(/\s+/g, '-'),
      unidadCodigo: unidad?.codigo || item.unidadCodigo || 'GEN',
    };
  });
}

export function cargarDatosCRM() {
  const empresas = leerStorage(STORAGE_KEYS.empresas, empresasIniciales);
  const contactos = leerStorage(STORAGE_KEYS.contactos, []);
  const clientes = leerStorage(STORAGE_KEYS.clientes, clientesIniciales);
  const cotizaciones = leerStorage(STORAGE_KEYS.cotizaciones, []);
  const pedidos = leerStorage(STORAGE_KEYS.pedidos, operacionesIniciales.filter((item) => item.tipo === 'Pedido'));
  const ordenesTrabajo = leerStorage(STORAGE_KEYS.ordenesTrabajo, []);
  const produccion = leerStorage(STORAGE_KEYS.produccion, []);
  const cobros = leerStorage(STORAGE_KEYS.cobros, []);
  const comisiones = leerStorage(STORAGE_KEYS.comisiones, []);
  const inventario = leerStorage(STORAGE_KEYS.inventario, []);
  const materiales = leerStorage(STORAGE_KEYS.materiales, []);
  const leads = leerStorage(STORAGE_KEYS.leads, leadsIniciales);
  const notificaciones = leerStorage(STORAGE_KEYS.notificaciones, []);
  const proveedores = leerStorage(STORAGE_KEYS.proveedores, []);
  const compras = leerStorage(STORAGE_KEYS.compras, []);
  const cuentasPorCobrar = leerStorage(STORAGE_KEYS.cuentasPorCobrar, []);
  const cuentasPorPagar = leerStorage(STORAGE_KEYS.cuentasPorPagar, []);

  const mensajes = leads.length > 0 ? leads : mensajesWhatsApp;

  const operacionesDesdeCRM = [
    ...operacionesIniciales,
    ...cotizaciones.map((item) => ({ ...item, tipo: item.tipo || 'CotizaciÃ³n' })),
    ...pedidos.map((item) => ({ ...item, tipo: item.tipo || 'Pedido' })),
    ...ordenesTrabajo.map((item) => ({ ...item, tipo: item.tipo || 'Orden de Trabajo' })),
    ...produccion.map((item) => ({ ...item, tipo: item.tipo || 'ProducciÃ³n' })),
    ...cobros.map((item) => ({ ...item, tipo: item.tipo || 'Cobro' })),
  ];

  return {
    unidades: unidadesGrupo,
    kavtoreSalas,
    operaciones: enriquecerConUnidad(operacionesDesdeCRM, unidadesGrupo),
    empresas: enriquecerConUnidad(empresas, unidadesGrupo),
    contactos,
    clientes: enriquecerConUnidad(clientes, unidadesGrupo),
    cotizaciones: enriquecerConUnidad(cotizaciones, unidadesGrupo),
    pedidos: enriquecerConUnidad(pedidos, unidadesGrupo),
    ordenesTrabajo: enriquecerConUnidad(ordenesTrabajo, unidadesGrupo),
    produccion: enriquecerConUnidad(produccion, unidadesGrupo),
    cobros: enriquecerConUnidad(cobros, unidadesGrupo),
    comisiones,
    inventario,
    materiales,
    leads: enriquecerConUnidad(leads, unidadesGrupo),
    mensajes: enriquecerConUnidad(mensajes, unidadesGrupo),
    proveedores,
    compras,
    cuentasPorCobrar,
    cuentasPorPagar,
    notificaciones,
    tareasIA,
    timeline: timelineInicial,
    metadata: {
      modo: 'LAB',
      version: 'CentralBridge KavtorÃ© v0.1',
      fuenteActual: 'LocalStorage + datos demo',
      fuenteFutura: 'Supabase / CRM Central',
      listoParaIntegracion: true,
    },
  };
}

export function calcularEstadoGlobal(datosCore = {}) {
  const operaciones = datosCore.operaciones || [];
  const empresas = datosCore.empresas || [];
  const clientes = datosCore.clientes || [];
  const leads = datosCore.leads || [];
  const mensajes = datosCore.mensajes || [];
  const cobros = datosCore.cobros || [];
  const cotizaciones = datosCore.cotizaciones || [];
  const pedidos = datosCore.pedidos || [];
  const inventario = datosCore.inventario || [];
  const materiales = datosCore.materiales || [];
  const unidades = datosCore.unidades || [];

  const ingresosVisibles = operaciones.reduce((acc, item) => acc + obtenerMonto(item), 0);
  const cobrosVisibles = cobros.reduce((acc, item) => acc + obtenerMonto(item), 0);
  const ingresosProyectados = unidades.reduce(
    (acc, item) => acc + Number(item.ingresosProyectados || 0),
    ingresosVisibles
  );
  const mensajesPendientes = mensajes.filter(estaPendiente).length;
  const operacionesPendientes = operaciones.filter(estaPendiente).length;
  const cotizacionesPendientes = cotizaciones.filter(estaPendiente).length;
  const pedidosPendientes = pedidos.filter(estaPendiente).length;
  const inventarioCritico = inventario.filter((item) => Number(item.stock || item.existencia || 0) <= Number(item.minimo || 0)).length;

  return {
    operaciones: operaciones.length,
    empresas: empresas.length,
    clientes: clientes.length,
    leads: leads.length,
    mensajes: mensajes.length,
    cobros: cobros.length,
    cotizaciones: cotizaciones.length,
    pedidos: pedidos.length,
    inventario: inventario.length,
    materiales: materiales.length,
    ingresosVisibles,
    ingresosProyectados,
    cobrosVisibles,
    mensajesPendientes,
    operacionesPendientes,
    cotizacionesPendientes,
    pedidosPendientes,
    inventarioCritico,
    listoParaIntegracion: datosCore.metadata?.listoParaIntegracion ?? true,
    modo: datosCore.metadata?.modo || 'LAB',
    version: datosCore.metadata?.version || 'CentralBridge KavtorÃ© v0.1',
    fuenteActual: datosCore.metadata?.fuenteActual || 'LocalStorage + datos demo',
    fuenteFutura: datosCore.metadata?.fuenteFutura || 'Supabase / CRM Central',
  };
}

export function rankingUnidades({ unidades = [], operaciones = [], leads = [], mensajes = [] } = {}) {
  return unidades.map((unidad) => {
    const operacionesUnidad = operaciones.filter((item) => normalizarTexto(obtenerUnidad(item)) === normalizarTexto(unidad.nombre));
    const leadsUnidad = leads.filter((item) => normalizarTexto(obtenerUnidad(item)) === normalizarTexto(unidad.nombre));
    const mensajesUnidad = mensajes.filter((item) => normalizarTexto(obtenerUnidad(item)) === normalizarTexto(unidad.nombre));
    const ingresos = operacionesUnidad.reduce((acc, item) => acc + obtenerMonto(item), 0);

    return {
      ...unidad,
      operaciones: operacionesUnidad.length,
      leads: leadsUnidad.length || unidad.leads || 0,
      mensajes: mensajesUnidad.length,
      ingresos: ingresos || Number(unidad.ingresos || 0),
      proyectado: Number(unidad.ingresosProyectados || 0),
      peso: operacionesUnidad.length * 3 + leadsUnidad.length * 2 + mensajesUnidad.length + ingresos / 1000,
    };
  }).sort((a, b) => b.peso - a.peso);
}

export function construirReporteEjecutivo(datosCore = {}) {
  const estado = calcularEstadoGlobal(datosCore);
  const alertas = [];

  if (estado.mensajesPendientes > 0) {
    alertas.push({
      titulo: 'Mensajes pendientes',
      detalle: `${estado.mensajesPendientes} conversaciones requieren clasificaciÃ³n o seguimiento.`,
      nivel: 'Media',
    });
  }

  if (estado.cotizacionesPendientes > 0) {
    alertas.push({
      titulo: 'Cotizaciones pendientes',
      detalle: `${estado.cotizacionesPendientes} cotizaciones necesitan revisiÃ³n comercial.`,
      nivel: 'Alta',
    });
  }

  if (estado.inventarioCritico > 0) {
    alertas.push({
      titulo: 'Inventario crÃ­tico',
      detalle: `${estado.inventarioCritico} materiales estÃ¡n en nivel crÃ­tico.`,
      nivel: 'Alta',
    });
  }

  const recomendaciones = [
    'Validar conexiÃ³n CRM â†’ CORE con datos reales.',
    'Activar Knowledge Core para memorias especializadas.',
    'Convertir ELAN AI Center en ELAN KAVTORÃ‰ OS.',
  ];

  return {
    estado,
    alertas,
    recomendaciones,
    accionPrincipal: alertas[0]?.titulo || 'Continuar construcciÃ³n de ELAN KAVTORÃ‰ OS',
    resumen: 'ELANKAV CORE estÃ¡ listo para evolucionar de dashboard ejecutivo a sistema operativo inteligente.',
  };
}

export function registrarOperacionCentral(data) {
  console.log('OperaciÃ³n recibida:', data);

  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

