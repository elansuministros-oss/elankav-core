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

  const resumenEjecutivo = [
    {
      titulo: 'CRM CENTRAL',
      valor: 'Operativo',
      estado: 'Activo',
      detalle: 'Empresas, contactos, cotizaciones, pedidos, producción y cobros conectados.',
    },
    {
      titulo: 'BRIDGE CENTRAL',
      valor: 'Preparado',
      estado: 'En integración',
      detalle: 'Listo para conectar ELANPET, ELANVISUAL, ELANCENTER y ELANHOME.',
    },
    {
      titulo: 'KAVTORÉ OS',
      valor: 'Fase inicial',
      estado: 'Implementación real',
      detalle: 'Director Operativo Digital sobre ELANKAV CORE.',
    },
    {
      titulo: 'VALIDACIÓN COMERCIAL',
      valor: 'Obligatoria',
      estado: 'Regla activa',
      detalle: 'Proveedor, precio, existencia y tiempo de entrega antes de vender.',
    },
  ];

  const alertas = [
    'Catálogo no debe tratarse como inventario real.',
    'Antes de cotizar productos externos se debe validar proveedor.',
    'ELANHOME absorbe energía solar, iluminación, domótica y seguridad.',
    'ELAN KAVTORÉ no vende: coordina, analiza, recomienda y ejecuta.',
  ];

  const recomendaciones = [
    'Priorizar conexión del Bridge Central sin reconstruir módulos existentes.',
    'Mantener ELANPET como primera unidad conectada al CRM CENTRAL.',
    'Preparar estructura reusable para ELANVISUAL, ELANCENTER y ELANHOME.',
    'Separar decisiones operativas por sala KAVTORÉ.',
  ];

  const accesosRapidos = [
    'KAVTORÉ CEO',
    'KAVTORÉ Comercial',
    'KAVTORÉ Visual',
    'KAVTORÉ Producción',
    'KAVTORÉ Marketing',
    'KAVTORÉ Financiero',
    'KAVTORÉ Proveedores',
  ];

  const consolaOperativa = [
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
    <main className="kavtore-home">
      <section className="kavtore-hero">
        <div>
          <p className="kavtore-label">ELANKAV CORE · PDR-0002</p>
          <h1>{saludo}</h1>
          <h2>Soy ELAN KAVTORÉ.</h2>
          <p>
            Sistema Operativo Inteligente de ELANKAV. Director Operativo Digital
            para coordinar ventas, producción, finanzas, proveedores, marketing,
            diseño y crecimiento.
          </p>
        </div>

        <div className="kavtore-status-card">
          <span>Estado del sistema</span>
          <strong>OPERATIVO</strong>
          <p>Build correcto · GitHub actualizado · Vercel publicado</p>
        </div>
      </section>

      <section className="kavtore-section">
        <div className="kavtore-section-head">
          <h2>Resumen Ejecutivo</h2>
          <p>Lectura rápida del estado central de ELANKAV.</p>
        </div>

        <div className="kavtore-grid">
          {resumenEjecutivo.map((item) => (
            <article className="kavtore-card" key={item.titulo}>
              <span>{item.estado}</span>
              <h3>{item.titulo}</h3>
              <strong>{item.valor}</strong>
              <p>{item.detalle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="kavtore-two-columns">
        <div className="kavtore-panel">
          <h2>Alertas</h2>
          {alertas.map((alerta) => (
            <div className="kavtore-alert" key={alerta}>
              <span>!</span>
              <p>{alerta}</p>
            </div>
          ))}
        </div>

        <div className="kavtore-panel">
          <h2>Recomendaciones</h2>
          {recomendaciones.map((recomendacion) => (
            <div className="kavtore-recommendation" key={recomendacion}>
              <span>✓</span>
              <p>{recomendacion}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="kavtore-section">
        <div className="kavtore-section-head">
          <h2>Accesos rápidos</h2>
          <p>Salas operativas aprobadas para ELAN KAVTORÉ.</p>
        </div>

        <div className="kavtore-access-grid">
          {accesosRapidos.map((acceso) => (
            <button className="kavtore-access" key={acceso} type="button">
              {acceso}
            </button>
          ))}
        </div>
      </section>

      <section className="kavtore-section">
        <div className="kavtore-section-head">
          <h2>Consola Operativa</h2>
          <p>Acciones base del Director Operativo Digital.</p>
        </div>

        <div className="kavtore-console">
          {consolaOperativa.map((item) => (
            <article key={item.comando}>
              <h3>{item.comando}</h3>
              <p>{item.descripcion}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}