export const unidadesGrupo = [
  {
    id: 'pet',
    nombre: 'ELANPET',
    codigo: 'PET',
    estado: 'Operativo',
    descripcion:
      'Mascotas, veterinarias, afiliados, pedidos, QR, catálogo personalizado, promociones y comisión automática.',
    leads: 42,
    clientes: 18,
    ingresos: 12500,
    ingresosProyectados: 18500,
    prioridad: 'Alta',
  },
  {
    id: 'visual',
    nombre: 'ELANVISUAL',
    codigo: 'VIS',
    estado: 'Activo',
    descripcion:
      'Rotulación, impresión digital, UV, DTF UV, CNC, láser, acrílicos, PVC, displays, fachadas, branding y publicidad visual.',
    leads: 36,
    clientes: 24,
    ingresos: 28400,
    ingresosProyectados: 43000,
    prioridad: 'Alta',
  },
  {
    id: 'center',
    nombre: 'ELANCENTER',
    codigo: 'CENTER',
    estado: 'Diseño',
    descripcion:
      'Tecnología, diseño gráfico, capacitación, desarrollo, servicios digitales y centro de cómputo creativo.',
    leads: 9,
    clientes: 3,
    ingresos: 0,
    ingresosProyectados: 15000,
    prioridad: 'Media',
  },
  {
    id: 'home',
    nombre: 'ELANHOME',
    codigo: 'HOME',
    estado: 'Planificado',
    descripcion:
      'Decoración, iluminación, energía solar, exteriores, construcción ligera, WPC, grama artificial y soluciones para hogar y negocios.',
    leads: 14,
    clientes: 6,
    ingresos: 0,
    ingresosProyectados: 22000,
    prioridad: 'Media',
  },
];

export const kavtoreSalas = [
  {
    id: 'ceo',
    nombre: 'KAVTORÉ CEO',
    descripcion:
      'Estado general de ELANKAV, prioridades, riesgos, utilidad, unidades y decisiones ejecutivas.',
    estado: 'Base operativa',
  },
  {
    id: 'comercial',
    nombre: 'KAVTORÉ Comercial',
    descripcion:
      'Leads, clientes, cotizaciones, seguimiento, oportunidades y probabilidad de cierre.',
    estado: 'Base operativa',
  },
  {
    id: 'visual',
    nombre: 'KAVTORÉ Visual',
    descripcion:
      'Diseño, branding, renders, arquitectura comercial, materiales, presupuesto y cotización asistida.',
    estado: 'Diseño funcional',
  },
  {
    id: 'produccion',
    nombre: 'KAVTORÉ Producción',
    descripcion:
      'Órdenes de trabajo, materiales, inventario, fabricación, instalación y atrasos.',
    estado: 'Diseño funcional',
  },
  {
    id: 'proveedores',
    nombre: 'KAVTORÉ Proveedores',
    descripcion:
      'Proveedor, existencia, precio vigente, tiempo de entrega, subcontratación y marketplace futuro.',
    estado: 'Diseño funcional',
  },
  {
    id: 'financiero',
    nombre: 'KAVTORÉ Financiero',
    descripcion:
      'Cobros, pagos, flujo de caja, utilidad, cuentas por cobrar y cuentas por pagar.',
    estado: 'Diseño funcional',
  },
  {
    id: 'marketing',
    nombre: 'KAVTORÉ Marketing',
    descripcion:
      'Redes sociales, campañas, segmentación, contenido, presupuesto y retorno comercial.',
    estado: 'Diseño funcional',
  },
  {
    id: 'ai',
    nombre: 'ELAN AI',
    descripcion:
      'Capa superior de inteligencia operativa conectada al CRM CENTRAL. No tiene base de datos propia.',
    estado: 'Diseño funcional',
  },
];

export const operacionesIniciales = [
  {
    id: 'op-001',
    unidad: 'ELANPET',
    tipo: 'Pedido',
    cliente: 'Veterinaria San José',
    estado: 'Pendiente',
    origen: 'WhatsApp',
    monto: 3500,
    fecha: '2026-06-07',
  },
  {
    id: 'op-002',
    unidad: 'ELANVISUAL',
    tipo: 'Cotización',
    cliente: 'COMEX',
    estado: 'Nueva',
    origen: 'Redes Sociales',
    monto: 18500,
    fecha: '2026-06-07',
  },
  {
    id: 'op-003',
    unidad: 'ELANHOME',
    tipo: 'Lead',
    cliente: 'Hotel Granada',
    estado: 'Nuevo',
    origen: 'Formulario Web',
    monto: 0,
    fecha: '2026-06-07',
  },
  {
    id: 'op-004',
    unidad: 'ELANCENTER',
    tipo: 'Servicio',
    cliente: 'Universidad',
    estado: 'Pendiente',
    origen: 'WhatsApp',
    monto: 0,
    fecha: '2026-06-07',
  },
  {
    id: 'op-005',
    unidad: 'ELAN AI',
    tipo: 'Automatización',
    cliente: 'Interno',
    estado: 'Diseño',
    origen: 'ELAN KAVTORÉ',
    monto: 0,
    fecha: '2026-06-07',
  },
];

export const clientesIniciales = [
  {
    id: 'cli-001',
    nombre: 'Veterinaria San José',
    unidad: 'ELANPET',
    whatsapp: '+505 0000 0000',
    estado: 'Activo',
    origen: 'QR Veterinaria',
  },
  {
    id: 'cli-002',
    nombre: 'COMEX',
    unidad: 'ELANVISUAL',
    whatsapp: '+505 0000 0000',
    estado: 'Activo',
    origen: 'Cliente corporativo',
  },
  {
    id: 'cli-003',
    nombre: 'Hotel Granada',
    unidad: 'ELANHOME',
    whatsapp: '+505 0000 0000',
    estado: 'Lead',
    origen: 'Formulario Web',
  },
];

export const empresasIniciales = [
  {
    id: 'emp-001',
    nombre: 'COMEX',
    rubro: 'Comercial',
    contactoPrincipal: 'Pendiente',
    estado: 'Activa',
    unidad: 'ELANVISUAL',
  },
  {
    id: 'emp-002',
    nombre: 'Veterinaria San José',
    rubro: 'Veterinaria',
    contactoPrincipal: 'Pendiente',
    estado: 'Activa',
    unidad: 'ELANPET',
  },
  {
    id: 'emp-003',
    nombre: 'Hotel Granada',
    rubro: 'Hotel / Turismo',
    contactoPrincipal: 'Pendiente',
    estado: 'Prospecto',
    unidad: 'ELANHOME',
  },
];

export const leadsIniciales = [
  {
    id: 'lead-001',
    nombre: 'Consulta por rótulo fachada',
    cliente: 'COMEX',
    unidad: 'ELANVISUAL',
    origen: 'Facebook',
    estado: 'Nuevo',
    prioridad: 'Alta',
  },
  {
    id: 'lead-002',
    nombre: 'Pedido productos mascotas',
    cliente: 'Veterinaria San José',
    unidad: 'ELANPET',
    origen: 'WhatsApp',
    estado: 'Pendiente',
    prioridad: 'Media',
  },
  {
    id: 'lead-003',
    nombre: 'Sistema solar comercial',
    cliente: 'Hotel Granada',
    unidad: 'ELANHOME',
    origen: 'Web',
    estado: 'Nuevo',
    prioridad: 'Alta',
  },
];

export const mensajesWhatsApp = [
  {
    id: 'wa-001',
    cliente: 'COMEX',
    mensaje: 'Necesito cotizar un rótulo para fachada.',
    unidad: 'ELANVISUAL',
    unidadDetectada: 'ELANVISUAL',
    servicioDetectado: 'Rotulación',
    tipoCliente: 'Empresa',
    estado: 'Pendiente',
    origen: 'WhatsApp',
  },
  {
    id: 'wa-002',
    cliente: 'Veterinaria San José',
    mensaje: 'Quiero hacer un pedido de productos para mascotas.',
    unidad: 'ELANPET',
    unidadDetectada: 'ELANPET',
    servicioDetectado: 'Pedido catálogo',
    tipoCliente: 'Afiliado / Veterinaria',
    estado: 'Pendiente',
    origen: 'WhatsApp',
  },
  {
    id: 'wa-003',
    cliente: 'Hotel Granada',
    mensaje: 'Busco información sobre paneles solares.',
    unidad: 'ELANHOME',
    unidadDetectada: 'ELANHOME',
    servicioDetectado: 'Energía solar',
    tipoCliente: 'Empresa',
    estado: 'Nuevo',
    origen: 'WhatsApp',
  },
];

export const tareasIA = [
  {
    id: 'ia-001',
    modulo: 'Comercial',
    tarea:
      'Clasificar mensajes entrantes por unidad de negocio, servicio solicitado, tipo de cliente, origen y estado del lead.',
    estado: 'Pendiente',
    prioridad: 'Alta',
  },
  {
    id: 'ia-002',
    modulo: 'Comercial',
    tarea: 'Detectar clientes repetidos por WhatsApp antes de crear nuevo registro.',
    estado: 'Pendiente',
    prioridad: 'Alta',
  },
  {
    id: 'ia-003',
    modulo: 'Ejecutivo',
    tarea: 'Generar resumen ejecutivo diario desde CRM CENTRAL y KAVTORÉ.',
    estado: 'Diseño',
    prioridad: 'Alta',
  },
  {
    id: 'ia-004',
    modulo: 'Proveedores',
    tarea: 'Validar existencia, precio y tiempo de entrega con proveedores antes de vender.',
    estado: 'Diseño',
    prioridad: 'Alta',
  },
  {
    id: 'ia-005',
    modulo: 'Visual',
    tarea:
      'Crear propuestas visuales preliminares con control de una propuesta gratuita sin revisiones.',
    estado: 'Diseño',
    prioridad: 'Alta',
  },
  {
    id: 'ia-006',
    modulo: 'Financiero',
    tarea:
      'Detectar cuentas por cobrar, flujo de caja bajo, pagos vencidos y utilidad pendiente de confirmar.',
    estado: 'Diseño',
    prioridad: 'Alta',
  },
  {
    id: 'ia-007',
    modulo: 'Producción',
    tarea:
      'Detectar órdenes pendientes, faltantes de material, atrasos de fabricación e instalaciones próximas.',
    estado: 'Diseño',
    prioridad: 'Alta',
  },
];

export const timelineInicial = [
  {
    id: 'tl-001',
    hora: '08:15',
    unidad: 'ELANPET',
    evento: 'Nuevo pedido recibido desde WhatsApp.',
  },
  {
    id: 'tl-002',
    hora: '09:30',
    unidad: 'ELANVISUAL',
    evento: 'Nueva cotización pendiente para COMEX.',
  },
  {
    id: 'tl-003',
    hora: '10:45',
    unidad: 'ELANHOME',
    evento: 'Lead nuevo detectado para sistema solar comercial.',
  },
  {
    id: 'tl-004',
    hora: '12:10',
    unidad: 'ELAN AI',
    evento: 'Tarea pendiente: clasificar mensajes entrantes y activar análisis ejecutivo.',
  },
];

export const elanAIConfig = {
  nombre: 'ELAN AI',
  tipo: 'Capa superior de inteligencia operativa',
  baseDatosPropia: false,
  fuentePrincipal: 'CRM CENTRAL',
  puente: 'CentralBridge',
  objetivo:
    'Analizar datos del CRM CENTRAL y convertirlos en decisiones comerciales, financieras, productivas y ejecutivas.',
  modulos: [
    'Comercial',
    'Producción',
    'Financiero',
    'Ejecutivo',
    'Proveedores',
    'Marketing',
    'Visual',
  ],
  reglas: [
    'No crear base de datos propia.',
    'No duplicar CRM CENTRAL.',
    'No asumir que un WhatsApp pertenece a una sola unidad.',
    'Clasificar primero unidad, servicio, tipo de cliente, origen y estado.',
    'Usar ELANHOME para solar; no usar ELANSOLAR como unidad independiente.',
  ],
};

export const estructuraElanHome = [
  {
    categoria: 'Decoración',
    items: ['Cuadros', 'Alfombras', 'Decoración interior'],
  },
  {
    categoria: 'Iluminación',
    items: ['Lámparas', 'Iluminación decorativa', 'Iluminación arquitectónica'],
  },
  {
    categoria: 'Energía solar',
    items: ['Paneles solares', 'Inversores', 'Baterías', 'Sistemas híbridos', 'Bombeo solar'],
  },
  {
    categoria: 'Exteriores',
    items: ['Grama artificial', 'Jardines', 'Pérgolas', 'Mobiliario exterior'],
  },
  {
    categoria: 'Construcción ligera',
    items: ['WPC', 'Fachadas decorativas', 'Revestimientos'],
  },
];