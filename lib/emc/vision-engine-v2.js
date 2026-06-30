async function analizarPaginaVision({ pagina, proveedor, imagen } = {}) {
  return {
    ok: true,
    pagina,
    proveedor,
    imagen,
    productos: [],
    estado: "PENDIENTE_IMPLEMENTACION_AI20B",
  };
}

module.exports = {
  analizarPaginaVision,
};