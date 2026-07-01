import { AI23_ESTADOS, AI23_MONEDAS } from "./ai23.constants.js";
import { createAI23Repository } from "./ai23.repository.js";
import {
  assertPositiveNumber,
  fail,
  normalizeNumber,
  normalizeText,
  ok,
  requireId,
  requireObject
} from "./ai23.utils.js";

function normalizeAdicionalInput(payload) {
  requireObject(payload, "adicional");

  const nombre = normalizeText(payload.nombre);
  if (!nombre) throw new Error("AI23_ADICIONAL_NOMBRE_REQUERIDO");

  const moneda = normalizeText(payload.moneda || AI23_MONEDAS.USD).toUpperCase();
  if (!Object.values(AI23_MONEDAS).includes(moneda)) {
    throw new Error("AI23_ADICIONAL_MONEDA_INVALIDA");
  }

  const precio = assertPositiveNumber(
    payload.precio ?? payload.precio_unitario ?? payload.precioUnitario,
    "precio"
  );

  const estado = normalizeText(payload.estado || AI23_ESTADOS.activo);
  if (!Object.values(AI23_ESTADOS).includes(estado)) {
    throw new Error("AI23_ADICIONAL_ESTADO_INVALIDO");
  }

  return {
    codigo: normalizeText(payload.codigo) || null,
    nombre,
    descripcion: normalizeText(payload.descripcion) || null,
    categoria: normalizeText(payload.categoria) || null,
    unidad: normalizeText(payload.unidad) || null,
    moneda,
    precio,
    costo_referencia: normalizeNumber(
      payload.costo_referencia ?? payload.costoReferencia,
      0
    ),
    margen_porcentaje: normalizeNumber(
      payload.margen_porcentaje ?? payload.margenPorcentaje,
      0
    ),
    estado
  };
}

export function createAI23AdicionalesService(repository = createAI23Repository()) {
  return {
    async listar(filtros = {}, opciones = {}) {
      try {
        const { data, error } = await repository.adicionales.list(filtros, {
          orderBy: opciones.orderBy || "nombre",
          ascending: opciones.ascending !== false,
          limit: opciones.limit
        });

        if (error) return fail("AI23_ADICIONALES_LIST_ERROR", error.message, error);
        return ok(data || []);
      } catch (error) {
        return fail("AI23_ADICIONALES_LIST_EXCEPTION", error.message, error);
      }
    },

    async obtenerPorId(id) {
      try {
        requireId(id, "adicional_id");

        const { data, error } = await repository.adicionales.getById(id);

        if (error) return fail("AI23_ADICIONAL_GET_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_ADICIONAL_GET_EXCEPTION", error.message, error);
      }
    },

    async crear(payload) {
      try {
        const input = normalizeAdicionalInput(payload);
        const { data, error } = await repository.adicionales.create(input);

        if (error) return fail("AI23_ADICIONAL_CREATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_ADICIONAL_CREATE_EXCEPTION", error.message, error);
      }
    },

    async actualizar(id, payload) {
      try {
        requireId(id, "adicional_id");
        const input = normalizeAdicionalInput(payload);

        const { data, error } = await repository.adicionales.update(id, input);

        if (error) return fail("AI23_ADICIONAL_UPDATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_ADICIONAL_UPDATE_EXCEPTION", error.message, error);
      }
    },

    async eliminar(id) {
      try {
        requireId(id, "adicional_id");

        const { data, error } = await repository.adicionales.remove(id);

        if (error) return fail("AI23_ADICIONAL_DELETE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_ADICIONAL_DELETE_EXCEPTION", error.message, error);
      }
    }
  };
}