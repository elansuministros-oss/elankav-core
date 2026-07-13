# ELANKAV Core

ELANKAV Core contiene servicios comerciales, CRM, integración con WhatsApp y componentes operativos del ecosistema ELANKAV.

## Arquitectura general

```text
WAHA
→ ELANKAV Core
→ ELANKAV Orchestrator
→ Business Engine
→ CRM / Knowledge / EMC / AI-23 / ERP
→ respuesta textual
→ WAHA
```

ELANKAV Core funciona como puente entre los canales externos y los servicios internos autorizados.

## WhatsApp Identity Bridge

El webhook productivo de WhatsApp está implementado mediante:

```text
/api/whatsapp
→ vercel.json
→ /api/whatsapp-v2
```

Archivo principal:

```text
api/whatsapp-v2.js
```

### Flujo actual

```text
WAHA
→ webhook de ELANKAV Core
→ normalización del mensaje
→ resolución de identidad
→ ELANKAV Orchestrator
→ Business Engine
→ respuesta textual
→ WAHA sendText
```

El webhook actual:

- acepta eventos `message`;
- ignora `message.any`;
- ignora mensajes enviados por la propia cuenta;
- ignora grupos y estados;
- normaliza identidad y teléfono;
- procesa mensajes de texto;
- consulta ELANKAV Orchestrator;
- envía respuestas mediante WAHA;
- no procesa todavía audio, imágenes ni video.

## MM-001 — ELAN IA Multimodal

La ruta multimodal permite incorporar audio, voz, imágenes, video y conversación en tiempo real sin crear un segundo cerebro conversacional.

Cada capacidad debe respetar:

```text
Channel Adapter
→ Media Intake Adapter
→ Media Service
→ evento normalizado
→ Business Engine
→ respuesta autorizada
→ auditoría
```

WAHA no ejecutará razonamiento ni se conectará directamente con OpenAI.

## AUD-001A — Ingreso seguro de notas de voz

### Objetivo

Incorporar detección, validación y normalización inicial de notas de voz recibidas desde WAHA, sin transcribirlas todavía y sin alterar el flujo textual existente.

### Alcance autorizado

AUD-001A debe:

- detectar mensajes de audio o notas de voz;
- extraer metadatos disponibles en el payload de WAHA;
- validar sesión, remitente, chat, MIME y referencia multimedia;
- rechazar medios incompletos o no autorizados;
- mantener intacto el procesamiento actual de mensajes de texto;
- producir un resultado normalizado de ingreso de audio;
- registrar estados técnicos sin exponer contenido binario ni secretos;
- degradar de forma segura cuando el audio no pueda procesarse.

AUD-001A no debe:

- transcribir audio;
- llamar a OpenAI;
- responder mediante voz;
- almacenar audio dentro de Git;
- usar `localStorage`;
- acceder directamente al volumen Docker `/app/.media` desde Vercel;
- modificar Owner Mode;
- procesar grupos, estados o mensajes enviados por la propia cuenta;
- cambiar la lógica comercial del Orchestrator.

## Arquitectura de AUD-001A

```text
WAHA
→ api/whatsapp-v2.js
→ detector de tipo de mensaje
→ Audio Intake Adapter
→ Audio Intake Service
→ evento multimedia normalizado
→ resultado técnico AUD-001A
```

### Responsabilidad del Adapter

El Audio Intake Adapter debe:

- interpretar el payload externo de WAHA;
- detectar audio y nota de voz;
- extraer referencias multimedia;
- normalizar campos externos;
- no aplicar lógica comercial;
- no llamar a OpenAI;
- no escribir en producción.

### Responsabilidad del Service

El Audio Intake Service debe:

- validar tipo MIME;
- validar tamaño;
- validar duración;
- validar referencia multimedia;
- aplicar límites configurables;
- producir estados normalizados;
- impedir duplicados;
- preservar compatibilidad con texto.

## Contrato inicial de audio

El evento normalizado debe contemplar:

```text
event
session
messageId
senderRaw
phone
chatId
fromMe
isGroup
isBroadcast
mediaType
mimeType
fileName
mediaUrl
mediaReference
durationSeconds
sizeBytes
isVoiceNote
source
receivedAt
```

Los campos ausentes deben permanecer como `null`.

No se inventarán valores.

## Estados previstos

```text
AUDIO_ACCEPTED
AUDIO_METADATA_INCOMPLETE
AUDIO_TYPE_NOT_ALLOWED
AUDIO_SIZE_EXCEEDED
AUDIO_DURATION_EXCEEDED
AUDIO_REFERENCE_MISSING
AUDIO_DUPLICATE
AUDIO_IGNORED
```

## Variables configurables previstas

```text
WAHA_AUDIO_MAX_BYTES
WAHA_AUDIO_MAX_DURATION_SECONDS
WAHA_AUDIO_ALLOWED_MIME_TYPES
WAHA_MEDIA_TEMP_RETENTION_SECONDS
```

Los valores por defecto deben definirse durante la implementación y quedar cubiertos por pruebas.

## Compatibilidad obligatoria

El flujo textual existente debe continuar funcionando sin cambios:

```text
mensaje de texto
→ resolución de identidad
→ Orchestrator
→ respuesta
→ WAHA sendText
```

Un fallo de audio no debe bloquear ni degradar los mensajes de texto.

## Seguridad

AUD-001A debe cumplir:

- no exponer claves de WAHA;
- no registrar URLs firmadas completas;
- no registrar contenido binario;
- no almacenar audio en Git;
- no procesar grupos ni broadcasts;
- no aceptar rutas arbitrarias;
- no aceptar MIME no autorizado;
- no confiar únicamente en extensiones de archivo;
- no permitir acceso directo al volumen Docker de WAHA desde Vercel;
- mantener separación Adapter → Service → webhook.

## Pruebas mínimas

AUD-001A debe cubrir:

- mensaje de texto válido;
- audio válido;
- nota de voz válida;
- evento `message.any` ignorado;
- mensaje propio ignorado;
- grupo ignorado;
- broadcast ignorado;
- audio sin MIME;
- MIME no autorizado;
- audio sin referencia;
- tamaño excedido;
- duración excedida;
- payload incompleto;
- audio duplicado;
- ausencia de secretos o contenido binario en respuestas y logs.

## Línea base conocida

Al iniciar AUD-001A:

- `npm run build`: correcto;
- pruebas de Commercial Library: `5/5 PASS`;
- suite general: `11/12 PASS`;
- existe un fallo preexistente y ajeno a AUD-001A en `test/crm-domain.test.js`;
- la prueba afectada es `valida cliente por plataforma`;
- el repositorio estaba limpio antes de iniciar la rama;
- la rama de trabajo es `aud-001a-audio-intake`.

El fallo CRM no debe mezclarse con la implementación de audio.

Debe resolverse mediante un movimiento independiente antes del cierre técnico definitivo.

## Orden obligatorio de ejecución

1. Documentar AUD-001A.
2. Guardar la documentación en GitHub.
3. Capturar un payload real de nota de voz.
4. Crear Audio Intake Adapter.
5. Crear Audio Intake Service.
6. Integrar mínimamente `api/whatsapp-v2.js`.
7. Agregar pruebas positivas, negativas y de límites.
8. Ejecutar build.
9. Ejecutar pruebas.
10. Validar regresión textual.
11. Commit.
12. Push.
13. Pull Request.
14. Merge.
15. Actualizar Línea Base.
16. Cerrar AUD-001A.

## Siguientes movimientos

```text
AUD-001A  Ingreso seguro de audio
STT-001A  Transcripción
STT-001B  Integración con Business Engine
TTS-001A  Generación de voz
TTS-001B  Envío de audio por WhatsApp
VIS-001A  Ingreso seguro de imágenes
VIS-001B  Análisis técnico de imágenes
VID-001A  Ingreso y muestreo de video
VID-001B  Análisis de recorridos
RTC-001A  Sesión de voz autorizada
RTC-001B  Voz en tiempo real
```

---

## VOICE-HOTFIX-002 — Respuesta exclusiva de WhatsApp

**Estado:** Implementado y desplegado  
**Fecha de cierre:** 2026-07-13 00:13 UTC  
**PR:** #14  
**Commit productivo:** 2423ae9c1200dad9e2d468a75090c02f868efddf

### Problema

Cuando ELAN IA recibía una nota de voz, el webhook enviaba dos respuestas para la misma interacción:

1. `POST /api/sendText`
2. `POST /api/sendVoice`

La correlación fue verificada en los registros de WAHA y Nginx Proxy Manager.

### Causa raíz

`api/whatsapp-v2.js` ejecutaba primero `sendWahaText()` y después `deliverVoiceResponse()` cuando TTS estaba habilitado.

### Solución

El flujo de salida quedó mutuamente exclusivo:

- TTS habilitado y correcto: solo audio.
- TTS deshabilitado: solo texto.
- Error de generación o envío de voz: texto como respaldo.
- Nunca texto y audio para la misma respuesta.

### Ruta productiva verificada

```text
WhatsApp
  → WAHA
  → https://elankav-core.vercel.app/api/whatsapp
  → rewrite /api/whatsapp-v2
  → api/whatsapp-v2.js
```

### Validación

- Sintaxis de Node: OK.
- Suite automatizada: OK.
- Despliegue Vercel: success.
- Pendiente final: prueba real desde WhatsApp y confirmación visual de una sola salida.

---

## VOICE-HOTFIX-002 — Respuesta exclusiva de WhatsApp

**Estado:** Implementado y desplegado  
**Fecha de cierre:** 2026-07-13 00:14 UTC  
**PR:** #14  
**Commit productivo:** eb5cc729a087e0fe4ab68f14efa7ddc9ca94cc43

### Problema

Cuando ELAN IA recibía una nota de voz, el webhook enviaba dos respuestas para la misma interacción:

1. `POST /api/sendText`
2. `POST /api/sendVoice`

La correlación fue verificada en los registros de WAHA y Nginx Proxy Manager.

### Causa raíz

`api/whatsapp-v2.js` ejecutaba primero `sendWahaText()` y después `deliverVoiceResponse()` cuando TTS estaba habilitado.

### Solución

El flujo de salida quedó mutuamente exclusivo:

- TTS habilitado y correcto: solo audio.
- TTS deshabilitado: solo texto.
- Error de generación o envío de voz: texto como respaldo.
- Nunca texto y audio para la misma respuesta.

### Ruta productiva verificada

```text
WhatsApp
  → WAHA
  → https://elankav-core.vercel.app/api/whatsapp
  → rewrite /api/whatsapp-v2
  → api/whatsapp-v2.js
```

### Validación

- Sintaxis de Node: OK.
- Suite automatizada: OK.
- Despliegue Vercel: success.
- Pendiente final: prueba real desde WhatsApp y confirmación visual de una sola salida.
