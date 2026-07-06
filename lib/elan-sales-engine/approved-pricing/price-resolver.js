import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRICING_MASTER_PATH = path.join(__dirname, "pricing-master.xlsx");

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[^0-9.,-]/g, "").replace(",", ".");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function isYes(value = "") {
  return ["si", "sí", "yes", "true", "1"].includes(normalize(value));
}

function getValue(row = {}, aliases = []) {
  const keys = Object.keys(row);

  for (const alias of aliases) {
    const foundKey = keys.find((key) => normalize(key) === normalize(alias));
    if (foundKey) return row[foundKey];
  }

  return "";
}

function readPricingRows() {
  if (!fs.existsSync(PRICING_MASTER_PATH)) return [];

  const workbook = XLSX.readFile(PRICING_MASTER_PATH);
  const sheetName =
    workbook.SheetNames.find((name) => normalize(name).includes("pricing")) ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function mapRow(row = {}) {
  return {
    category: String(getValue(row, ["Categoria", "Categoría", "Category"]) || ""),
    subcategory: String(getValue(row, ["Subcategoria", "Subcategoría", "Subcategory"]) || ""),
    product: String(getValue(row, ["Producto", "Product", "Nombre"]) || ""),
    unit: String(getValue(row, ["Unidad", "Unit", "Unidad de venta"]) || ""),
    calculationType: String(getValue(row, ["TipoCalculo", "Tipo de calculo", "Tipo de cálculo", "Calculation Type"]) || ""),
    ecosolvente: toNumber(getValue(row, ["Precio_Ecosolvente_USD", "Ecosolvente", "Eco solvente", "EcoSolvente"])),
    uv: toNumber(getValue(row, ["Precio_UV_USD", "UV", "Uv", "Impresion UV", "Impresión UV"])),
    recommendedTechnology: String(getValue(row, ["Tecnologia_Recomendada", "Tecnologia recomendada", "Tecnología recomendada", "Recommended Technology"]) || ""),
    status: String(getValue(row, ["Estado", "Status"]) || "Activo"),
    notes: String(getValue(row, ["Observaciones", "Notas", "Notes"]) || ""),
    aliases: String(getValue(row, ["Aliases", "Alias", "Sinonimos", "Sinónimos"]) || ""),
    commercialCondition: String(getValue(row, ["Condicion_Comercial", "Condición_Comercial", "Condicion Comercial", "Condición Comercial"]) || ""),
    allowAiQuote: isYes(getValue(row, ["Permitir_Cotizacion_IA", "Permitir Cotizacion IA", "Permitir Cotización IA"])),
    requiresApproval: isYes(getValue(row, ["Requiere_Aprobacion", "Requiere Aprobacion", "Requiere Aprobación"])),
  };
}

function getCatalog() {
  return readPricingRows().map(mapRow).filter((item) => {
    if (!item.product) return false;
    if (normalize(item.status) && normalize(item.status) !== "activo") return false;
    return true;
  });
}

function containsAny(text = "", words = []) {
  const normalized = normalize(text);
  return words.some((word) => normalized.includes(normalize(word)));
}

function inferTechnology({ message = "", placement = "", item = {} } = {}) {
  const text = normalize(`${message} ${placement}`);

  if (containsAny(text, ["uv", "premium", "alta calidad", "durable", "durabilidad"])) return "uv";
  if (containsAny(text, ["economico", "económico", "barato", "ecosolvente", "eco solvente"])) return "ecosolvente";
  if (containsAny(text, ["exterior", "afuera", "intemperie", "sol", "lluvia", "fachada"])) return "uv";

  const recommended = normalize(item.recommendedTechnology);
  if (recommended.includes("uv")) return "uv";
  if (recommended.includes("eco")) return "ecosolvente";

  return item.uv > 0 ? "uv" : "ecosolvente";
}

function findBestItem({ product = "", message = "" } = {}) {
  const catalog = getCatalog();
  const query = normalize(`${product} ${message}`);

  if (!query) return null;

  return (
    catalog.find((item) => query.includes(normalize(item.product))) ||
    catalog.find((item) => normalize(item.product).includes(query)) ||
    catalog.find((item) => item.aliases && containsAny(query, String(item.aliases).split(","))) ||
    catalog.find((item) => query.includes(normalize(item.subcategory))) ||
    catalog.find((item) => query.includes(normalize(item.category))) ||
    null
  );
}

export function calculateAreaFromMeasure(measure = "") {
  const normalized = normalize(measure).replace(/,/g, ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|mts|metros|cm)?\s*[x*×]\s*(\d+(?:\.\d+)?)\s*(?:m|mts|metros|cm)?/);

  if (!match) return 0;

  let width = Number(match[1]);
  let height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return 0;

  if (normalized.includes("cm")) {
    width = width / 100;
    height = height / 100;
  }

  return Number((width * height).toFixed(4));
}

export function resolveAuthorizedPrice({
  product = "",
  placement = "",
  message = "",
  measure = "",
} = {}) {
  const item = findBestItem({ product, message });

  if (!item) {
    return {
      found: false,
      source: "pricing-master.xlsx",
      requiresHumanApproval: true,
      reason: "producto_no_autorizado",
      technology: "",
      item: null,
      internal: null,
      customer: null,
    };
  }

  if (!item.allowAiQuote || item.requiresApproval) {
    return {
      found: true,
      source: "pricing-master.xlsx",
      requiresHumanApproval: true,
      reason: item.requiresApproval ? "requiere_aprobacion" : "cotizacion_ia_no_permitida",
      technology: "",
      item,
      internal: null,
      customer: null,
    };
  }

  const technology = inferTechnology({ message, placement, item });
  const unitPrice = technology === "uv" ? item.uv : item.ecosolvente;

  if (!unitPrice) {
    return {
      found: false,
      source: "pricing-master.xlsx",
      requiresHumanApproval: true,
      reason: "precio_no_autorizado_para_tecnologia",
      technology,
      item,
      internal: null,
      customer: null,
    };
  }

  const unit = normalize(item.unit);
  const calculationType = normalize(item.calculationType || item.unit);

  let quantity = 1;
  let areaM2 = 0;

  if (calculationType.includes("m2") || calculationType.includes("m²") || unit.includes("m2") || unit.includes("m²")) {
    areaM2 = calculateAreaFromMeasure(measure || message);
    quantity = areaM2 || 1;
  }

  const total = Number((quantity * unitPrice).toFixed(2));

  return {
    found: true,
    source: "pricing-master.xlsx",
    requiresHumanApproval: false,
    technology,
    item,

    internal: {
      unitPrice,
      unit: item.unit || "unidad",
      quantity,
      areaM2,
      calculationType,
    },

    customer: {
      total,
      currency: "USD",
      commercialCondition: item.commercialCondition || "No incluye instalación, transporte ni envío.",
    },
  };
}