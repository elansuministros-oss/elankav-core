import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMaterialResolutionRequirement,
  resolveRegisteredProviderMaterials,
} from "../lib/elan-sales-engine/index.js";

function context(productId, message = "") {
  return {
    normalized: {
      chatId: "50588889999@c.us",
      from: "50588889999@c.us",
      messageId: "msg-material-test",
      body: message,
    },
    productResult: {
      detected: true,
      primaryProduct: {
        id: productId,
        serviceName: productId,
      },
    },
    memory: {
      measure: "60 cm",
      placement: "exterior",
      logoStatus: "tiene",
      photoReceived: true,
    },
    now: new Date("2026-07-06T12:00:00.000Z"),
  };
}

test("prepara requerimiento para boton luminoso sin inventar proveedor ni precio", () => {
  const requirement = buildMaterialResolutionRequirement(context("boton-luminoso", "Quiero un boton luminoso"));

  assert.equal(requirement.version, "ELAN_SALES_ECE_AI23_REQUIREMENT_V1");
  assert.equal(requirement.target, "ECE_AI23");
  assert.equal(requirement.producto.nombre, "boton luminoso");
  assert.deepEqual(
    requirement.materiales.map((item) => item.nombre),
    ["acrilico", "PVC", "vinil", "LED", "estructura"]
  );
  assert.ok(requirement.tecnologia.some((item) => item.nombre === "iluminacion"));
  assert.equal(requirement.estadoGeneral, "pendiente_validacion_ece_ai23");
  assert.equal(requirement.materiales[0].proveedor.sugerido, null);
  assert.equal(requirement.materiales[0].precio.referenciaOperativa, null);
  assert.equal(requirement.pricingPolicy.finalCostOwner, "ECE_AI23");
});

test("prepara requerimiento para vinil impreso con tecnologia pendiente de catalogo", () => {
  const requirement = buildMaterialResolutionRequirement(context("vinil", "Quiero vinil impreso"));

  assert.equal(requirement.producto.nombre, "impresion vinil");
  assert.ok(requirement.materiales.some((item) => item.nombre === "vinil adhesivo"));
  assert.ok(requirement.tecnologia.some((item) => item.nombre === "ecosolvente"));
  assert.ok(requirement.tecnologia.some((item) => item.nombre === "UV"));
  assert.equal(requirement.estadoGeneral, "pendiente_validacion_ece_ai23");
});

test("marca multi-proveedor y usa mediana operativa con tres proveedores registrados", () => {
  const requirement = buildMaterialResolutionRequirement(context("vinil", "Quiero vinil impreso"));
  const resolved = resolveRegisteredProviderMaterials(requirement, [
    { id: "a", nombre: "Vinil adhesivo blanco", proveedor_nombre: "Proveedor A", precio: 10, moneda: "USD" },
    { id: "b", nombre: "Vinil adhesivo blanco", proveedor_nombre: "Proveedor B", precio: 30, moneda: "USD" },
    { id: "c", nombre: "Vinil adhesivo blanco", proveedor_nombre: "Proveedor C", precio: 20, moneda: "USD" },
    { id: "d", nombre: "Tinta ecosolvente", proveedor_nombre: "Proveedor A", precio: 40, moneda: "USD" },
    { id: "e", nombre: "Tinta ecosolvente", proveedor_nombre: "Proveedor B", precio: 44, moneda: "USD" },
    { id: "f", nombre: "Tinta ecosolvente", proveedor_nombre: "Proveedor C", precio: 42, moneda: "USD" },
  ]);

  const vinil = resolved.resolucion.find((item) => item.materialKey === "vinil-adhesivo");

  assert.equal(vinil.estado, "multi-proveedor");
  assert.equal(vinil.proveedor.cantidad, 3);
  assert.equal(vinil.proveedor.sugerido, null);
  assert.equal(vinil.precio.estado, "referencia_mediana_operativa");
  assert.equal(vinil.precio.referenciaOperativa, 20);
  assert.match(vinil.precio.politica, /No es precio final/);
});

test("marca pendiente si falta precio aunque exista proveedor registrado", () => {
  const requirement = buildMaterialResolutionRequirement(context("boton-luminoso", "Quiero un boton luminoso"));
  const resolved = resolveRegisteredProviderMaterials(requirement, [
    { id: "a", nombre: "Acrilico transparente", proveedor_nombre: "Proveedor A", precio: 10, moneda: "USD" },
    { id: "b", nombre: "PVC espumado", proveedor_nombre: "Proveedor B", moneda: "USD" },
    { id: "c", nombre: "Vinil adhesivo", proveedor_nombre: "Proveedor C", precio: 8, moneda: "USD" },
    { id: "d", nombre: "Modulo LED", proveedor_nombre: "Proveedor D", precio: 2, moneda: "USD" },
  ]);

  const pvc = resolved.resolucion.find((item) => item.materialKey === "pvc");

  assert.equal(pvc.estado, "pendiente_validacion");
  assert.equal(pvc.precio.estado, "pendiente_validacion");
  assert.equal(resolved.estadoGeneral, "pendiente_validacion");
});
