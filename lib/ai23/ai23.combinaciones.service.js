import { AI23_ESTADOS } from "./ai23.constants.js";
import { createAI23Repository } from "./ai23.repository.js";
import {
  fail,
  normalizeNumber,
  normalizeText,
  ok,
  requireId,
  requireObject
} from "./ai23.utils.js";

function normalizeCombinacionInput(payload) {
  requireObject(payload, "combinacion");

  const nombre = normalizeText(payload.nombre);
  if (!nombre) throw new Error("AI23_COMBINACION_NOMBRE_REQUERIDO");

  const estado = normalizeText(payload.estado || AI23_ESTADOS.activo);
  if (!Object.values(AI23_ESTADOS).includes(estado)) {
    throw new Error("AI23_COMBINACION_ESTADO_INVALIDO");
  }

  return {
    codigo: normalizeText(payload.codigo) || null,
    nombre,
    descripcion: normalizeText(payload.descripcion) || null,
    categoria: normalizeText(payload.categoria) || null,
    unidad_resultado: normalizeText(
      payload.unidad_resultado ?? payload.unidadResultado
    ) || null,
    margen_porcentaje: normalizeNumber(
      payload.margen_porcentaje ?? payload.margenPorcentaje,
      0
    ),
    mano_obra: normalizeNumber(payload.mano_obra ?? payload.manoObra, 0),
    indirectos: normalizeNumber(payload.indirectos, 0),
    estado
  };
}

function normalizeCombinacionComponenteInput(payload) {
  requireObject(payload, "combinacion_componente");

  const combinacionId = normalizeText(
    payload.combinacion_id ?? payload.combinacionId
  );
  if (!combinacionId) {
    throw new Error("AI23_COMBINACION_ID_REQUERIDO");
  }

  const componenteId = normalizeText(
    payload.componente_id ?? payload.componenteId
  );
  if (!componenteId) {
    throw new Error("AI23_COMPONENTE_ID_REQUERIDO");
  }

  const cantidad = normalizeNumber(payload.cantidad, 0);
  if (cantidad <= 0) {
    throw new Error("AI23_CANTIDAD_COMPONENTE_INVALIDA");
  }

  return {
    combinacion_id: combinacionId,
    componente_id: componenteId,
    cantidad,
    factor_merma: normalizeNumber(
      payload.factor_merma ?? payload.factorMerma,
      0
    ),
    observacion: normalizeText(payload.observacion) || null
  };
}

export function createAI23CombinacionesService(repository = createAI23Repository()) {
  return {
    async listar(filtros = {}, opciones = {}) {
      try {
        const { data, error } = await repository.combinaciones.list(filtros, {
          orderBy: opciones.orderBy || "nombre",
          ascending: opciones.ascending !== false,
          limit: opciones.limit
        });

        if (error) return fail("AI23_COMBINACIONES_LIST_ERROR", error.message, error);
        return ok(data || []);
      } catch (error) {
        return fail("AI23_COMBINACIONES_LIST_EXCEPTION", error.message, error);
      }
    },

    async obtenerPorId(id) {
      try {
        requireId(id, "combinacion_id");

        const { data, error } = await repository.combinaciones.getById(id);

        if (error) return fail("AI23_COMBINACION_GET_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMBINACION_GET_EXCEPTION", error.message, error);
      }
    },

    async crear(payload) {
      try {
        const input = normalizeCombinacionInput(payload);
        const { data, error } = await repository.combinaciones.create(input);

        if (error) return fail("AI23_COMBINACION_CREATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMBINACION_CREATE_EXCEPTION", error.message, error);
      }
    },

    async actualizar(id, payload) {
      try {
        requireId(id, "combinacion_id");
        const input = normalizeCombinacionInput(payload);

        const { data, error } = await repository.combinaciones.update(id, input);

        if (error) return fail("AI23_COMBINACION_UPDATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMBINACION_UPDATE_EXCEPTION", error.message, error);
      }
    },

    async eliminar(id) {
      try {
        requireId(id, "combinacion_id");

        const { data, error } = await repository.combinaciones.remove(id);

        if (error) return fail("AI23_COMBINACION_DELETE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMBINACION_DELETE_EXCEPTION", error.message, error);
      }
    },

    async listarComponentes(combinacionId) {
      try {
        requireId(combinacionId, "combinacion_id");

        const { data, error } = await repository.combinacionComponentes.list(
          { combinacion_id: combinacionId },
          { orderBy: "id" }
        );

        if (error) {
          return fail("AI23_COMBINACION_COMPONENTES_LIST_ERROR", error.message, error);
        }

        return ok(data || []);
      } catch (error) {
        return fail(
          "AI23_COMBINACION_COMPONENTES_LIST_EXCEPTION",
          error.message,
          error
        );
      }
    },

    async agregarComponente(payload) {
      try {
        const input = normalizeCombinacionComponenteInput(payload);
        const { data, error } = await repository.combinacionComponentes.create(input);

        if (error) {
          return fail("AI23_COMBINACION_COMPONENTE_CREATE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail(
          "AI23_COMBINACION_COMPONENTE_CREATE_EXCEPTION",
          error.message,
          error
        );
      }
    },

    async actualizarComponente(id, payload) {
      try {
        requireId(id, "combinacion_componente_id");
        const input = normalizeCombinacionComponenteInput(payload);

        const { data, error } = await repository.combinacionComponentes.update(
          id,
          input
        );

        if (error) {
          return fail("AI23_COMBINACION_COMPONENTE_UPDATE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail(
          "AI23_COMBINACION_COMPONENTE_UPDATE_EXCEPTION",
          error.message,
          error
        );
      }
    },

    async eliminarComponente(id) {
      try {
        requireId(id, "combinacion_componente_id");

        const { data, error } = await repository.combinacionComponentes.remove(id);

        if (error) {
          return fail("AI23_COMBINACION_COMPONENTE_DELETE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail(
          "AI23_COMBINACION_COMPONENTE_DELETE_EXCEPTION",
          error.message,
          error
        );
      }
    }
  };
}