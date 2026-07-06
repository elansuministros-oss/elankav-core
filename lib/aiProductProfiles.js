export const aiProductProfiles = {
  botones: {
    producto: "Botones publicitarios luminosos",
    especialista: "ELAN AI Botones",
    fuente_costos: "AI-23",
    nota_costos: "Este perfil solo describe criterios visuales y constructivos. No contiene precios. Todo costo debe calcularse con AI-23.",
    modelos: {
      "boton-transparente": {
        nombre: "Botón Transparente",
        referencia: "Beauty Therapy",
        medida_base: "60x60 cm",
        descripcion: "Botón circular acrílico transparente con elementos gráficos aplicados, acabado limpio y moderno."
      },
      "boton-impresion": {
        nombre: "Botón con Impresión",
        referencia: "La Casa de las Gorras",
        medida_base: "60x60 cm",
        descripcion: "Botón circular con fondo impreso full color, ideal para marcas comerciales visibles."
      },
      "boton-uv-premium": {
        nombre: "Botón Impresión UV Premium",
        referencia: "Fiesta Naty",
        medida_base: "60x60 cm",
        descripcion: "Botón premium con impresión UV, mayor presencia visual, colores sólidos y acabado profesional."
      },
      "boton-premium-combinado": {
        nombre: "Botón Premium Combinado",
        referencia: "Lanza's Ranch",
        medida_base: "80–110 cm",
        descripcion: "Botón premium combinado con volumen, impresión, acrílicos y presencia comercial superior."
      }
    },
    reglas: [
      "Diseñar siempre como botón circular real.",
      "No convertirlo en rótulo rectangular.",
      "No mezclar con fachadas ACM, letras 3D, roll ups ni displays.",
      "Mantener escala real de fabricación.",
      "Usar pared o fondo comercial sobrio.",
      "Priorizar lectura clara del logo.",
      "No inventar estructuras imposibles.",
      "Render limpio, profesional, comercial y vendible.",
      "No usar este perfil como fuente de precios.",
      "Para costos, consumir exclusivamente AI-23."
    ]
  }
};

export function obtenerPerfilProducto(producto = "") {
  const key = String(producto || "").toLowerCase();

  if (key.includes("boton") || key.includes("botón") || key.includes("botones")) {
    return aiProductProfiles.botones;
  }

  return null;
}

export function obtenerModeloBoton(modelo = "") {
  const perfil = aiProductProfiles.botones;
  const key = String(modelo || "").toLowerCase();

  if (perfil.modelos[key]) return perfil.modelos[key];

  return (
    Object.values(perfil.modelos).find((m) =>
      key.includes(String(m.nombre || "").toLowerCase())
    ) || perfil.modelos["boton-transparente"]
  );
}
