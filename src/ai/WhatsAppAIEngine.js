export function normalizarTexto(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function clasificarMensajeWhatsApp(mensaje = '') {
  const texto = normalizarTexto(mensaje);

  let unidadDetectada = 'Sin clasificar';
  let servicioDetectado = 'Consulta general';
  let tipoCliente = 'Prospecto';
  let prioridad = 'Media';

  if (
    texto.includes('mascota') ||
    texto.includes('perro') ||
    texto.includes('gato') ||
    texto.includes('veterinaria') ||
    texto.includes('alimento') ||
    texto.includes('collar')
  ) {
    unidadDetectada = 'ELANPET';
    servicioDetectado = 'Productos para mascotas / veterinaria';
  }

  if (
    texto.includes('rotulo') ||
    texto.includes('rótulo') ||
    texto.includes('fachada') ||
    texto.includes('banner') ||
    texto.includes('vinil') ||
    texto.includes('acrilico') ||
    texto.includes('acrílico') ||
    texto.includes('impresion') ||
    texto.includes('impresión') ||
    texto.includes('letras')
  ) {
    unidadDetectada = 'ELANVISUAL';
    servicioDetectado = 'Rotulación / impresión / publicidad visual';
  }

  if (
    texto.includes('computadora') ||
    texto.includes('diseño') ||
    texto.includes('pagina web') ||
    texto.includes('página web') ||
    texto.includes('sistema') ||
    texto.includes('capacitacion') ||
    texto.includes('capacitación')
  ) {
    unidadDetectada = 'ELANCENTER';
    servicioDetectado = 'Tecnología / diseño / servicios digitales';
  }

  if (
    texto.includes('solar') ||
    texto.includes('panel') ||
    texto.includes('bateria') ||
    texto.includes('batería') ||
    texto.includes('lampara') ||
    texto.includes('lámpara') ||
    texto.includes('grama') ||
    texto.includes('wpc') ||
    texto.includes('decoracion') ||
    texto.includes('decoración')
  ) {
    unidadDetectada = 'ELANHOME';
    servicioDetectado = 'Decoración / iluminación / energía solar / exteriores';
  }

  if (
    texto.includes('empresa') ||
    texto.includes('negocio') ||
    texto.includes('hotel') ||
    texto.includes('tienda') ||
    texto.includes('farmacia')
  ) {
    tipoCliente = 'Empresa';
  }

  if (
    texto.includes('precio') ||
    texto.includes('cotizar') ||
    texto.includes('cotizacion') ||
    texto.includes('cotización') ||
    texto.includes('cuanto cuesta') ||
    texto.includes('cuánto cuesta')
  ) {
    prioridad = 'Alta';
  }

  if (
    texto.includes('urgente') ||
    texto.includes('hoy') ||
    texto.includes('mañana') ||
    texto.includes('rapido') ||
    texto.includes('rápido')
  ) {
    prioridad = 'Alta';
  }

  const estadoLead = prioridad === 'Alta' ? 'Nuevo prioritario' : 'Nuevo';

  return {
    mensajeOriginal: mensaje,
    unidadDetectada,
    servicioDetectado,
    tipoCliente,
    estadoLead,
    prioridad,
    origen: 'WhatsApp',
    respuestaSugerida: generarRespuestaSugerida({
      unidadDetectada,
      servicioDetectado,
      tipoCliente,
      prioridad,
    }),
  };
}

export function generarRespuestaSugerida(resultado) {
  if (resultado.unidadDetectada === 'ELANVISUAL') {
    return 'Hola, con gusto te ayudo. Para cotizar necesito medidas aproximadas, ubicación de instalación, si será interior o exterior, y si ya tenés logo o diseño.';
  }

  if (resultado.unidadDetectada === 'ELANPET') {
    return 'Hola, con gusto te ayudo con productos para mascotas. Indicame qué producto buscás, cantidad aproximada y si el pedido es para cliente final o veterinaria.';
  }

  if (resultado.unidadDetectada === 'ELANCENTER') {
    return 'Hola, con gusto te ayudo. Indicame si necesitás diseño, página web, sistema, capacitación o soporte tecnológico.';
  }

  if (resultado.unidadDetectada === 'ELANHOME') {
    return 'Hola, con gusto te ayudo. Indicame si buscás decoración, iluminación, energía solar, grama artificial, WPC o exteriores, y las medidas del área.';
  }

  return 'Hola, con gusto te ayudo. Contame un poco más qué necesitás para clasificar tu solicitud y darte una respuesta correcta.';
}