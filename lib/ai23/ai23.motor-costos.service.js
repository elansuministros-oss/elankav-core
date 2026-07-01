import { AI23_MONEDAS } from "./ai23.constants.js";
import { createAI23Repository } from "./ai23.repository.js";
import {
  fail,
  normalizeNumber,
  normalizeText,
  ok,
  requireId,
  requireObject
} from "./ai23.utils.js";

function normalizarMoneda(moneda) {
  const value = normalizeText(moneda || AI23_MONEDAS.USD).toUpperCase();
  if (!Object.values(AI23_MONEDAS).includes(value)) {
    throw new Error("AI23_MONEDA_INVALIDA");
  }
  return value;
}

function calcularCostoComponente(item) {
  const cantidad = normalizeNumber(item.cantidad, 0);
  const costoUnitario = normalizeNumber(
    item.costo_unitario ?? item.costoUnitario ?? item.costo,
    0
  );
  const mermaPorcentaje = normalizeNumber(
    item.merma_porcentaje ?? item.mermaPorcentaje,
    0
  );
  const factorMerma = normalizeNumber(item.factor_merma ?? item.factorMerma, 0);

  const costoBase = cantidad * costoUnitario;
  const costoMermaPorcentaje = costoBase * (mermaPorcentaje / 100);
  const costoFactorMerma = costoBase * factorMerma;

  return {
    ...item,
    cantidad,
    costo_unitario: costoUnitario,
    merma_porcentaje: mermaPorcentaje,
    factor_merma: factorMerma,
    subtotal: costoBase + costoMermaPorcentaje + costoFactorMerma
  };
}

function calcularAdicional(item) {
  const cantidad = normalizeNumber(item.cantidad, 1);
  const precio = normalizeNumber(
    item.precio ?? item.precio_unitario ?? item.precioUnitario,
    0
  );

  return {
    ...item,
    cantidad,
    precio,
    subtotal: cantidad * precio
  };
}

function calcularTotales({
  componentes = [],
  adicionales = [],
  manoObra = 0,
  indirectos = 0,
  margenPorcentaje = 0,
  moneda = AI23_MONEDAS.USD,
  tipoCambio = null
}) {
  const monedaNormalizada = normalizarMoneda(moneda);

  const componentesCalculados = componentes.map(calcularCostoComponente);
  const adicionalesCalculados = adicionales.map(calcularAdicional);

  const costoComponentes = componentesCalculados.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  const costoAdicionales = adicionalesCalculados.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  const manoObraNormalizada = normalizeNumber(manoObra, 0);
  const indirectosNormalizados = normalizeNumber(indirectos, 0);
  const margenNormalizado = normalizeNumber(margenPorcentaje, 0);

  const costoBase =
    costoComponentes +
    costoAdicionales +
    manoObraNormalizada +
    indirectosNormalizados;

  const margenValor = costoBase * (margenNormalizado / 100);
  const total = costoBase + margenValor;

  const tasaCambio = tipoCambio === null ? null : normalizeNumber(tipoCambio, 0);

  const totalUsd =
    monedaNormalizada === AI23_MONEDAS.USD
      ? total
      : tasaCambio > 0
        ? total / tasaCambio
        : null;

  const totalNio =
    monedaNormalizada === AI23_MONEDAS.NIO
      ? total
      : tasaCambio > 0
        ? total * tasaCambio
        : null;

  return {
    moneda: monedaNormalizada,
    tipo_cambio: tasaCambio,
    componentes: componentesCalculados,
    adicionales: adicionalesCalculados,
    resumen: {
      costo_componentes: costoComponentes,
      costo_adicionales: costoAdicionales,
      mano_obra: manoObraNormalizada,
      indirectos: indirectosNormalizados,
      costo_base: costoBase,
      margen_porcentaje: margenNormalizado,
      margen_valor: margenValor,
      total,
      total_usd: totalUsd,
      total_nio: totalNio
    }
  };
}

export function createAI23MotorCostosService(
  repository = createAI23Repository()
) {
  return {
    calcularManual(payload) {
      try {
        requireObject(payload, "calculo");

        const resultado = calcularTotales({
          componentes: Array.isArray(payload.componentes)
            ? payload.componentes
            : [],
          adicionales: Array.isArray(payload.adicionales)
            ? payload.adicionales
            : [],
          manoObra: payload.mano_obra ?? payload.manoObra,
          indirectos: payload.indirectos,
          margenPorcentaje:
            payload.margen_porcentaje ?? payload.margenPorcentaje,
          moneda: payload.moneda,
          tipoCambio: payload.tipo_cambio ?? payload.tipoCambio
        });

        return ok(resultado);
      } catch (error) {
        return fail("AI23_CALCULO_MANUAL_EXCEPTION", error.message, error);
      }
    },

    async calcularCombinacion(payload) {
      try {
        requireObject(payload, "calculo_combinacion");

        const combinacionId = normalizeText(
          payload.combinacion_id ?? payload.combinacionId
        );
        requireId(combinacionId, "combinacion_id");

        const { data: combinacion, error: combinacionError } =
          await repository.combinaciones.getById(combinacionId);

        if (combinacionError) {
          return fail(
            "AI23_CALCULO_COMBINACION_GET_ERROR",
            combinacionError.message,
            combinacionError
          );
        }

        const { data: relaciones, error: relacionesError } =
          await repository.combinacionComponentes.list({
            combinacion_id: combinacionId
          });

        if (relacionesError) {
          return fail(
            "AI23_CALCULO_COMBINACION_COMPONENTES_ERROR",
            relacionesError.message,
            relacionesError
          );
        }

        const componentes = [];

        for (const relacion of relaciones || []) {
          const componenteId = normalizeText(relacion.componente_id);

          if (!componenteId) continue;

          const { data: componente, error: componenteError } =
            await repository.componentes.getById(componenteId);

          if (componenteError) {
            return fail(
              "AI23_CALCULO_COMPONENTE_GET_ERROR",
              componenteError.message,
              componenteError
            );
          }

          componentes.push({
            ...componente,
            cantidad: relacion.cantidad,
            factor_merma: relacion.factor_merma
          });
        }

        const resultado = calcularTotales({
          componentes,
          adicionales: Array.isArray(payload.adicionales)
            ? payload.adicionales
            : [],
          manoObra: combinacion?.mano_obra,
          indirectos: combinacion?.indirectos,
          margenPorcentaje: combinacion?.margen_porcentaje,
          moneda: payload.moneda || componentes[0]?.moneda || AI23_MONEDAS.USD,
          tipoCambio: payload.tipo_cambio ?? payload.tipoCambio
        });

        return ok({
          combinacion,
          ...resultado
        });
      } catch (error) {
        return fail("AI23_CALCULO_COMBINACION_EXCEPTION", error.message, error);
      }
    }
  };
}
