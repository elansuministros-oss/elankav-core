// src/OperacionesCentrales.jsx

import React, { useMemo, useState } from 'react';
import './App.css';

export default function OperacionesCentrales() {
  const [vistaActiva, setVistaActiva] = useState('home');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [direccionSwipe, setDireccionSwipe] = useState('quieto');

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

  const indiceActivo = useMemo(
    () => salas.findIndex((sala) => sala.id === vistaActiva),
    [salas, vistaActiva]
  );

  const salaActiva = useMemo(
    () => salas.find((sala) => sala.id === vistaActiva) || salas[0],
    [salas, vistaActiva]
  );

  const cambiarVista = (nuevoIndice, direccion = 'quieto') => {
    const total = salas.length;
    const indiceNormalizado = (nuevoIndice + total) % total;
    setDireccionSwipe(direccion);
    setVistaActiva(salas[indiceNormalizado].id);
    window.setTimeout(() => setDireccionSwipe('quieto'), 280);
  };

  const irAVista = (id) => {
    const nuevoIndice = salas.findIndex((sala) => sala.id === id);
    const direccion = nuevoIndice > indiceActivo ? 'izquierda' : 'derecha';
    cambiarVista(nuevoIndice, direccion);
    setMenuAbierto(false);
  };

  const manejarTouchStart = (evento) => {
    const toque = evento.touches[0];
    setTouchStartX(toque.clientX);
    setTouchStartY(toque.clientY);
  };

  const manejarTouchEnd = (evento) => {
    if (touchStartX === null || touchStartY === null) return;

    const toque = evento.changedTouches[0];
    const diferenciaX = touchStartX - toque.clientX;
    const diferenciaY = touchStartY - toque.clientY;
    const movimientoHorizontal = Math.abs(diferenciaX);
    const movimientoVertical = Math.abs(diferenciaY);

    setTouchStartX(null);
    setTouchStartY(null);

    if (movimientoHorizontal < 70 || movimientoHorizontal < movimientoVertical) {
      return;
    }

    if (diferenciaX > 0) {
      cambiarVista(indiceActivo + 1, 'izquierda');
      return;
    }

    cambiarVista(indiceActivo - 1, 'derecha');
  };

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
      titulo: 'Menú ELAN como navegación principal',
      detalle:
        'El símbolo mantiene la identidad del sistema y abre todas las salas.',
      estado: 'Activo',
    },
    {
      titulo: 'Deslizar pantallas',
      detalle:
        'También puedes pasar de una sala a otra deslizando izquierda o derecha.',
      estado: 'Móvil',
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

  const datosSala = datosPorSala[vistaActiva] || datosPorSala.ceo;

  const renderLogoElan = (claseExtra = '') => (
    <span className={`kavtore-logo-lines ${claseExtra}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );

  const renderHome = () => (
    <>
      <section className="ceo-command-layout">
        <article className="ceo-hero-card">
          <span>Centro de comando</span>
          <strong>ELAN KAVTORÉ</strong>
          <p>
            Orquestador de IA y Director Operativo Digital de ELANKAV. El menú
            ELAN abre todas las salas y el gesto lateral permite avanzar entre
            pantallas sin perder espacio visual.
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
            <span>Navegación</span>
            <strong>Swipe</strong>
            <small>Desliza izquierda o derecha para cambiar de sala.</small>
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
      <header className="kavtore-app-header">
        <button
          type="button"
          className="kavtore-logo-menu"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú ELAN KAVTORÉ"
        >
          {renderLogoElan()}
        </button>

        <div className="kavtore-app-title">
          <strong>{salaActiva.titulo}</strong>
          <small>
            {salaActiva.icono} {salaActiva.nombre} · {indiceActivo + 1}/{salas.length} · Desliza
          </small>
        </div>
      </header>

      {menuAbierto && (
        <div className="kavtore-menu-layer" role="presentation">
          <button
            type="button"
            className="kavtore-menu-backdrop"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          />

          <aside className="kavtore-sidebar" aria-label="Menú ELAN KAVTORÉ">
            <div className="kavtore-sidebar-head">
              <div className="kavtore-logo-menu kavtore-logo-menu-sidebar">
                {renderLogoElan()}
              </div>
              <div>
                <strong>ELAN KAVTORÉ</strong>
                <small>Menú operativo</small>
              </div>
            </div>

            <div className="kavtore-sidebar-list">
              {salas.map((sala) => (
                <button
                  key={sala.id}
                  type="button"
                  onClick={() => irAVista(sala.id)}
                  className={
                    vistaActiva === sala.id
                      ? 'kavtore-sidebar-item kavtore-sidebar-item-activo'
                      : 'kavtore-sidebar-item'
                  }
                >
                  <span>{sala.icono}</span>
                  <div>
                    <strong>{sala.nombre}</strong>
                    <small>{sala.tipo}</small>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <section className="executive-status-band kavtore-compact-status">
        <div>
          <span>ELANKAV CORE · HITO-0013.5 · MENÚ ELAN + SWIPE</span>
          <strong>{saludo}</strong>
          <p>
            Soy ELAN KAVTORÉ. El menú ELAN queda como navegación principal y las
            pantallas también se pueden deslizar lateralmente.
          </p>
        </div>

        <div className="status-band-grid">
          <small>Menú ELAN activo</small>
          <small>Swipe lateral activo</small>
          <small>Home corto</small>
          <small>Modo móvil primero</small>
        </div>
      </section>

      <div className="kavtore-screen-indicator" aria-label="Indicador de pantalla">
        {salas.map((sala) => (
          <button
            key={sala.id}
            type="button"
            onClick={() => irAVista(sala.id)}
            className={vistaActiva === sala.id ? 'activo' : ''}
            aria-label={`Ir a ${sala.nombre}`}
          />
        ))}
      </div>

      <section
        key={vistaActiva}
        className={`kavtore-swipe-screen kavtore-swipe-${direccionSwipe}`}
        onTouchStart={manejarTouchStart}
        onTouchEnd={manejarTouchEnd}
      >
        {vistaActiva === 'home' ? renderHome() : renderSala()}
      </section>
    </main>
  );
}
