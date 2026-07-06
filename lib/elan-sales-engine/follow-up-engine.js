import { includesAny, normalizeText } from "./text-utils.js";

function safeDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addDays(value, days) {
  const date = safeDate(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function analyzeFollowUpPreference(message = "", now = new Date()) {
  const text = normalizeText(message);

  if (includesAny(text, ["no deseo seguimiento", "no quiero seguimiento", "no me escribas", "no seguimiento"])) {
    return {
      detected: true,
      option: "sin_seguimiento",
      wantsFollowUp: false,
      days: null,
      followUpAt: null,
      label: "No desea seguimiento",
    };
  }

  if (includesAny(text, ["cuando yo escriba", "cuando lo solicite", "cuando te escriba", "yo aviso"])) {
    return {
      detected: true,
      option: "cliente_solicita",
      wantsFollowUp: true,
      days: null,
      followUpAt: null,
      label: "Cuando el cliente lo solicite",
    };
  }

  const options = [
    { option: "una_semana", days: 7, label: "Una semana", terms: ["una semana", "1 semana", "7 dias"] },
    { option: "quince_dias", days: 15, label: "Quince dias", terms: ["15 dias", "quince dias", "dos semanas"] },
    { option: "un_mes", days: 30, label: "Un mes", terms: ["un mes", "1 mes", "30 dias"] },
  ];

  const match = options.find((item) => includesAny(text, item.terms));
  if (!match) {
    return {
      detected: false,
      option: null,
      wantsFollowUp: null,
      days: null,
      followUpAt: null,
      label: "",
    };
  }

  return {
    detected: true,
    option: match.option,
    wantsFollowUp: true,
    days: match.days,
    followUpAt: addDays(now, match.days),
    label: match.label,
  };
}

export function getFollowUpQuestion() {
  return "Para darle seguimiento sin incomodarte, decime si preferis que te escriba en una semana, en 15 dias, en un mes, cuando vos lo solicites o si no deseas seguimiento.";
}
