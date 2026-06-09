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
  const materiales = obtenerColeccion(datosCore, 'materiales');
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
    materiales,
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
    return 'Escribí una consulta para analizar el CRM CENTRAL.';
  }

  if (texto.includes('hoy') || texto.includes('prioridad') || texto.includes('atender')) {
    return `Prioridad ejecutiva: revisar ${analisis.pedidosPendientes.length} pedido(s) pendiente(s), confirmar cobros por C$${analisis.pendienteCobro.toLocaleString(
      'es-NI'
    )} y completar producción, inventario y costos para calcular utilidad real.`;
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

  if (texto.includes('produccion') || texto.includes('orden')) {
    return `Producción: hay ${analisis.ordenesTrabajo.length} orden(es) de trabajo y ${analisis.produccion.length} registro(s) de producción. Falta alimentar estados reales para calcular atrasos.`;
  }

  if (texto.includes('inventario') || texto.includes('material')) {
    return `Inventario: hay ${analisis.inventario.length} registro(s) de inventario y ${analisis.materiales.length} material(es). Falta stock real para alertas automáticas.`;
  }

  if (texto.includes('proveedor')) {
    return `Proveedores: hay ${analisis.proveedores.length} proveedor(es). Aún falta registrar precios, tiempos de entrega y disponibilidad para subcontratación inteligente.`;
  }

  return `KAVTORÉ leyó el CRM CENTRAL. Estado actual: ${analisis.operaciones} operación(es), ${analisis.empresas.length} empresa(s), pedidos visibles C$${analisis.totalPedidos.toLocaleString(
    'es-NI'
  )}.`;
}