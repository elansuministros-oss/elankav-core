# ELANKAV CRM Frontend Standalone

## Rama oficial de distribución

```text
release/CRM-FRONTEND-STANDALONE
```

Esta rama contiene el CRM profesional validado visualmente y está preparada para importarse como un proyecto Vercel independiente.

## Arquitectura temporal

```text
CRM Frontend independiente
        ↓
/api/auth local
        ↓
/api/crm proxy
        ↓
https://elankav-core.vercel.app/api/crm
```

## Protección

- No desplegar esta rama como Production dentro del proyecto Vercel actual `elankav-core`.
- Importarla en un proyecto Vercel nuevo y separado.
- No modificar el backend actual durante esta fase.
- No modificar Supabase ni RLS.
- No integrar esta rama en `main` mientras mantenga el proxy al backend de producción.

## Configuración Vercel requerida

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Production Branch: release/CRM-FRONTEND-STANDALONE
```

La configuración versionada conserva únicamente `api/auth.js` como función local y redirige `/api/crm` al backend estable del Core.

## Validación mínima posterior a la importación

1. Login disponible.
2. Dashboard profesional visible.
3. Estado CRM `Operativo`.
4. Identidades, conversaciones y mensajes con datos reales.
5. Ninguna modificación en `https://elankav-core.vercel.app`.
