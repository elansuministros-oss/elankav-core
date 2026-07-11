# CRM Core — Matriz de accesos

## Responsabilidad

Registrar identidades, aliases de canal, organizaciones, roles, conversaciones y mensajes del ecosistema ELANKAV.

## Fuente oficial

Supabase.

## Accesos permitidos

| Servicio | Lectura | Escritura | Motivo |
|---|:---:|:---:|---|
| Identity Service | Sí | Sí | Resolver y asociar aliases externos |
| WhatsApp Bridge | Sí | Sí | Registrar conversaciones y mensajes |
| Sales Engine | Sí | Sí | Leer estado comercial y actualizar etapa |
| Commercial Library | Sí | No | Consultar producto/servicio asociado |
| Pricing Engine | Sí | No | Consultar cálculos vinculados |
| Cotizador | Sí | Sí | Vincular cotizaciones a identidad/conversación |
| Pagos | Sí | Sí | Vincular transacciones y comprobantes |
| Producción | Sí | No | Consultar cliente, proyecto y origen |

## Accesos prohibidos por defecto

- Borrado físico automático de identidades.
- Escritura directa desde UI sin Adapter/Service.
- Uso de localStorage como fuente principal.
- Duplicar contactos por plataforma.
- Usar LID o teléfono como clave primaria del negocio.

## Flujo obligatorio

```text
Canal
↓
Identity Service
↓
CRM Core
↓
Clasificación de plataforma y rol
↓
Sales Engine / módulos especializados
```

## Regla multicanal

Una persona u organización puede tener múltiples aliases, roles y plataformas sin duplicar su identidad canónica.
