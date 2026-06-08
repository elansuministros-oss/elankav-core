// src/OperacionesCentrales.jsx

import React from 'react';
import './App.css';

export default function OperacionesCentrales() {
  const fecha = new Date();

  const saludo =
    fecha.getHours() < 12
      ? 'Buenos días Erick.'
      : fecha.getHours() < 18
      ? 'Buenas tardes Erick.'
      : 'Buenas noches Erick.';

  const salas = [
    'KAVTORÉ CEO',
    'KAVTORÉ Comercial',
    'KAVTORÉ Visual',
    'KAVTORÉ Producción',
    'KAVTORÉ Marketing',
    'KAVTORÉ Financiero',
    'KAVTORÉ Proveedores',
  ];

  const alertas = [
    {
      titulo: 'Validación comercial obligatoria',
      detalle: 'Proveedor, precio, existencia y tiempo de entrega antes de vender.',
      nivel: 'Crítico',
    },
    {
      titulo: 'Catálogo ≠ inventario real',
      detalle: 'Ningún producto externo debe venderse sin confirmar disponibilidad.',
      nivel: 'Alto',
    },
    {
      titulo: 'ELANHOME absorbe solar',
      detalle: 'Energía solar, iluminación, domótica y seguridad pasan dentro de ELANHOME.',
      nivel: 'Estructural',
    },
  ];

  const recomendaciones = [
    {
      titulo: 'Conectar Bridge Central',
      detalle: 'Prioridad técnica sin reconstruir el CRM CENTRAL.',
      estado: 'Prioridad',
    },
    {
      titulo: 'Mantener ELANPET como primera unidad',
      detalle: 'Usar ELANPET como modelo base para las demás unidades.',
      estado: 'Activo',
    },
    {
      titulo: 'Preparar ELANVISUAL',
      detalle: 'Rotulación, impresión, acrílicos, CNC, láser y fachadas.',
      estado: 'Siguiente',
    },
  ];

  const acciones = [
    {
      comando: 'Analizar operación',
      descripcion: 'Revisar estado global del negocio y detectar prioridades.',
    },
    {
      comando: 'Preparar cotización',
      descripcion: 'Validar materiales, proveedor, costos, margen y entrega.',
    },
    {
      comando: 'Clasificar lead',
      descripcion: 'Asignar unidad, servicio, origen, cliente y estado.',
    },
    {
      comando: 'Revisar producción',
      descripcion: 'Evaluar órdenes activas, materiales y tiempos reales.',
    },
  ];

  return (
    <main className="executive-center">
      <section className="executive-status-band">
        <div>
          <span>ELANKAV CORE · PDR-0002 · ELAN KAVTORÉ OS</span>
          <strong>{saludo}</strong>
          <p>
            Soy ELAN KAVTORÉ. Sistema Operativo Inteligente de ELANKAV y
            Director Operativo Digital para coordinar ventas, producción,
            finanzas, proveedores, marketing, diseño y crecimiento.
          </p>
        </div>

        <div className="status-band-grid">
          <small>Build correcto</small>
          <small>GitHub actualizado</small>
          <small>Vercel publicado</small>
          <small>Commit seguro: 3572c73</small>
        </div>
      </section>

      <section className="ceo-command-layout">
        <article className="ceo-hero-card">
          <span>Centro de comando</span>
          <strong>ELAN KAVTORÉ</strong>
          <p>
            Orquestador de IA y cerebro operativo transversal. No es chatbot,
            no es vendedor y no es secretaria: analiza, coordina, recomienda y
            prepara ejecución real.
          </p>

          <div className="ceo-hero-kpis">
            <div>
              <small>CRM CENTRAL</small>
              <b>Activo</b>
            </div>
            <div>
              <small>Bridge</small>
              <b>Listo</b>
            </div>
            <div>
              <small>Unidades</small>
              <b>4</b>
            </div>
          </div>
        </article>

        <div className="ceo-side-grid">
          <article className="ceo-mini-card">
            <span>Estado</span>
            <strong>Operativo</strong>
            <small>El CORE está estable y publicado.</small>
          </article>

          <article className="ceo-mini-card">
            <span>Fase</span>
            <strong>0013.1</strong>
            <small>Rediseño visual de KAVTORÉ HOME.</small>
          </article>

          <article className="ceo-mini-card">
            <span>Regla</span>
            <strong>Validar</strong>
            <small>Proveedor, precio, existencia y entrega.</small>
          </article>

          <article className="ceo-mini-card">
            <span>Sistema</span>
            <strong>OS</strong>
            <small>Base para decisiones operativas reales.</small>
          </article>
        </div>
      </section>

      <nav className="executive-nav">
        {salas.map((sala) => (
          <span key={sala}>{sala}</span>
        ))}
      </nav>

      <section className="operational-intelligence-grid">
        <div className="centro-alertas">
          <div className="bloque-header">
            <div>
              <span>Centro de alertas</span>
              <h2>Riesgos operativos</h2>
            </div>
          </div>

          <div className="alertas-lista">
            {alertas.map((alerta) => (
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
              <span>Acciones recomendadas</span>
              <h2>Prioridades</h2>
            </div>
          </div>

          <div className="actividad-lista">
            {recomendaciones.map((item) => (
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

      <section className="centros-grid centros-grid-ejecutivo">
        {salas.map((sala) => (
          <article className="centro-card centro-card-ejecutivo" key={sala}>
            <div className="centro-card-top">
              <div className="centro-icono">✦</div>
              <span>Operativa</span>
            </div>

            <h3>{sala}</h3>
            <p>
              Sala especializada para análisis, decisión, seguimiento y
              ejecución dentro del sistema ELAN KAVTORÉ.
            </p>

            <div className="centro-datos centro-datos-ejecutivo">
              <div>
                <small>Estado</small>
                <strong>Preparada</strong>
              </div>
              <div>
                <small>Uso</small>
                <strong>Operativo</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="detalle-layout detalle-layout-ejecutivo">
        <div className="global-state-panel">
          <span>Consola operativa</span>
          <h4>Acciones base</h4>
          <p>
            Comandos iniciales del Director Operativo Digital para convertir
            datos del CRM y del Bridge en decisiones ejecutables.
          </p>

          <div className="lista-compacta">
            {acciones.map((accion) => (
              <article className="compacto-item" key={accion.comando}>
                <div>
                  <strong>{accion.comando}</strong>
                  <p>{accion.descripcion}</p>
                </div>
                <span>Activo</span>
              </article>
            ))}
          </div>
        </div>

        <aside className="ai-control-panel">
          <span>AI Router</span>
          <h4>Orquestador IA</h4>
          <p>
            ELAN KAVTORÉ debe coordinar texto, programación, render, diseño,
            búsqueda y análisis sin depender de una sola IA.
          </p>

          <div className="ai-checklist">
            <small>Texto operativo</small>
            <small>Programación</small>
            <small>Render y diseño</small>
            <small>Búsqueda y análisis</small>
            <small>Decisiones ejecutivas</small>
          </div>
        </aside>
      </section>
    </main>
  );
}