const crypto = require("crypto");

const trabajos = new Map();

function crearTrabajo({ proveedor = {}, archivo = {}, totalPaginas = 0 } = {}) {
  const id = crypto.randomUUID();
  const ahora = new Date().toISOString();

  const paginas = [];

  for (let i = 1; i <= totalPaginas; i += 1) {
    paginas.push({
      numero: i,
      estado: "PENDIENTE",
      inicio: null,
      fin: null,
      productosDetectados: 0,
      productosGuardados: 0,
      errores: 0,
      tiempoSegundos: 0,
    });
  }

  const job = {
    id,
    estado: "PENDIENTE",
    proveedor,
    archivo,
    creado: ahora,
    iniciado: null,
    finalizado: null,
    mensaje: "Trabajo creado",
    progreso: {
      porcentaje: 0,
      paginaActual: 0,
      totalPaginas,
      productosDetectados: 0,
      productosGuardados: 0,
      errores: 0,
      tiempoEstimado: null,
    },
    paginas,
  };

  trabajos.set(id, job);
  return job;
}

function obtenerTrabajo(id) {
  return trabajos.get(id) || null;
}

function listarTrabajos() {
  return [...trabajos.values()];
}

function eliminarTrabajo(id) {
  trabajos.delete(id);
}

function iniciarTrabajo(id) {
  const job = trabajos.get(id);
  if (!job) return null;

  job.estado = "PROCESANDO";
  job.iniciado = new Date().toISOString();
  job.mensaje = "Procesando catálogo";

  trabajos.set(id, job);
  return job;
}

function finalizarTrabajo(id) {
  const job = trabajos.get(id);
  if (!job) return null;

  job.estado = "COMPLETADO";
  job.finalizado = new Date().toISOString();
  job.progreso.porcentaje = 100;
  job.mensaje = "Importación completada";

  trabajos.set(id, job);
  return job;
}

function errorTrabajo(id, mensaje = "") {
  const job = trabajos.get(id);
  if (!job) return null;

  job.estado = "ERROR";
  job.mensaje = mensaje;
  job.finalizado = new Date().toISOString();

  trabajos.set(id, job);
  return job;
}

function actualizarTrabajo(id, cambios = {}) {
  const job = trabajos.get(id);
  if (!job) return null;

  Object.assign(job, cambios);
  trabajos.set(id, job);

  return job;
}

function actualizarProgreso(id, progreso = {}) {
  const job = trabajos.get(id);
  if (!job) return null;

  job.progreso = {
    ...job.progreso,
    ...progreso,
  };

  if (job.progreso.totalPaginas > 0) {
    job.progreso.porcentaje = Number(
      ((job.progreso.paginaActual / job.progreso.totalPaginas) * 100).toFixed(2)
    );
  }

  trabajos.set(id, job);
  return job;
}

function obtenerPagina(id, numeroPagina) {
  const job = trabajos.get(id);
  if (!job) return null;

  return job.paginas.find((p) => p.numero === numeroPagina) || null;
}

function actualizarPagina(id, numeroPagina, cambios = {}) {
  const job = trabajos.get(id);
  if (!job) return null;

  const pagina = job.paginas.find((p) => p.numero === numeroPagina);
  if (!pagina) return null;

  Object.assign(pagina, cambios);
  trabajos.set(id, job);

  return pagina;
}

module.exports = {
  crearTrabajo,
  obtenerTrabajo,
  listarTrabajos,
  eliminarTrabajo,
  iniciarTrabajo,
  finalizarTrabajo,
  errorTrabajo,
  actualizarTrabajo,
  actualizarProgreso,
  obtenerPagina,
  actualizarPagina,
};