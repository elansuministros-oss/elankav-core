begin;

create table if not exists public.commercial_products (
  product_id text primary key,
  platform_id text not null default 'elanvisual',
  version text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  name text not null,
  description text not null,
  aliases jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '{}'::jsonb,
  price_offers jsonb not null default '[]'::jsonb,
  sales_guidance jsonb not null default '{}'::jsonb,
  commercial_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_products_aliases_array
    check (jsonb_typeof(aliases) = 'array'),
  constraint commercial_products_price_offers_array
    check (jsonb_typeof(price_offers) = 'array')
);

alter table public.commercial_products enable row level security;
revoke all on table public.commercial_products from anon, authenticated;
grant select on table public.commercial_products to service_role;

insert into public.commercial_products (
  product_id,
  version,
  name,
  description,
  aliases,
  specifications,
  price_offers,
  sales_guidance,
  commercial_rules
)
values
(
  'boton-acrilico',
  'ECL-001A',
  'Rótulo estilo botón en acrílico',
  'Rótulo circular o cuadrado de proporción 1:1 en acrílico transparente de 3 mm.',
  '["rotulo estilo boton","rótulo estilo botón","rotulo boton","rótulo botón","boton acrilico","botón acrílico"]'::jsonb,
  '{"baseCm":60,"maxStandardCm":120,"stepCm":10,"incrementAmountUsd":20,"primaryMaterial":"acrílico transparente","thicknessMm":3}'::jsonb,
  '[{"id":"boton-transparente","label":"Botón Transparente 60 cm","amount":100,"currency":"USD","mode":"reference","approximate":false},{"id":"boton-con-impresion","label":"Botón con Impresión 60 cm","amount":130,"currency":"USD","mode":"reference","approximate":false},{"id":"boton-impresion-uv-premium","label":"Botón Impresión UV Premium 60 cm","amount":150,"currency":"USD","mode":"reference","approximate":false},{"id":"boton-premium-combinado","label":"Botón Premium Combinado 60 cm","amount":190,"currency":"USD","mode":"reference","approximate":false}]'::jsonb,
  '{"qualificationQuestion":"¿Qué acabado te interesa para tu rótulo botón?","closingAction":"request-logo-or-installation-photo"}'::jsonb,
  '{"priceIsApproximate":false,"finalQuoteRequiresValidation":true,"paymentAdvancePercent":60,"paymentBalancePercent":40,"maxQuestionsPerReply":1}'::jsonb
),
(
  'rotulo-jala-vista',
  'SALES-01A',
  'Rótulo jala vista',
  'Rótulo exterior perpendicular a la fachada, visible en ambos sentidos y fabricable con la forma del logotipo.',
  '["jala vista","jalavista","rotulo doble cara","rótulo doble cara","banderola"]'::jsonb,
  '{"baseWidthCm":60,"baseHeightCm":60,"faces":2,"customLogoShape":true}'::jsonb,
  '[{"id":"doble-cara-60x60","label":"Doble cara 60 × 60 cm","amount":260,"currency":"USD","mode":"reference","approximate":true}]'::jsonb,
  '{"firstReply":"El rótulo jala vista doble cara de 60 × 60 cm tiene un precio aproximado de USD 260 y puede fabricarse con la forma de tu logo.","qualificationQuestion":"¿Ya tenés el logo que querés utilizar?","closingAction":"request-logo-or-installation-photo"}'::jsonb,
  '{"priceIsApproximate":true,"finalQuoteRequiresValidation":true,"paymentAdvancePercent":60,"paymentBalancePercent":40,"maxQuestionsPerReply":1}'::jsonb
),
(
  'rotulo-cajuela',
  'SALES-01B',
  'Rótulo de cajuela',
  'Rótulo luminoso de una cara con silueta personalizada basada en el logotipo, composición por capas en relieve y luz integrada al frente o al contorno según el diseño.',
  '["rotulo de cajuela","rótulo de cajuela","rotulo cajuela","rótulo cajuela","cajuela","caja de luz","rotulo una cara","rótulo una cara"]'::jsonb,
  '{"minimumWidthCm":120,"minimumHeightCm":120,"faces":1,"customLogoSilhouette":true,"layeredRelief":true,"integratedLighting":true,"lightingPlacement":"front-or-contour-according-to-design","materialRequiresValidation":true}'::jsonb,
  '[{"id":"interior-desde-120x120","label":"Interior, una cara, silueta personalizada y luz, desde 1.20 × 1.20 m","environment":"interior","amount":360,"currency":"USD","mode":"starting-at","approximate":true},{"id":"exterior-desde-120x120","label":"Exterior, una cara, silueta personalizada y luz, desde 1.20 × 1.20 m","environment":"exterior","amount":560,"currency":"USD","mode":"starting-at","approximate":true}]'::jsonb,
  '{"firstReply":"El rótulo de cajuela es de una cara, con la silueta personalizada de tu logo, capas en relieve y luz integrada. Desde 1.20 × 1.20 m inicia aproximadamente en USD 360 para interior y USD 560 para exterior.","qualificationQuestion":"¿Lo necesitás para interior o para exterior?","closingAction":"request-logo-size-and-installation-photo"}'::jsonb,
  '{"priceIsApproximate":true,"finalQuoteRequiresValidation":true,"paymentAdvancePercent":60,"paymentBalancePercent":40,"maxQuestionsPerReply":1}'::jsonb
),
(
  'fascia-pvc-3d',
  'SALES-01C',
  'Fascia con letras PVC 3D',
  'Fascia comercial con letras tridimensionales en PVC, cotizada según dimensiones, diseño y condiciones del frente.',
  '["fascia pvc","fascia con letras pvc","letras pvc 3d","fachada pvc","letras 3d pvc"]'::jsonb,
  '{"letters":"PVC 3D","finalDimensionsRequired":true}'::jsonb,
  '[{"id":"fascia-pvc-desde","label":"Fascia con letras PVC 3D","amount":600,"currency":"USD","mode":"starting-at","approximate":true}]'::jsonb,
  '{"firstReply":"Las fascias con letras PVC 3D tienen un precio aproximado desde USD 600; el valor final depende del tamaño, diseño y condiciones del frente.","qualificationQuestion":"¿Qué ancho y alto aproximado tiene la fascia?","closingAction":"request-size-and-facade-photo"}'::jsonb,
  '{"priceIsApproximate":true,"finalQuoteRequiresValidation":true,"paymentAdvancePercent":60,"paymentBalancePercent":40,"maxQuestionsPerReply":1}'::jsonb
),
(
  'fachada-acm-luz',
  'SALES-01D',
  'Fachada ACM con letras 3D iluminadas',
  'Fachada revestida en ACM con letras tridimensionales de acrílico e iluminación, cotizada según medidas, diseño y condiciones del lugar.',
  '["fachada acm","fascia acm","acm con letras","letras acrilicas con luz","letras acrílicas con luz","fachada con luz"]'::jsonb,
  '{"cladding":"ACM","letters":"acrílico 3D","lighting":true,"finalDimensionsRequired":true}'::jsonb,
  '[{"id":"fachada-acm-desde","label":"Fachada ACM con letras acrílicas 3D iluminadas","amount":1450,"currency":"USD","mode":"starting-at","approximate":true}]'::jsonb,
  '{"firstReply":"Las fachadas en ACM con letras acrílicas 3D iluminadas tienen un precio aproximado desde USD 1,450; el valor final depende de las medidas, el diseño y las condiciones del lugar.","qualificationQuestion":"¿Qué ancho y alto aproximado tiene la fachada?","closingAction":"request-size-and-facade-photo"}'::jsonb,
  '{"priceIsApproximate":true,"finalQuoteRequiresValidation":true,"paymentAdvancePercent":60,"paymentBalancePercent":40,"maxQuestionsPerReply":1}'::jsonb
)
on conflict (product_id) do update set
  platform_id = excluded.platform_id,
  version = excluded.version,
  status = 'active',
  name = excluded.name,
  description = excluded.description,
  aliases = excluded.aliases,
  specifications = excluded.specifications,
  price_offers = excluded.price_offers,
  sales_guidance = excluded.sales_guidance,
  commercial_rules = excluded.commercial_rules,
  updated_at = now();

commit;
