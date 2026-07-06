import { normalizeText, stripWhatsAppSuffix } from "./text-utils.js";

export const MATERIAL_RESOLUTION_CONTRACT_VERSION = "ELAN_SALES_ECE_AI23_REQUIREMENT_V1";

const PRODUCT_MATERIAL_BLUEPRINTS = {
  "boton-luminoso": {
    producto: "boton luminoso",
    tecnologia: ["rotulacion", "iluminacion"],
    materiales: [
      { key: "acrilico", nombre: "acrilico", rol: "frente o difusor", requerido: true, terminos: ["acrilico", "acrilico transparente", "acrilico blanco"] },
      { key: "pvc", nombre: "PVC", rol: "base o respaldo", requerido: true, terminos: ["pvc", "pvc espumado", "foam"] },
      { key: "vinil", nombre: "vinil", rol: "grafica aplicada", requerido: true, terminos: ["vinil", "vinil adhesivo", "vinilo"] },
      { key: "led", nombre: "LED", rol: "iluminacion", requerido: true, terminos: ["led", "modulo led", "cinta led", "fuente led"] },
      { key: "estructura", nombre: "estructura", rol: "estructura o separacion", requerido: false, terminos: ["estructura", "perfil", "separador", "tornillo"] },
    ],
  },
  "letras-3d": {
    producto: "letras 3D",
    tecnologia: ["rotulacion", "volumetria", "iluminacion opcional"],
    materiales: [
      { key: "acrilico", nombre: "acrilico", rol: "frente o acabado", requerido: false, terminos: ["acrilico"] },
      { key: "pvc", nombre: "PVC", rol: "cuerpo o respaldo", requerido: true, terminos: ["pvc", "foam"] },
      { key: "led", nombre: "LED", rol: "iluminacion opcional", requerido: false, terminos: ["led", "modulo led", "cinta led"] },
      { key: "vinil", nombre: "vinil", rol: "color o grafica", requerido: false, terminos: ["vinil", "vinilo"] },
    ],
  },
  "fachada-acm": {
    producto: "fachada ACM",
    tecnologia: ["revestimiento", "rotulacion"],
    materiales: [
      { key: "acm", nombre: "ACM", rol: "revestimiento principal", requerido: true, terminos: ["acm", "alucobond", "panel compuesto"] },
      { key: "estructura", nombre: "estructura", rol: "soporte", requerido: true, terminos: ["estructura", "perfil", "tubo", "angular"] },
      { key: "vinil", nombre: "vinil", rol: "grafica o detalle visual", requerido: false, terminos: ["vinil", "vinilo"] },
      { key: "led", nombre: "LED", rol: "iluminacion opcional", requerido: false, terminos: ["led", "modulo led"] },
    ],
  },
  rotulo: {
    producto: "rotulo comercial",
    tecnologia: ["rotulacion"],
    materiales: [
      { key: "pvc", nombre: "PVC", rol: "base", requerido: false, terminos: ["pvc", "foam"] },
      { key: "acrilico", nombre: "acrilico", rol: "frente o acabado", requerido: false, terminos: ["acrilico"] },
      { key: "vinil", nombre: "vinil", rol: "grafica", requerido: true, terminos: ["vinil", "vinilo"] },
      { key: "led", nombre: "LED", rol: "iluminacion opcional", requerido: false, terminos: ["led"] },
    ],
  },
  impresion: {
    producto: "impresion",
    tecnologia: ["ecosolvente", "UV", "segun catalogo"],
    materiales: [
      { key: "vinil-adhesivo", nombre: "vinil adhesivo", rol: "sustrato imprimible", requerido: true, terminos: ["vinil adhesivo", "vinilo adhesivo", "vinil blanco"] },
      { key: "tinta", nombre: "tinta", rol: "tecnologia de impresion", requerido: true, terminos: ["ecosolvente", "uv", "tinta"] },
      { key: "laminado", nombre: "laminado", rol: "proteccion opcional", requerido: false, terminos: ["laminado", "laminacion"] },
    ],
  },
  vinil: {
    producto: "impresion vinil",
    tecnologia: ["ecosolvente", "UV", "segun catalogo"],
    materiales: [
      { key: "vinil-adhesivo", nombre: "vinil adhesivo", rol: "sustrato imprimible", requerido: true, terminos: ["vinil adhesivo", "vinilo adhesivo", "vinil blanco", "vinil imprimible"] },
      { key: "tinta", nombre: "tinta", rol: "tecnologia de impresion", requerido: true, terminos: ["ecosolvente", "uv", "tinta"] },
      { key: "laminado", nombre: "laminado", rol: "proteccion opcional", requerido: false, terminos: ["laminado", "laminacion"] },
    ],
  },
  microperforado: {
    producto: "vinil microperforado",
    tecnologia: ["ecosolvente", "UV", "segun catalogo"],
    materiales: [
      { key: "microperforado", nombre: "vinil microperforado", rol: "sustrato imprimible", requerido: true, terminos: ["microperforado", "micro perforado", "one way vision"] },
      { key: "tinta", nombre: "tinta", rol: "tecnologia de impresion", requerido: true, terminos: ["ecosolvente", "uv", "tinta"] },
    ],
  },
  pvc: {
    producto: "PVC",
    tecnologia: ["corte", "rotulacion"],
    materiales: [
      { key: "pvc", nombre: "PVC", rol: "material principal", requerido: true, terminos: ["pvc", "pvc espumado", "foam"] },
      { key: "vinil", nombre: "vinil", rol: "grafica opcional", requerido: false, terminos: ["vinil", "vinilo"] },
    ],
  },
  acrilico: {
    producto: "acrilico",
    tecnologia: ["corte", "rotulacion"],
    materiales: [
      { key: "acrilico", nombre: "acrilico", rol: "material principal", requerido: true, terminos: ["acrilico", "plexiglas", "metacrilato"] },
      { key: "vinil", nombre: "vinil", rol: "grafica opcional", requerido: false, terminos: ["vinil", "vinilo"] },
    ],
  },
  senalizacion: {
    producto: "senalizacion",
    tecnologia: ["rotulacion", "senalizacion"],
    materiales: [
      { key: "pvc", nombre: "PVC", rol: "base", requerido: false, terminos: ["pvc", "foam"] },
      { key: "acrilico", nombre: "acrilico", rol: "base o acabado", requerido: false, terminos: ["acrilico"] },
      { key: "vinil", nombre: "vinil", rol: "grafica", requerido: true, terminos: ["vinil", "vinilo"] },
    ],
  },
};

function median(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeCatalogItem(item = {}) {
  const providerId = item.proveedor_id || item.provider_id || item.proveedorId || item.providerId || "";
  const providerName = item.proveedor_nombre || item.provider_name || item.proveedor || item.provider || "";
  const price = item.precio ?? item.costo ?? item.costo_unitario ?? item.price ?? item.unit_price ?? null;
  const name = item.nombre || item.nombre_catalogo || item.descripcion || item.name || "";

  return {
    id: item.id || item.item_id || item.codigo || "",
    nombre: name,
    categoria: item.categoria || item.category || "",
    unidad: item.unidad || item.unit || "",
    moneda: item.moneda || item.currency || "",
    proveedor_id: providerId,
    proveedor_nombre: providerName,
    precio: Number(price),
    precio_valido: Number.isFinite(Number(price)) && Number(price) > 0,
    proveedor_registrado: Boolean(providerId || providerName),
    raw: item,
  };
}

function matchesMaterial(item = {}, material = {}) {
  const haystack = normalizeText(`${item.nombre} ${item.categoria} ${item.unidad}`);
  return material.terminos.some((term) => haystack.includes(normalizeText(term)));
}

function getBlueprint(product = {}) {
  return PRODUCT_MATERIAL_BLUEPRINTS[product?.id] || null;
}

export function buildMaterialResolutionRequirement({ normalized = {}, productResult = {}, memory = {}, now = new Date() } = {}) {
  const product = productResult.primaryProduct || null;
  const blueprint = getBlueprint(product);

  if (!product || !blueprint) {
    return {
      version: MATERIAL_RESOLUTION_CONTRACT_VERSION,
      target: "ECE_AI23",
      status: "pending_product",
      reason: "Producto no detectado para preparar materiales.",
      shouldRequestResolution: false,
    };
  }

  return {
    version: MATERIAL_RESOLUTION_CONTRACT_VERSION,
    target: "ECE_AI23",
    createdAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    source: "ELAN_AI_SALES_ENGINE",
    shouldRequestResolution: true,
    pricingPolicy: {
      finalCostOwner: "ECE_AI23",
      forbidManualPrices: true,
      useRegisteredProvidersOnly: true,
      doNotAutoPickLowest: true,
      doNotAutoPickHighest: true,
      useMedianWhenProviderCountAtLeast: 3,
    },
    leadContext: {
      chatId: normalized.chatId || "",
      whatsapp: stripWhatsAppSuffix(normalized.chatId || normalized.from || ""),
      messageId: normalized.messageId || "",
      originalMessage: normalized.body || "",
    },
    producto: {
      id: product.id,
      nombre: blueprint.producto,
      detectadoPor: productResult.fromMemory ? "memoria_conversacion" : "mensaje_cliente",
    },
    tecnologia: blueprint.tecnologia.map((name) => ({
      nombre: name,
      estado: "pendiente_validacion_catalogo",
    })),
    medidas: {
      valor: memory.measure || "",
      estado: memory.measure ? "capturada" : "pendiente",
    },
    instalacion: {
      interiorExterior: memory.placement || "",
      estado: memory.placement ? "capturada" : "pendiente",
    },
    logo: {
      estado: memory.logoStatus || "pendiente",
    },
    foto: {
      recibida: Boolean(memory.photoReceived),
      estado: memory.photoReceived ? "capturada" : "pendiente",
    },
    materiales: blueprint.materiales.map((material) => ({
      ...material,
      estado: "pendiente_validacion_ece_ai23",
      proveedor: {
        estado: "pendiente_busqueda_catalogo_registrado",
        sugerido: null,
      },
      precio: {
        estado: "pendiente_validacion_ece_ai23",
        referenciaOperativa: null,
      },
    })),
    estadoGeneral: "pendiente_validacion_ece_ai23",
    nextAction: "ECE_AI23 debe buscar materiales reales en EMC/catalogo/proveedores registrados y calcular costo final.",
  };
}

export function resolveRegisteredProviderMaterials(requirement = {}, catalogItems = []) {
  const items = catalogItems.map(normalizeCatalogItem);

  if (!requirement?.materiales?.length) {
    return {
      ...requirement,
      estadoGeneral: "pendiente_materiales",
      resolucion: [],
    };
  }

  const resolucion = requirement.materiales.map((material) => {
    const matches = items.filter((item) => matchesMaterial(item, material));
    const validProviderMatches = matches.filter((item) => item.proveedor_registrado);
    const pricedMatches = validProviderMatches.filter((item) => item.precio_valido);
    const providerNames = Array.from(new Set(validProviderMatches.map((item) => item.proveedor_nombre || item.proveedor_id).filter(Boolean)));
    const providerCount = providerNames.length;
    const hasMissingData = !matches.length || !validProviderMatches.length || validProviderMatches.some((item) => !item.precio_valido);
    const referencePrice = !hasMissingData && providerCount >= 3 ? median(pricedMatches.map((item) => item.precio)) : null;

    return {
      materialKey: material.key,
      materialNombre: material.nombre,
      requerido: Boolean(material.requerido),
      estado: hasMissingData ? "pendiente_validacion" : providerCount > 1 ? "multi-proveedor" : "validado",
      proveedor: {
        estado: hasMissingData ? "pendiente_validacion" : providerCount > 1 ? "multi-proveedor" : "validado",
        cantidad: providerCount,
        sugerido:
          providerCount === 1
            ? {
                nombre: providerNames[0],
                criterio: "unico proveedor registrado encontrado",
              }
            : null,
      },
      precio: {
        estado:
          referencePrice !== null
            ? "referencia_mediana_operativa"
            : pricedMatches.length
              ? "validado_sin_mediana_operativa"
              : "pendiente_validacion",
        referenciaOperativa: referencePrice,
        politica: "No es precio final. ECE/AI-23 decide costo, margen, PDF y cotizacion.",
      },
      candidatos: validProviderMatches.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        proveedor_id: item.proveedor_id,
        proveedor_nombre: item.proveedor_nombre,
        unidad: item.unidad,
        moneda: item.moneda,
        tienePrecio: item.precio_valido,
      })),
    };
  });

  const required = resolucion.filter((item) => item.requerido);
  const hasPendingRequired = required.some((item) => item.estado === "pendiente_validacion");
  const hasMultiProvider = resolucion.some((item) => item.estado === "multi-proveedor");

  return {
    ...requirement,
    estadoGeneral: hasPendingRequired ? "pendiente_validacion" : hasMultiProvider ? "multi-proveedor" : "validado",
    resolucion,
    nextAction: "Enviar este requerimiento resuelto a ECE/AI-23 para calculo final. ELAN AI no calcula costos finales.",
  };
}

export function summarizeMaterialResolution(requirement = {}) {
  if (!requirement?.shouldRequestResolution) return "Materiales: pendiente producto";

  const materiales = (requirement.materiales || [])
    .map((material) => material.nombre)
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");

  return `Materiales probables: ${materiales || "pendientes"} | Tecnologia: ${(requirement.tecnologia || [])
    .map((item) => item.nombre)
    .join("/")} | Estado: ${requirement.estadoGeneral || "pendiente_validacion_ece_ai23"}`;
}
