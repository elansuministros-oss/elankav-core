function crearPagina(numero = 1) {
  return {
    numero,
    estado: "PENDIENTE",
    inicio: null,
    fin: null,
    productosDetectados: 0,
    productosGuardados: 0,
    errores: 0,
    tiempoSegundos: 0,
    imagen: null,
    viewport: null,
    items: [],
    mensaje: "",
    intento: 0,
  };
}

function iniciarPagina(pagina) {
  pagina.estado = "PROCESANDO";
  pagina.inicio = new Date().toISOString();
  pagina.mensaje = `Procesando página ${pagina.numero}`;
  pagina.intento += 1;

  return pagina;
}

function finalizarPagina(
  pagina,
  {
    productosDetectados = 0,
    productosGuardados = 0,
    errores = 0,
    items = [],
  } = {}
) {
  pagina.estado = "COMPLETADO";
  pagina.fin = new Date().toISOString();
  pagina.productosDetectados = productosDetectados;
  pagina.productosGuardados = productosGuardados;
  pagina.errores = errores;
  pagina.items = items;
  pagina.mensaje = "Página procesada correctamente";
  pagina.tiempoSegundos = pagina.inicio
    ? Math.round((new Date(pagina.fin) - new Date(pagina.inicio)) / 1000)
    : 0;

  return pagina;
}

function errorPagina(pagina, mensaje = "") {
  pagina.estado = "ERROR";
  pagina.fin = new Date().toISOString();
  pagina.error = mensaje;
  pagina.mensaje = mensaje;
  pagina.tiempoSegundos = pagina.inicio
    ? Math.round((new Date(pagina.fin) - new Date(pagina.inicio)) / 1000)
    : 0;

  return pagina;
}

function reiniciarPagina(pagina) {
  pagina.estado = "PENDIENTE";
  pagina.inicio = null;
  pagina.fin = null;
  pagina.error = null;
  pagina.mensaje = "";
  pagina.productosDetectados = 0;
  pagina.productosGuardados = 0;
  pagina.errores = 0;
  pagina.items = [];
  pagina.imagen = null;

  return pagina;
}

function paginaTerminada(pagina) {
  return pagina.estado === "COMPLETADO";
}

function paginaConError(pagina) {
  return pagina.estado === "ERROR";
}

function paginaPendiente(pagina) {
  return pagina.estado === "PENDIENTE";
}

module.exports = {
  crearPagina,
  iniciarPagina,
  finalizarPagina,
  errorPagina,
  reiniciarPagina,
  paginaTerminada,
  paginaConError,
  paginaPendiente,
};