import { AI23_ESTADOS, AI23_MONEDAS } from "./ai23.constants.js";
import { createAI23Repository } from "./ai23.repository.js";
import {
  assertPositiveNumber,
  fail,
  normalizeText,
  ok,
  requireId,
  requireObject
} from "./ai23.utils.js";

function normalizeCostoReferenciaInput(payload) {
  requireObject(payload, "costo_referencia");

  const nombre = normalizeText(payload.nombre);
  if (!nombre) throw new Error("AI23_COSTO_REFERENCIA_NOMBRE_REQUERIDO");

  const moneda = normalizeText(payload.moneda || AI23_MONEDAS.USD).toUpperCase();
  if (!Object.values(AI23_MONEDAS).includes(moneda)) {
    throw new Error("AI23_COSTO_REFERENCIA_MONEDA_INVALIDA");
  }

  const costo = assertPositiveNumber(
    payload.costo ?? payload.valor ?? payload.costo_unitario ?? payload.costoUnitario,
    "costo"
  );

  const estado = normalizeText(payload.estado || AI23_ESTADOS.activo);
  if (!Object.values(AI23_ESTADOS).includes(estado)) {
    throw new Error("AI23_COSTO_REFERENCIA_ESTADO_INVALIDO");
  }

  return {
    codigo: normalizeText(payload.codigo) || null,
    nombre,
    descripcion: normalizeText(payload.descripcion) || null,
    categoria: normalizeText(payload.categoria) || null,
    unidad: normalizeText(payload.unidad) || null,
    moneda,
    costo,
    proveedor_id: normalizeText(payload.proveedor_id ?? payload.proveedorId) || null,
    item_origen_id: normalizeText(payload.item_origen_id ?? payload.itemOrigenId) || null,
    estado
  };
}

export function createAI23CostosReferenciaService(
  repository = createAI23Repository()
) {
  return {
    async listar(filtros = {}, opciones = {}) {
      try {
        const { data, error } = await repository.costosReferencia.list(filtros, {
          orderBy: opciones.orderBy || "nombre",
          ascending: opciones.ascending !== false,
          limit: opciones.limit
        });

        if (error) {
          return fail("AI23_COSTOS_REFERENCIA_LIST_ERROR", error.message, error);
        }

        return ok(data || []);
      } catch (error) {
        return fail("AI23_COSTOS_REFERENCIA_LIST_EXCEPTION", error.message, error);
      }
    },

    async obtenerPorId(id) {
      try {
        requireId(id, "costo_referencia_id");

        const { data, error } = await repository.costosReferencia.getById(id);

        if (error) {
          return fail("AI23_COSTO_REFERENCIA_GET_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail("AI23_COSTO_REFERENCIA_GET_EXCEPTION", error.message, error);
      }
    },

    async crear(payload) {
      try {
        const input = normalizeCostoReferenciaInput(payload);
        const { data, error } = await repository.costosReferencia.create(input);

        if (error) {
          return fail("AI23_COSTO_REFERENCIA_CREATE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail("AI23_COSTO_REFERENCIA_CREATE_EXCEPTION", error.message, error);
      }
    },

    async actualizar(id, payload) {
      try {
        requireId(id, "costo_referencia_id");
        const input = normalizeCostoReferenciaInput(payload);

        const { data, error } = await repository.costosReferencia.update(id, input);

        if (error) {
          return fail("AI23_COSTO_REFERENCIA_UPDATE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail("AI23_COSTO_REFERENCIA_UPDATE_EXCEPTION", error.message, error);
      }
    },

    async eliminar(id) {
      try {
        requireId(id, "costo_referencia_id");

        const { data, error } = await repository.costosReferencia.remove(id);

        if (error) {
          return fail("AI23_COSTO_REFERENCIA_DELETE_ERROR", error.message, error);
        }

        return ok(data);
      } catch (error) {
        return fail("AI23_COSTO_REFERENCIA_DELETE_EXCEPTION", error.message, error);
      }
    }
  };
}