-- AI-20 EMC Vision Import v2
-- Tablas de control de importaciones EMC

CREATE TABLE IF NOT EXISTS public.elankav_catalogo_importaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NULL,
  proveedor_nombre text NULL,
  archivo_nombre text NOT NULL,
  archivo_mime text NULL,
  storage_path text NULL,
  public_url text NULL,

  estado text NOT NULL DEFAULT 'PENDIENTE',
  total_paginas integer NOT NULL DEFAULT 0,
  pagina_actual integer NOT NULL DEFAULT 0,

  productos_detectados integer NOT NULL DEFAULT 0,
  productos_guardados integer NOT NULL DEFAULT 0,
  productos_error integer NOT NULL DEFAULT 0,

  progreso_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  mensaje_estado text NOT NULL DEFAULT 'Importación creada',
  tiempo_estimado_segundos integer NULL,

  iniciado_at timestamptz NULL,
  finalizado_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT elankav_catalogo_importaciones_estado_check
  CHECK (estado IN ('PENDIENTE','PROCESANDO','PAUSADO','COMPLETADO','ERROR','CANCELADO'))
);

CREATE TABLE IF NOT EXISTS public.elankav_catalogo_importacion_paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id uuid NOT NULL REFERENCES public.elankav_catalogo_importaciones(id) ON DELETE CASCADE,

  numero_pagina integer NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE',

  productos_detectados integer NOT NULL DEFAULT 0,
  productos_guardados integer NOT NULL DEFAULT 0,
  productos_error integer NOT NULL DEFAULT 0,

  mensaje_estado text NULL,
  intentos integer NOT NULL DEFAULT 0,
  error_mensaje text NULL,

  raw_vision jsonb NULL,
  items_detectados jsonb NULL,

  iniciado_at timestamptz NULL,
  finalizado_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT elankav_catalogo_importacion_paginas_estado_check
  CHECK (estado IN ('PENDIENTE','PROCESANDO','COMPLETADO','ERROR','OMITIDA'))
);

CREATE INDEX IF NOT EXISTS idx_emc_importaciones_estado
ON public.elankav_catalogo_importaciones(estado);

CREATE INDEX IF NOT EXISTS idx_emc_importacion_paginas_importacion
ON public.elankav_catalogo_importacion_paginas(importacion_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emc_importacion_pagina
ON public.elankav_catalogo_importacion_paginas(importacion_id, numero_pagina);
