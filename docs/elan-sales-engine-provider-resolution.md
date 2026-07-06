# ELAN AI Sales Engine - Provider / Material Resolution

## Objetivo

ELAN AI no calcula costos, no inventa materiales y no escoge proveedores al azar.
Su responsabilidad es preparar un requerimiento comercial-tecnico para que ECE/AI-23
resuelva materiales reales desde EMC, catalogo y proveedores registrados.

## Flujo

1. WhatsApp recibe la conversacion del cliente.
2. ELAN AI detecta producto, medida, interior/exterior, logo y foto.
3. Sales Engine crea `materialResolution` con contrato
   `ELAN_SALES_ECE_AI23_REQUIREMENT_V1`.
4. ECE/AI-23 recibe ese requerimiento y busca materiales reales en EMC/catalogo.
5. ECE/AI-23 decide costos, precio, PDF y cotizacion.

## Contrato enviado por Sales Engine

El contrato se expone en `salesEngine.analysis.materialResolution` y tambien se resume
en el lead mediante `servicio_solicitado`. Si la tabla de leads soporta campos tecnicos,
el servicio intenta guardar:

- `producto_detectado`
- `material_probable`
- `tecnologia_probable`
- `estado_materiales`
- `requerimiento_ece_ai23`

Si esas columnas no existen, el guardado cae automaticamente al esquema base sin romper
el webhook.

## Reglas de resolucion

- Todo proveedor debe venir registrado en catalogo/EMC.
- Si hay varios proveedores para un material, el estado es `multi-proveedor`.
- Si hay 3 o mas proveedores con precio valido, se calcula una mediana operativa.
- Esa mediana no es precio final.
- Si falta material, proveedor o precio, el estado queda `pendiente_validacion`.
- ELAN AI nunca usa automaticamente el precio mas bajo ni el mas alto.
- ECE/AI-23 es el unico responsable del costo final, precio, PDF y cotizacion.

## Casos base

### Boton luminoso

Sales Engine prepara:

- producto: boton luminoso
- materiales probables: acrilico, PVC, vinil, LED, estructura
- tecnologia: rotulacion / iluminacion
- estado: pendiente_validacion_ece_ai23

### Vinil impreso

Sales Engine prepara:

- producto: impresion vinil
- material: vinil adhesivo
- tecnologia: ecosolvente / UV / segun catalogo
- estado: pendiente_validacion_ece_ai23

## Limite de responsabilidad

Sales Engine mantiene limpia la conversacion comercial. No consulta precios durante la
conversacion inicial y no genera cotizaciones finales. Solo deja el requerimiento listo
para la capa tecnica ECE/AI-23.
