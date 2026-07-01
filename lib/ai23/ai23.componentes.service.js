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

function normalizeComponenteInput(payload) {
  requireObject(payload, "componente");

  const nombre = normalizeText(payload.nombre);
  if (!nombre) throw new Error("AI23_COMPONENTE_NOMBRE_REQUERIDO");

  const unidad = normalizeText(payload.unidad);
  if (!unidad) throw new Error("AI23_COMPONENTE_UNIDAD_REQUERIDA");

  const moneda = normalizeText(payload.moneda || AI23_MONEDAS.USD).toUpperCase();
  if (!Object.values(AI23_MONEDAS).includes(moneda)) {
    throw new Error("AI23_COMPONENTE_MONEDA_INVALIDA");
  }

  const costoUnitario = assertPositiveNumber(
    payload.costo_unitario ?? payload.costoUnitario,
    "costo_unitario"
  );

  const estado = normalizeText(payload.estado || AI23_ESTADOS.activo);
  if (!Object.values(AI23_ESTADOS).includes(estado)) {
    throw new Error("AI23_COMPONENTE_ESTADO_INVALIDO");
  }

  return {
    codigo: normalizeText(payload.codigo) || null,
    nombre,
    descripcion: normalizeText(payload.descripcion) || null,
    categoria: normalizeText(payload.categoria) || null,
    unidad,
    moneda,
    costo_unitario: costoUnitario,
    merma_porcentaje: normalizeNumber(
      payload.merma_porcentaje ?? payload.mermaPorcentaje,
      0
    ),
    estado
  };
}

export function createAI23ComponentesService(repository = createAI23Repository()) {
  return {
    async listar(filtros = {}, opciones = {}) {
      try {
        const { data, error } = await repository.componentes.list(filtros, {
          orderBy: opciones.orderBy || "nombre",
          ascending: opciones.ascending !== false,
          limit: opciones.limit
        });

        if (error) return fail("AI23_COMPONENTES_LIST_ERROR", error.message, error);
        return ok(data || []);
      } catch (error) {
        return fail("AI23_COMPONENTES_LIST_EXCEPTION", error.message, error);
      }
    },

    async obtenerPorId(id) {
      try {
        requireId(id, "componente_id");

        const { data, error } = await repository.componentes.getById(id);

        if (error) return fail("AI23_COMPONENTE_GET_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMPONENTE_GET_EXCEPTION", error.message, error);
      }
    },

    async crear(payload) {
      try {
        const input = normalizeComponenteInput(payload);
        const { data, error } = await repository.componentes.create(input);

        if (error) return fail("AI23_COMPONENTE_CREATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMPONENTE_CREATE_EXCEPTION", error.message, error);
      }
    },

    async actualizar(id, payload) {
      try {
        requireId(id, "componente_id");
        const input = normalizeComponenteInput(payload);

        const { data, error } = await repository.componentes.update(id, input);

        if (error) return fail("AI23_COMPONENTE_UPDATE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMPONENTE_UPDATE_EXCEPTION", error.message, error);
      }
    },

    async eliminar(id) {
      try {
        requireId(id, "componente_id");

        const { data, error } = await repository.componentes.remove(id);

        if (error) return fail("AI23_COMPONENTE_DELETE_ERROR", error.message, error);
        return ok(data);
      } catch (error) {
        return fail("AI23_COMPONENTE_DELETE_EXCEPTION", error.message, error);
      }
    }
  };
}