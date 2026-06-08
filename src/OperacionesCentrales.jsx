// src/OperacionesCentrales.jsx

import React, { useMemo, useState } from 'react';
import './App.css';

export default function OperacionesCentrales() {
  const [vistaActiva, setVistaActiva] = useState('home');

  const fecha = new Date();

  const saludo =
    fecha.getHours() < 12
      ? 'Buenos días Erick.'
      : fecha.getHours() < 18
      ? 'Buenas tardes Erick.'
      : 'Buenas noches Erick.';

  const salas = [
    {
      id: 'home',
      nombre: 'Home',
      icono: '🏠',
      tipo: 'Inicio',
      titulo: 'ELAN KAVTORÉ HOME',
      descripcion:
        'Resumen ejecutivo corto para operar desde móvil sin scroll excesivo.',
    },
    {
      id: 'ceo',
      nombre: 'CEO',
      icono: '📊',
      tipo: 'Dirección',
      titulo: 'KAVTORÉ CEO',
      descripcion:
        'Vista ejecutiva para revisar operación global, prioridades y decisiones.',
    },
    {
      id: 'comercial',
      nombre: 'Comercial',
      icono: '💰',
      tipo: 'Ventas',
      titulo: 'KAVTORÉ Comercial',
      descripcion:
        'Control de leads, cotizaciones, clientes, ventas y seguimiento comercial.',
    },
    {
      id: 'visual',
      nombre: 'Visual',
      icono: '🎨',
      tipo: 'Diseño',
      titulo: 'KAVTORÉ Visual',
      descripcion:
        'Gestión de rotulación, impresión, diseño, renders, artes y producción visual.',
    },
    {
      id: 'produccion',
      nombre: 'Producción',
      icono: '🏭',
      tipo: 'Taller',
      titulo: 'KAVTORÉ Producción',
      descripcion:
        'Control de órdenes de trabajo, materiales, procesos, montaje y entregas.',
    },
    {
      id: 'marketing',
      nombre: 'Marketing',
      icono: '📣',
      tipo: 'Contenido',
      titulo: 'KAVTORÉ Marketing',
      descripcion:
        'Planificación de campañas, publicaciones, mensajes, ofertas y captación.',
    },
    {
      id: 'financiero',
      nombre: 'Financiero',
      icono: '📈',
      tipo: 'Dinero',
      titulo: 'KAVTORÉ Financiero',
      descripcion:
        'Control de ingresos, egresos, cobros, deudas, utilidad, IVA y flujo.',
    },
    {
      id: 'proveedores',
      nombre: 'Proveedores',
      icono: '🚚',
      tipo: 'Compras',
      titulo: 'KAVTORÉ Proveedores',
      descripcion:
        'Validación de proveedor, precio, existencia y tiempo de entrega antes de vender.',
    },
  ];

  const salaActiva = useMemo(
    () => salas.find((sala) => sala.id === vistaActiva) || salas[0],
    [vistaActiva]
  );

  const kpisHome = [
    {
      label: 'CRM CENTRAL',
      valor: 'Activo',
      detalle: 'Cadena operativa estable.',
    },
    {
      label: 'Bridge',
      valor: 'Listo',
      detalle: 'Preparado para integración.',
    },
    {
      label: 'Unidades',
      valor: '4',
      detalle: 'ELANPET, Visual, Center, Home.',
    },
  ];

  const alertasCriticas = [
    {
      titulo: 'Validación comercial obligatoria',
      detalle:
        'Proveedor, precio, existencia y tiempo de entrega antes de vender.',
      nivel: 'Crítico',
    },
    {
      titulo: 'Catálogo no es inventario',
      detalle:
        'Ningún producto externo debe ofrecerse como disponible sin confirmar.',
      nivel: 'Alto',
    },
  ];

  const recomendacionesHome = [
    {
      titulo: 'Mantener Home corto',
      detalle:
        'Cada sala debe operar por separado para evitar scroll largo en móvil.',
      estado: 'Activo',
    },
    {
      titulo: 'Iniciar con KAVTORÉ CEO',
      detalle:
        'Será la primera sala funcional con indicadores y decisiones generales.',
      estado: 'Siguiente',
    },
  ];

  const datosPorSala = {
    ceo: {
      foco: 'Dirección general',
      objetivo:
        'Revisar ventas, producción, cobros, leads, alertas y prioridades desde una sola vista.',
      indicadores: [
        ['Estado global', 'Operativo'],
        ['Prioridad', 'Bridge Central'],
        ['Riesgo', 'Validación comercial'],
        ['Acción', 'Clasificar operación'],
      ],
      acciones: [
        'Revisar estado global del negocio.',
        'Detectar prioridades del día.',
        'Ordenar decisiones por urgencia.',
        'Coordinar salas operativas.',
      ],
    },
    comercial: {
      foco: 'Ventas y seguimiento',
      objetivo:
        'Controlar leads, cotizaciones, clientes, pedidos aprobados y oportunidades.',
      indicadores: [
        ['Leads', 'Pendiente'],
        ['Cotizaciones', 'En proceso'],
        ['Clientes', 'Activos'],
        ['Seguimiento', 'Necesario'],
      ],
      acciones: [
        'Clasificar lead por unidad de negocio.',
        'Preparar cotización con margen real.',
        'Dar seguimiento a clientes pendientes.',
        'Separar oportunidad fría, tibia y caliente.',
      ],
    },
    visual: {
      foco: 'Diseño y rotulación',
      objetivo:
        'Coordinar diseño gráfico, renders, rotulación, impresión, acrílicos, PVC, CNC y láser.',
      indicadores: [
        ['Artes', 'Por revisar'],
        ['Renders', 'Pendientes'],
        ['Producción visual', 'Activa'],
        ['Unidad', 'ELANVISUAL'],
      ],
      acciones: [
        'Preparar propuesta visual.',
        'Verificar medidas reales.',
        'Validar materiales producibles.',
        'Separar estándar y premium.',
      ],
    },
    produccion: {
      foco: 'Taller y órdenes',
      objetivo:
        'Controlar órdenes de trabajo, materiales, tiempos reales, montaje y entregas.',
      indicadores: [
        ['Órdenes', 'Activas'],
        ['Materiales', 'Por validar'],
        ['Montaje', 'Según agenda'],
        ['Riesgo', 'Tiempo real'],
      ],
      acciones: [
        'Revisar órdenes activas.',
        'Validar existencia de material.',
        'Confirmar responsables.',
        'Ordenar producción por prioridad.',
      ],
    },
    marketing: {
      foco: 'Captación y contenido',
      objetivo:
        'Organizar campañas, publicaciones, ofertas, mensajes y presencia comercial.',
      indicadores: [
        ['Campañas', 'Planeación'],
        ['Contenido', 'Pendiente'],
        ['Redes', 'Activas'],
        ['WhatsApp', 'Entrada común'],
      ],
      acciones: [
        'Preparar mensaje comercial.',
        'Crear contenido por unidad.',
        'Asignar origen del lead.',
        'Medir respuesta de campañas.',
      ],
    },
    financiero: {
      foco: 'Control financiero',
      objetivo:
        'Revisar ingresos, egresos, cobros, deudas, utilidad, IVA y flujo de caja.',
      indicadores: [
        ['Cobros', 'Por revisar'],
        ['Egresos', 'Control diario'],
        ['Deudas', 'Seguimiento'],
        ['Utilidad', 'Pendiente cálculo'],
      ],
      acciones: [
        'Registrar ingreso o egreso.',
        'Separar gasto personal y operativo.',
        'Revisar cuentas por cobrar.',
        'Medir utilidad real por proyecto.',
      ],
    },
    proveedores: {
      foco: 'Compras y validación',
      objetivo:
        'Confirmar proveedores, precios, existencia, tiempo de entrega y condiciones antes de vender.',
      indicadores: [
        ['Proveedor', 'Debe validarse'],
        ['Precio', 'Debe confirmarse'],
        ['Existencia', 'No asumir'],
        ['Entrega', 'Confirmar fecha'],
      ],
      acciones: [
        'Consultar proveedor antes de cotizar.',
        'Confirmar precio actualizado.',
        'Validar inventario real.',
        'Registrar condiciones de entrega.',
      ],
    },
  };

  const datosSala =
    datosPorSala[vistaActiva] || datosPorSala.ceo;

  const renderHome = () => (
    <>
      <section className="ceo-command-layout">
        <article className="ceo-hero-card">
          <span>Centro de comando</span>
          <strong>ELAN KAVTORÉ</strong>
          <p>
            Orquestador de IA y Director Operativo Digital de ELANKAV. Esta
            vista queda corta para móvil; las salas operativas se abren por
            separado desde el menú.
          </p>

          <div className="ceo-hero-kpis">
            {kpisHome.map((kpi) => (
              <div key={kpi.label}>
                <small>{kpi.label}</small>
                <b>{kpi.valor}</b>
              </div>
            ))}
          </div>
        </article>

        <div className="ceo-side-grid">
          {kpisHome.map((kpi) => (
            <article className="ceo-mini-card" key={kpi.label}>
              <span>{kpi.label}</span>
              <strong>{kpi.valor}</strong>
              <small>{kpi.detalle}</small>
            </article>
          ))}

          <article className="ceo-mini-card">
            <span>Modo móvil</span>
            <strong>Activo</strong>
            <small>Home corto y navegación por salas.</small>
          </article>
        </div>
      </section>

      <section className="operational-intelligence-grid">
        <div className="centro-alertas">
          <div className="bloque-header">
            <div>
              <span>Centro de alertas</span>
              <h2>Riesgos críticos</h2>
            </div>
          </div>

          <div className="alertas-lista">
            {alertasCriticas.map((alerta) => (
              <article className="alerta-card" key={alerta.titulo}>
                <div className="alerta-icono">⚠</div>
                <div>
                  <h4>{alerta.titulo}</h4>
                  <p>{alerta.detalle}</p>
                </div>
                <span className="alerta-nivel">{alerta.nivel}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="actividad-reciente">
          <div className="bloque-header">
            <div>
              <span>Recomendaciones</span>
              <h2>Próximas decisiones</h2>
            </div>
          </div>

          <div className="actividad-lista">
            {recomendacionesHome.map((item) => (
              <article className="actividad-item" key={item.titulo}>
                <time>{item.estado}</time>
                <div>
                  <strong>{item.titulo}</strong>
                  <p>{item.detalle}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );

  const renderSala = () => (
    <section className="detalle-layout detalle-layout-ejecutivo">
      <div className="global-state-panel">
        <span>{salaActiva.tipo}</span>
        <h4>{salaActiva.titulo}</h4>
        <p>{salaActiva.descripcion}</p>

        <div className="lista-compacta">
          <article className="compacto-item">
            <div>
              <strong>Foco operativo</strong>
              <p>{datosSala.foco}</p>
            </div>
            <span>Activo</span>
          </article>

          <article className="compacto-item">
            <div>
              <strong>Objetivo</strong>
              <p>{datosSala.objetivo}</p>
            </div>
            <span>Control</span>
          </article>

          {datosSala.acciones.map((accion) => (
            <article className="compacto-item" key={accion}>
              <div>
                <strong>Acción</strong>
                <p>{accion}</p>
              </div>
              <span>Base</span>
            </article>
          ))}
        </div>
      </div>

      <aside className="ai-control-panel">
        <span>Indicadores</span>
        <h4>{salaActiva.nombre}</h4>
        <p>
          Panel inicial de sala. En el siguiente hito estos indicadores se
          conectarán con datos reales del CRM CENTRAL y Bridge Central.
        </p>

        <div className="ai-checklist">
          {datosSala.indicadores.map(([label, valor]) => (
            <small key={label}>
              {label}: {valor}
            </small>
          ))}
        </div>
      </aside>
    </section>
  );

  return (
    <main className="executive-center">
      <section className="executive-status-band">
        <div>
          <span>ELANKAV CORE · HITO-0013.2 · NAVEGACIÓN MÓVIL</span>
          <strong>{saludo}</strong>
          <p>
            Soy ELAN KAVTORÉ. Sistema Operativo Inteligente de ELANKAV. El
            control ahora funciona por salas para evitar scroll infinito en
            móvil.
          </p>
        </div>

        <div className="status-band-grid">
          <small>Commit base: 9b7b945</small>
          <small>Home corto</small>
          <small>Salas separadas</small>
          <small>Modo móvil primero</small>
        </div>
      </section>

      <nav className="executive-nav" aria-label="Navegación ELAN KAVTORÉ">
        {salas.map((sala) => (
          <button
            key={sala.id}
            type="button"
            onClick={() => setVistaActiva(sala.id)}
            className={vistaActiva === sala.id ? 'kavtore-nav-activa' : ''}
          >
            <span>{sala.icono}</span>
            {sala.nombre}
          </button>
        ))}
      </nav>

      {vistaActiva === 'home' ? renderHome() : renderSala()}
    </main>
  );
}