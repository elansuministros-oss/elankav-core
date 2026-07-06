import { includesAny } from "./text-utils.js";

export function analyzeVisitRequest(message = "") {
  const detected = includesAny(message, [
    "pueden visitar",
    "visitar mi negocio",
    "visita tecnica",
    "visita",
    "venir a mi negocio",
    "llegar al local",
    "vienen al local",
    "pueden venir",
  ]);

  return {
    detected,
    requiredData: detected ? ["ubicacion", "foto del negocio", "medidas aproximadas", "producto solicitado"] : [],
  };
}
