# ECL — Matriz de accesos y dependencias

## Alcance

La ELANKAV Commercial Library es un servicio compartido del ecosistema. No pertenece exclusivamente a ELANVISUAL.

## Plataformas consumidoras previstas

- ELANVISUAL
- ELAN AI
- ELANHOME
- ELANCENTER
- ELANPET
- Plataformas futuras

Cada producto declara explícitamente qué plataformas pueden consumirlo.

## Dependencias permitidas

| Servicio | Lectura | Escritura | Estado inicial |
|---|---:|---:|---|
| Commercial Library | Sí | No | Activo |
| Pricing Engine | Sí | No | Implementado dentro del servicio piloto |
| Prompt Library | Sí | No | Activo |
| Identity Service | No | No | No conectado |
| CRM | No | No | No conectado |
| Inventario | No | No | No conectado |
| Producción | No | No | No conectado |
| Pagos | No | No | No conectado |
| Supabase | No | No | Pendiente de fase posterior |
| OpenAI | No | No | No conectado |
| WAHA | No | No | No conectado |

## Reglas obligatorias

1. La IA no puede inventar materiales, espesores, medidas, variantes ni precios.
2. Toda respuesta comercial debe consultar primero la Commercial Library.
3. Un producto no puede entrar en producción si su configuración no está validada.
4. Las cuentas bancarias y enlaces de pago nunca se guardan dentro de prompts.
5. Los accesos a CRM, inventario, producción y pagos se habilitan por adapters y servicios separados.
6. Las nuevas plataformas consumen el mismo contrato; no se duplican catálogos por interfaz.
7. La fuente oficial futura será Supabase; la configuración en código es bootstrap controlado.

## Estado ECL-001

Producto piloto activo: `boton-acrilico`.

La integración con Sales Engine, OpenAI y WhatsApp permanece deshabilitada hasta completar validación funcional.
