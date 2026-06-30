function crearReferenciaStorage({
  proveedor = "",
  archivo = "",
  pagina = 1,
} = {}) {
  const fecha = new Date().toISOString().slice(0, 10);

  const nombre = String(archivo || "catalogo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_");

  const proveedorSeguro = String(proveedor || "general")
    .replace(/[^a-zA-Z0-9-_]/g, "_");

  return {
    carpeta: `emc/${proveedorSeguro}/${fecha}`,
    archivo: `${nombre}_pagina_${String(pagina).padStart(4, "0")}.png`,
  };
}

function construirRutaStorage(datos = {}) {
  const ref = crearReferenciaStorage(datos);
  return `${ref.carpeta}/${ref.archivo}`;
}

module.exports = {
  crearReferenciaStorage,
  construirRutaStorage,
};