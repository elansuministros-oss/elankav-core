function calcularPorcentaje(paginaActual = 0, totalPaginas = 0) {
  if (totalPaginas <= 0) return 0;

  return Number(((paginaActual / totalPaginas) * 100).toFixed(2));
}

function calcularTiempoEstimado({
  inicio = null,
  paginaActual = 0,
  totalPaginas = 0,
} = {}) {
  if (!inicio) return null;
  if (paginaActual <= 0) return null;

  const ahora = Date.now();
  const inicioMs = new Date(inicio).getTime();

  const segundosTranscurridos = (ahora - inicioMs) / 1000;
  const promedioPagina = segundosTranscurridos / paginaActual;
  const restantes = totalPaginas - paginaActual;

  return Math.max(0, Math.round(restantes * promedioPagina));
}

function segundosATexto(segundos = 0) {
  if (segundos == null) return "";

  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  if (minutos <= 0) {
    return `${resto} seg`;
  }

  return `${minutos} min ${resto} seg`;
}

function construirEstado({
  paginaActual = 0,
  totalPaginas = 0,
  productosDetectados = 0,
  productosGuardados = 0,
  errores = 0,
  inicio = null,
  mensaje = "",
} = {}) {
  const tiempoEstimado = calcularTiempoEstimado({
    inicio,
    paginaActual,
    totalPaginas,
  });

  return {
    porcentaje: calcularPorcentaje(paginaActual, totalPaginas),
    paginaActual,
    totalPaginas,
    productosDetectados,
    productosGuardados,
    errores,
    tiempoEstimado,
    tiempoEstimadoTexto: segundosATexto(tiempoEstimado),
    mensaje,
  };
}

module.exports = {
  calcularPorcentaje,
  calcularTiempoEstimado,
  segundosATexto,
  construirEstado,
};