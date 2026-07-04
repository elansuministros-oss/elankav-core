import { readEmcRecordsV2 } from "../lib/emc/record-reader-v2.js";

const muestraReal = `
VARGASFLEXPLUS LONA 13 ONZ 840X840 GLOSSY1.02X50M1,861.06C$
VARGASFLEXPLUS LONA 13 ONZ 840X840 GLOSSY1.37X50M2,666.29C$
VARGASFLEXPLUS LONA 13 ONZ 840X840 GLOSSY 1.60X50M3,280.00C$
LAMINA PVC 2MM 1.22X2.44 M231.87C$
LAMINA ACRILICO LECHOSO 3MM 1.22X2.44 M1,815.00C$
VINIL MICROPERFORADO 1.37X50 M4,165.56C$
MESA DESGUSTADORA PC-1UND1,922.36C$
CLORURO PEGAMENTO PARA ACRILICO MEDIO LT UND1,843.75C$
DESCRIPCIONMEDIDAPRECIO+IVA
`;

const resultado = readEmcRecordsV2(muestraReal, "VARGAS_TEST");

console.log(JSON.stringify(resultado, null, 2));

if (resultado.validos !== 8) throw new Error(`Debe detectar 8 válidos. Detectó ${resultado.validos}`);
if (resultado.rechazados !== 1) throw new Error(`Debe rechazar 1. Rechazó ${resultado.rechazados}`);

if (resultado.registros[0].precio !== 1861.06) throw new Error("Precio lona 1 incorrecto.");
if (resultado.registros[0].moneda !== "NIO") throw new Error("Moneda debe ser NIO.");
if (resultado.registros[0].presentacion !== "1.02X50M") throw new Error("Presentación lona incorrecta.");

console.log("EMC Record Reader V2 FORMATO REAL OK");
