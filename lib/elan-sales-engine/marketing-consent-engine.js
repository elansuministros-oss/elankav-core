import { includesAny } from "./text-utils.js";

export function analyzeMarketingConsent(message = "") {
  if (includesAny(message, ["no quiero promociones", "no promociones", "no deseo promociones", "no me manden promociones"])) {
    return {
      detected: true,
      granted: false,
      status: "denied",
      label: "No desea promociones",
    };
  }

  if (
    includesAny(message, [
      "quiero recibir promociones",
      "recibir promociones",
      "mandame promociones",
      "enviame promociones",
      "promociones",
      "descuentos",
      "ofertas",
      "novedades",
    ])
  ) {
    return {
      detected: true,
      granted: true,
      status: "granted",
      label: "Acepta promociones",
    };
  }

  return {
    detected: false,
    granted: null,
    status: "unknown",
    label: "",
  };
}

export function getMarketingConsentQuestion() {
  return "Tambien puedo avisarte por WhatsApp cuando haya promociones, descuentos o novedades de ELANVISUAL. Queres recibirlas?";
}
