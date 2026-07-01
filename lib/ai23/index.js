export { AI23_ESTADOS, AI23_MONEDAS, AI23_TABLES } from "./ai23.constants.js";
export { createAI23Client } from "./ai23.client.js";
export { createAI23Repository } from "./ai23.repository.js";

export {
  fail,
  ok,
  requireObject,
  requireId,
  normalizeText,
  normalizeNumber,
  assertPositiveNumber
} from "./ai23.utils.js";

export { createAI23ComponentesService } from "./ai23.componentes.service.js";
export { createAI23CombinacionesService } from "./ai23.combinaciones.service.js";
export { createAI23AdicionalesService } from "./ai23.adicionales.service.js";
export { createAI23CostosReferenciaService } from "./ai23.costos-referencia.service.js";
export { createAI23MotorCostosService } from "./ai23.motor-costos.service.js";

export function createAI23Services(repository = null) {
  return {
    componentes: createAI23ComponentesService(repository || undefined),
    combinaciones: createAI23CombinacionesService(repository || undefined),
    adicionales: createAI23AdicionalesService(repository || undefined),
    costosReferencia: createAI23CostosReferenciaService(repository || undefined),
    motorCostos: createAI23MotorCostosService(repository || undefined)
  };
}

import { createAI23ComponentesService } from "./ai23.componentes.service.js";
import { createAI23CombinacionesService } from "./ai23.combinaciones.service.js";
import { createAI23AdicionalesService } from "./ai23.adicionales.service.js";
import { createAI23CostosReferenciaService } from "./ai23.costos-referencia.service.js";
import { createAI23MotorCostosService } from "./ai23.motor-costos.service.js";