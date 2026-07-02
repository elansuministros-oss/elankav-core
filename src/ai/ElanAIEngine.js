export function normalizarTexto(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function obtenerColeccion(datosCore, nombre) {
  return Array.isArray(datosCore?.[nombre]) ? datosCore[nombre] : [];
}

export function analizarCRM(datosCore = {}, estadoGlobal = {}) {
  const empresas = obtenerColeccion(datosCore, 'empresas');
  const contactos = obtenerColeccion(datosCore, 'contactos');
  const leads = obtenerColeccion(datosCore, 'leadsWhatsApp');
  const pedidos = obtenerColeccion(datosCore, 'pedidos');
  const cotizaciones = obtenerColeccion(datosCore, 'cotizaciones');
  const ordenesTrabajo = obtenerColeccion(datosCore, 'ordenesTrabajo');
  const produccion = obtenerColeccion(datosCore, 'produccion');
  const cobros = obtenerColeccion(datosCore, 'cobros');
  const inventario = obtenerColeccion(datosCore, 'inventario');
  const proveedores = obtenerColeccion(datosCore, 'proveedores');

  const totalPedidos = pedidos.reduce((suma, item) => suma + Number(item.total || item.monto || 0), 0);
  const totalCotizado = cotizaciones.reduce((suma, item) => suma + Number(item.total || item.monto || 0), 0);
  const totalCobrado = cobros.reduce((suma, item) => suma + Number(item.total || item.monto || 0), 0);
  const pendienteCobro = Math.max(totalPedidos - totalCobrado, 0);

  const pedidosPendientes = pedidos.filter((item) =>
    normalizarTexto(item.estado).includes('pendiente')
  );

  return {
    empresas,
    contactos,
    leads,
    pedidos,
    cotizaciones,
    ordenesTrabajo,
    produccion,
    cobros,
    inventario,
    proveedores,
    totalPedidos,
    totalCotizado,
    totalCobrado,
    pendienteCobro,
    pedidosPendientes,
    operaciones: estadoGlobal?.operaciones || pedidos.length + cotizaciones.length + leads.length,
    empresasActivas: empresas.filter((item) => normalizarTexto(item.estado).includes('activa')),
  };
}

export function responderELANAI(pregunta = '', datosCore = {}, estadoGlobal = {}, reporteEjecutivo = {}) {
  const texto = normalizarTexto(pregunta);
  const analisis = analizarCRM(datosCore, estadoGlobal);

  if (!texto.trim()) {
    return 'EscribÃ­ una consulta para analizar el CRM CENTRAL.';
  }

  if (
    texto.includes('precio') ||
    texto.includes('precios') ||
    texto.includes('costo') ||
    texto.includes('costos') ||
    texto.includes('cotizar') ||
    texto.includes('cotizacion') ||
    texto.includes('cotizaciÃ³n') ||
    texto.includes('calcular')
  ) {
    return 'Para costos, precios o cotizaciones cubiertas por el Centro de Costos, ELAN AI debe usar exclusivamente AI-23 mediante /api/elan-ai y lib/ai23/index.js. Este motor CRM no calcula costos ni usa fuentes antiguas.';
  }

  if (texto.includes('hoy') || texto.includes('prioridad') || texto.includes('atender')) {
    return `Prioridad ejecutiva: revisar ${analisis.pedidosPendientes.length} pedido(s) pendiente(s), confirmar cobros por C$${analisis.pendienteCobro.toLocaleString(
      'es-NI'
    )} y completar estados operativos. Los costos deben validarse Ãºnicamente con AI-23.`;
  }

  if (texto.includes('cobrar') || texto.includes('cobro') || texto.includes('saldo')) {
    return `Financiero: pedidos visibles C$${analisis.totalPedidos.toLocaleString(
      'es-NI'
    )}, cobrado C$${analisis.totalCobrado.toLocaleString(
      'es-NI'
    )}, pendiente por cobrar C$${analisis.pendienteCobro.toLocaleString('es-NI')}.`;
  }

  if (texto.includes('pedido') || texto.includes('venta')) {
    return `Comercial: hay ${analisis.pedidos.length} pedido(s), total visible C$${analisis.totalPedidos.toLocaleString(
      'es-NI'
    )}, pendientes ${analisis.pedidosPendientes.length}.`;
  }

  if (texto.includes('empresa') || texto.includes('cliente')) {
    return `Clientes: hay ${analisis.empresas.length} empresa(s), ${analisis.contactos.length} contacto(s) y ${analisis.empresasActivas.length} empresa(s) activa(s).`;
  }

  if (texto.includes('produccion') || texto.includes('producciÃ³n') || texto.includes('orden')) {
    return `ProducciÃ³n: hay ${analisis.ordenesTrabajo.length} orden(es) de trabajo y ${analisis.produccion.length} registro(s) de producciÃ³n. Este mÃ³dulo no calcula costos.`;
  }

  if (texto.includes('inventario') || texto.includes('material')) {
    return `Inventario: hay ${analisis.inventario.length} registro(s) de inventario. Este mÃ³dulo no usa materiales como fuente de costos; los costos cubiertos deben venir de AI-23.`;
  }

  if (texto.includes('proveedor')) {
    return `Proveedores: hay ${analisis.proveedores.length} proveedor(es). Los precios de proveedor no son calculados por este mÃ³dulo; los costos cubiertos deben resolverse en AI-23.`;
  }

  return `KAVTORÃ‰ leyÃ³ el CRM CENTRAL. Estado actual: ${analisis.operaciones} operaciÃ³n(es), ${analisis.empresas.length} empresa(s), pedidos visibles C$${analisis.totalPedidos.toLocaleString(
    'es-NI'
  )}. Para costos cubiertos, usar AI-23.`;
}
