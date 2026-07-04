import { readEmcRecordsV2 } from "../lib/emc/record-reader-v2.js";

const muestraReal = `
LONA 13 ONZ 840X840 GLOSSY 1.02X50M USD 1,861
LONA 13 ONZ 840X840 GLOSSY 1.37X50M USD 2,666
LONA 13 ONZ 840X840 GLOSSY 1.60X50M USD 3,100
REGISTRO BASURA SIN PRECIO
`;

const resultado = readEmcRecordsV2(muestraReal, "PROVEEDOR_TEST");

console.log(JSON.stringify(resultado, null, 2));

const precios = resultado.registros.map((item) => item.precio);
const monedas = resultado.registros.map((item) => item.moneda);
const nombres = resultado.registros.map((item) => item.nombre);

if (resultado.validos !== 3) throw new Error("Debe detectar 3 válidos.");
if (resultado.rechazados !== 1) throw new Error("Debe rechazar 1 registro.");

if (precios[0] !== 1861) throw new Error("Precio 1 incorrecto.");
if (precios[1] !== 2666) throw new Error("Precio 2 incorrecto.");
if (precios[2] !== 3100) throw new Error("Precio 3 incorrecto.");

if (!monedas.every((m) => m === "USD")) throw new Error("Moneda incorrecta.");
if (!nombres.every((n) => n === "LONA 13 ONZ 840X840 GLOSSY")) {
  throw new Error("Nombre incorrecto.");
}

console.log("EMC Record Reader V2 VALIDACION DURA OK");
