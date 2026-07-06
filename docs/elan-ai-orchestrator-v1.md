# ELAN AI Orchestrator V1

## Objetivo

ELAN AI deja de responder por plantillas rígidas y pasa a operar como orquestador comercial:

1. Normaliza el evento WAHA.
2. Resuelve `customerKey` por teléfono, WhatsApp ID, LID o sesión/chat.
3. Recupera memoria comercial del cliente.
4. Clasifica el mensaje: saludo, cotización, producto, medida, ubicación, precio, frustración, pregunta sobre IA, seguimiento, promociones o multimodal.
5. Resuelve unidad de negocio y producto.
6. Consulta catálogo público ELANVISUAL antes de pedir cotización personalizada.
7. Resuelve si puede mencionar precio publicado o si debe derivar a ECE/AI-23.
8. Prepara requerimiento de materiales/proveedores para ECE/AI-23 sin calcular precio final.
9. Aplica política comercial.
10. Genera respuesta con LLM si hay `OPENAI_API_KEY`; si falla o está desactivado, usa fallback contextual corto.

## Reglas comerciales

- No inventar precios.
- No discutir precios.
- No prometer descuentos.
- No preguntar datos ya capturados.
- Máximo una pregunta por mensaje.
- Máximo cinco líneas útiles por respuesta.
- Si el cliente pregunta si es IA, responder con transparencia.
- Si el cliente se frustra, disculparse brevemente y retomar el contexto.

## Catálogo y precios

El precio publicado se resuelve en `public-catalog-resolver.js`.

La base local documenta productos publicados de ELANVISUAL y puede ser reemplazada o extendida con:

```txt
ELANVISUAL_PUBLIC_CATALOG_JSON
```

El Sales Engine no calcula costos finales. Cuando no existe precio publicado seguro, el estado pasa a ECE/AI-23 para costo, margen, PDF y cotización.

## Memoria

La memoria comercial guarda:

- nombre
- teléfono
- WhatsApp ID
- LID
- producto
- medidas
- interior/exterior
- ubicación
- logo
- foto
- intención
- última pregunta
- datos pendientes
- historial resumido
- etapa comercial

## Integración

`processSalesConversation` sigue siendo la fachada pública usada por `api/whatsapp.js`, pero internamente delega en:

```txt
runElanAiSalesOrchestrator
```

Esto mantiene webhook, autorización, idempotencia y eventos únicos sin tocar WAHA, VPS, Docker, Nginx, AI-23, EMC ni ECE.
