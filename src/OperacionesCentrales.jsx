import { useMemo, useState } from 'react';
import { dinero, rankingUnidades } from './core/CentralBridge';

const estadosPendientes = [
  'Pendiente',
  'Nueva',
  'Nuevo',
  'Diseño',
  'Aprobado',
  'Producción',
  'Seguimiento',
  'Lead nuevo',
  'Sin clasificar',
  'En seguimiento',
];

const normalizarTexto = (valor = '') =>
  String(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const contarPorEstado = (items = [], estados = []) => {
  const estadosNormalizados = estados.map(normalizarTexto);

  return items.filter((item) =>
    estadosNormalizados.includes(normalizarTexto(item?.estado || item?.estatus || item?.status))
  ).length;
};

const obtenerCliente = (item = {}) =>
  item.cliente || item.nombreCliente || item.empresa || item.nombre || item.contacto || 'Sin cliente';

const obtenerUnidad = (item = {}) =>
  item.unidad || item.unidadNegocio || item.area || item.categoria || 'Sin unidad';

const obtenerEstado = (item = {}) =>
  item.estado || item.estatus || item.status || 'Sin estado';

const obtenerMonto = (item = {}) => Number(item.total || item.monto || item.valor || 0);

export default function OperacionesCentrales({
  datosCore,
  estadoGlobal,
  reporteEjecutivo,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [unidadFiltro, setUnidadFiltro] = useState('Todas');

  const operaciones = datosCore?.operaciones || [];
  const unidadesCore = datosCore?.unidades || [];
  const leads = datosCore?.leads || [];
  const mensajes = datosCore?.mensajes || [];
  const empresas = datosCore?.empresas || [];
  const clientes = datosCore?.clientes || [];
  const cobros = datosCore?.cobros || [];
  const cotizaciones = datosCore?.cotizaciones || [];
  const produccion = datosCore?.produccion || [];
  const ordenesTrabajo = datosCore?.ordenesTrabajo || datosCore?.ordenes_trabajo || [];
  const inventario = datosCore?.inventario || [];
  const notificaciones = datosCore?.notificaciones || datosCore?.notificacionesCrm || [];

  const estadoSeguro = estadoGlobal || {};
  const reporteSeguro = reporteEjecutivo || {};

  const ranking = useMemo(
    () =>
      rankingUnidades({
        unidades: unidadesCore,
        operaciones,
        leads,
        mensajes,
      }),
    [unidadesCore, operaciones, leads, mensajes]
  );

  const unidadesFiltroOpciones = useMemo(() => {
    const desdeUnidades = unidadesCore.map((unidad) => unidad.nombre).filter(Boolean);
    const desdeOperaciones = operaciones.map((op) => op.unidad).filter(Boolean);
    const desdeLeads = leads.map((lead) => obtenerUnidad(lead)).filter(Boolean);
    const desdeMensajes = mensajes.map((mensaje) => obtenerUnidad(mensaje)).filter(Boolean);

    return ['Todas', ...new Set([...desdeUnidades, ...desdeOperaciones, ...desdeLeads, ...desdeMensajes])];
  }, [unidadesCore, operaciones, leads, mensajes]);

  const operacionesFiltradas = useMemo(() => {
    return operaciones.filter((op) => {
      const texto = `${op.unidad} ${op.tipo} ${op.cliente} ${op.estado} ${op.responsable}`.toLowerCase();
      const coincideBusqueda = texto.includes(busqueda.toLowerCase());
      const coincideUnidad = unidadFiltro === 'Todas' || op.unidad === unidadFiltro;

      return coincideBusqueda && coincideUnidad;
    });
  }, [operaciones, busqueda, unidadFiltro]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => unidadFiltro === 'Todas' || obtenerUnidad(lead) === unidadFiltro);
  }, [leads, unidadFiltro]);

  const mensajesFiltrados = useMemo(() => {
    return mensajes.filter((mensaje) => unidadFiltro === 'Todas' || obtenerUnidad(mensaje) === unidadFiltro);
  }, [mensajes, unidadFiltro]);

  const totalMonto = operacionesFiltradas.reduce((acc, op) => acc + obtenerMonto(op), 0);
  const pendientes = operacionesFiltradas.filter((op) => estadosPendientes.includes(obtenerEstado(op))).length;
  const ingresosGlobales = operaciones.reduce((acc, op) => acc + obtenerMonto(op), 0);
  const ingresosProyectados = Number(estadoSeguro.ingresosProyectados || 0);
  const cobrosVisibles = cobros.reduce((acc, item) => acc + obtenerMonto(item), 0);

  const leadsNuevos = contarPorEstado(leads, ['Nuevo', 'Nueva', 'Lead nuevo']);
  const leadsSeguimiento = contarPorEstado(leads, ['Seguimiento', 'En seguimiento']);
  const leadsCotizados = contarPorEstado(leads, ['Cotizado', 'Cotización', 'Cotizacion']);
  const leadsGanados = contarPorEstado(leads, ['Ganado', 'Aprobado', 'Venta']);
  const leadsSinClasificar = contarPorEstado(leads, ['Sin clasificar']);

  const mensajesPendientes = Number(
    estadoSeguro.mensajesPendientes ?? contarPorEstado(mensajes, ['Pendiente', 'Sin responder', 'Nuevo', 'Nueva'])
  );
  const mensajesSinClasificar = contarPorEstado(mensajes, ['Sin clasificar']);
  const mensajesSeguimiento = contarPorEstado(mensajes, ['Seguimiento', 'En seguimiento', 'Pendiente']);

  const clientesActivos = clientes.filter((cliente) => normalizarTexto(cliente.estado || 'Activo') !== 'inactivo').length;
  const empresasActivas = empresas.filter((empresa) => normalizarTexto(empresa.estado || 'Activa') !== 'inactiva').length;
  const alertas = reporteSeguro.alertas || [];

  const unidadSeleccionada = useMemo(() => {
    if (unidadFiltro === 'Todas') {
      return {
        nombre: 'TODAS LAS UNIDADES',
        descripcion: 'Vista global de todas las unidades conectadas al CRM CENTRAL.',
        estado: 'Vista Global',
        operaciones: operacionesFiltradas.length,
        leads: leadsFiltrados.length,
        mensajes: mensajesFiltrados.length,
        ingresos: totalMonto,
        proyectado: ingresosProyectados,
      };
    }

    const unidad = ranking.find((item) => item.nombre === unidadFiltro);

    return (
      unidad || {
        nombre: unidadFiltro,
        descripcion: 'Unidad sin registros visibles todavía.',
        estado: 'Sin datos',
        operaciones: 0,
        leads: leadsFiltrados.length,
        mensajes: mensajesFiltrados.length,
        ingresos: 0,
        proyectado: 0,
      }
    );
  }, [unidadFiltro, ranking, operacionesFiltradas.length, leadsFiltrados.length, mensajesFiltrados.length, totalMonto, ingresosProyectados]);

  const rankingVisible = ranking.slice(0, 5);
  const ultimosMensajes = mensajesFiltrados.slice(0, 4);
  const ultimosLeads = leadsFiltrados.slice(0, 4);
  const ultimasOperaciones = operacionesFiltradas.slice(0, 6);

  const centrosEjecutivos = [
    {
      titulo: 'WhatsApp Center',
      subtitulo: 'Entrada comercial',
      icono: '💬',
      descripcion: 'Clasifica mensajes por unidad, servicio, cliente y estado del lead.',
      clase: 'centro-whatsapp',
      datos: [
        ['Conversaciones', mensajes.length],
        ['Pendientes', mensajesPendientes],
        ['Sin clasificar', mensajesSinClasificar || leadsSinClasificar],
        ['Seguimiento', mensajesSeguimiento],
      ],
    },
    {
      titulo: 'Leads Center',
      subtitulo: 'Embudo comercial',
      icono: '🎯',
      descripcion: 'Controla prospectos desde mensaje inicial hasta cotización y venta.',
      clase: 'centro-leads',
      datos: [
        ['Leads', leads.length],
        ['Nuevos', leadsNuevos],
        ['Cotizados', leadsCotizados],
        ['Ganados', leadsGanados],
      ],
    },
    {
      titulo: 'Clientes Center',
      subtitulo: 'Base comercial',
      icono: '👥',
      descripcion: 'Centraliza clientes activos y relación con operaciones del grupo.',
      clase: 'centro-clientes',
      datos: [
        ['Clientes', clientes.length],
        ['Activos', clientesActivos],
        ['Empresas', empresas.length],
        ['Operaciones', operaciones.length],
      ],
    },
    {
      titulo: 'Empresas Center',
      subtitulo: 'CRM maestro',
      icono: '🏢',
      descripcion: 'Control corporativo de empresas, contactos y unidades asociadas.',
      clase: 'centro-empresas',
      datos: [
        ['Empresas', empresas.length],
        ['Activas', empresasActivas],
        ['Contactos', clientes.length],
        ['Unidades', ranking.length],
      ],
    },
    {
      titulo: 'Reportes Center',
      subtitulo: 'Finanzas y operación',
      icono: '📊',
      descripcion: 'Ventas, cobros, producción, órdenes y proyección ejecutiva.',
      clase: 'centro-reportes',
      datos: [
        ['Ingresos', dinero(ingresosGlobales)],
        ['Cobros', dinero(cobrosVisibles)],
        ['OT', ordenesTrabajo.length],
        ['Producción', produccion.length],
      ],
    },
    {
      titulo: 'ELAN AI Center',
      subtitulo: 'Automatización futura',
      icono: '🤖',
      descripcion: 'Capa preparada para clasificación, análisis, seguimiento y asistencia IA.',
      clase: 'centro-ia',
      datos: [
        ['Bridge', estadoSeguro.version || 'Core'],
        ['Modo', estadoSeguro.modo || 'LAB'],
        ['Fuente', estadoSeguro.fuenteActual || 'LocalStorage'],
        ['Alertas', alertas.length],
      ],
    },
  ];

  const proyeccionBase = ingresosProyectados || ingresosGlobales;
  const porcentajeCobrado = ingresosGlobales > 0 ? Math.min(100, Math.round((cobrosVisibles / ingresosGlobales) * 100)) : 0;
  const conversionLeads = leads.length > 0 ? Math.round((leadsGanados / leads.length) * 100) : 0;

  return (
    <section className="panel-operaciones executive-center">
      <div className="executive-status-band">
        <div>
          <span>Estado global del grupo</span>
          <strong>{estadoSeguro.listoParaIntegracion ? '🟢 Operativo' : '🟡 En preparación'}</strong>
          <p>CentralBridge activo · LAB leyendo LocalStorage · CRM real protegido</p>
        </div>
        <div className="status-band-grid">
          <small>Fuente: {estadoSeguro.fuenteActual || 'LocalStorage'}</small>
          <small>Modo: {estadoSeguro.modo || 'LAB'}</small>
          <small>Versión: {estadoSeguro.version || 'CentralBridge'}</small>
        </div>
      </div>

      <div className="panel-header panel-header-ejecutivo">
        <div>
          <span className="etiqueta-core">ELANKAV CORE / LAB</span>
          <h2>Executive Center · Dashboard CEO</h2>
          <p>
            Panel central para operar unidades, mensajes, leads, clientes, empresas, reportes e IA sin tocar ELANPET, ELANKAV.COM ni CRM CENTRAL REAL.
          </p>
        </div>

        <div className="estado-bridge-card">
          <span>{estadoSeguro.listoParaIntegracion ? 'Bridge conectado' : 'Bridge pendiente'}</span>
          <strong>{estadoSeguro.modo || 'LAB'}</strong>
          <small>{estadoSeguro.version || 'CentralBridge'}</small>
        </div>
      </div>

      <div className="ceo-command-layout">
        <article className="ceo-hero-card">
          <span>Ingresos visibles</span>
          <strong>{dinero(ingresosGlobales)}</strong>
          <p>Lectura directa de operaciones reales conectadas por CentralBridge.</p>

          <div className="ceo-hero-kpis">
            <div>
              <small>Operaciones</small>
              <b>{operaciones.length}</b>
            </div>
            <div>
              <small>Empresas</small>
              <b>{empresas.length}</b>
            </div>
            <div>
              <small>Clientes</small>
              <b>{clientes.length}</b>
            </div>
          </div>
        </article>

        <div className="ceo-side-grid">
          <article className="ceo-mini-card">
            <span>Proyección</span>
            <strong>{dinero(proyeccionBase)}</strong>
            <small>Ingreso potencial conectado</small>
          </article>
          <article className="ceo-mini-card">
            <span>Pendientes</span>
            <strong>{pendientes + mensajesPendientes}</strong>
            <small>Operación + WhatsApp</small>
          </article>
          <article className="ceo-mini-card">
            <span>Conversión leads</span>
            <strong>{conversionLeads}%</strong>
            <small>Ganados sobre leads</small>
          </article>
          <article className="ceo-mini-card">
            <span>Cobrado</span>
            <strong>{porcentajeCobrado}%</strong>
            <small>{dinero(cobrosVisibles)}</small>
          </article>
        </div>
      </div>

      <div className="executive-nav">
        <span>CEO</span>
        <span>Operaciones</span>
        <span>WhatsApp</span>
        <span>Leads</span>
        <span>Reportes</span>
        <span>IA</span>
      </div>

      <div className="centros-grid centros-grid-ejecutivo">
        {centrosEjecutivos.map((centro) => (
          <article className={`centro-card centro-card-ejecutivo ${centro.clase}`} key={centro.titulo}>
            <div className="centro-card-top">
              <div className="centro-icono">{centro.icono}</div>
              <span>{centro.subtitulo}</span>
            </div>

            <h3>{centro.titulo}</h3>
            <p>{centro.descripcion}</p>

            <div className="centro-datos centro-datos-ejecutivo">
              {centro.datos.map(([label, valor]) => (
                <div key={`${centro.titulo}-${label}`}>
                  <small>{label}</small>
                  <strong>{valor}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="operational-intelligence-grid">
        <article className="whatsapp-console">
          <div className="bloque-header">
            <span>Centro WhatsApp</span>
            <strong>{mensajesFiltrados.length} conversaciones</strong>
          </div>

          <div className="whatsapp-kpi-row">
            <div><small>Nuevos</small><strong>{mensajesPendientes}</strong></div>
            <div><small>Sin clasificar</small><strong>{mensajesSinClasificar || leadsSinClasificar}</strong></div>
            <div><small>Seguimiento</small><strong>{mensajesSeguimiento}</strong></div>
            <div><small>Respondidos</small><strong>{Math.max(0, mensajes.length - mensajesPendientes)}</strong></div>
          </div>

          <div className="lista-compacta">
            {ultimosMensajes.map((mensaje, index) => (
              <div className="compacto-item" key={mensaje.id || `mensaje-${index}`}>
                <div>
                  <strong>{obtenerCliente(mensaje)}</strong>
                  <p>{mensaje.mensaje || mensaje.detalle || mensaje.ultimoMensaje || 'Mensaje recibido desde WhatsApp.'}</p>
                </div>
                <span>{obtenerEstado(mensaje)}</span>
              </div>
            ))}

            {ultimosMensajes.length === 0 && (
              <div className="compacto-item compacto-vacio">
                <div>
                  <strong>Sin mensajes reales todavía</strong>
                  <p>Cuando entren conversaciones desde WhatsApp, aparecerán clasificadas aquí.</p>
                </div>
                <span>LAB</span>
              </div>
            )}
          </div>
        </article>

        <article className="leads-funnel-console">
          <div className="bloque-header">
            <span>Centro Leads</span>
            <strong>{leadsFiltrados.length} leads</strong>
          </div>

          <div className="funnel-visual">
            <div><span>Leads</span><strong>{leads.length}</strong></div>
            <div><span>Contactados</span><strong>{leadsSeguimiento}</strong></div>
            <div><span>Cotizados</span><strong>{leadsCotizados}</strong></div>
            <div><span>Ganados</span><strong>{leadsGanados}</strong></div>
          </div>

          <div className="lista-compacta">
            {ultimosLeads.map((lead, index) => (
              <div className="compacto-item" key={lead.id || `lead-${index}`}>
                <div>
                  <strong>{obtenerCliente(lead)}</strong>
                  <p>{obtenerUnidad(lead)} · {lead.origen || lead.servicio || 'Lead comercial'}</p>
                </div>
                <span>{obtenerEstado(lead)}</span>
              </div>
            ))}

            {ultimosLeads.length === 0 && (
              <div className="compacto-item compacto-vacio">
                <div>
                  <strong>Sin leads reales todavía</strong>
                  <p>El embudo queda listo para datos reales del CRM Central.</p>
                </div>
                <span>LAB</span>
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="ranking-state-layout">
        <div className="ranking-panel-ejecutivo">
          <div className="bloque-header">
            <span>Ranking de unidades</span>
            <strong>{rankingVisible.length}</strong>
          </div>

          <div className="unidades-grid unidades-grid-ejecutivo">
            {rankingVisible.map((unidad) => (
              <button
                type="button"
                key={unidad.id || unidad.nombre}
                className={`unidad-card ${unidadFiltro === unidad.nombre ? 'unidad-card-activa' : ''}`}
                onClick={() => setUnidadFiltro(unidad.nombre)}
              >
                <div className="unidad-card-header">
                  <strong>{unidad.nombre}</strong>
                  <span>{unidad.estado}</span>
                </div>
                <p>{unidad.operaciones} operaciones · {unidad.leads} leads · {unidad.mensajes} mensajes</p>
                <div className="unidad-card-footer">
                  <small>{dinero(unidad.ingresos)}</small>
                  <small>Proy. {dinero(unidad.proyectado)}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="global-state-panel">
          <span>Estado Global Grupo</span>
          <h4>{estadoSeguro.listoParaIntegracion ? 'Conectado y operativo' : 'Pendiente de conexión'}</h4>
          <p>{estadoSeguro.fuenteActual || 'CentralBridge leyendo LocalStorage del LAB.'}</p>
          <div className="panel-lateral-info">
            <small>Bridge: {estadoSeguro.version || 'CentralBridge'}</small>
            <small>Fuente futura: {estadoSeguro.fuenteFutura || 'Supabase / CRM Central'}</small>
            <small>Notificaciones: {notificaciones.length}</small>
            <small>Inventario: {inventario.length}</small>
          </div>
        </aside>
      </div>

      <div className="detalle-layout detalle-layout-ejecutivo">
        <div className="detalle-unidad">
          <div className="detalle-top">
            <span>Unidad seleccionada</span>
            <button type="button" onClick={() => setUnidadFiltro('Todas')}>Ver todo</button>
          </div>
          <h3>{unidadSeleccionada.nombre}</h3>
          <p>{unidadSeleccionada.descripcion}</p>
          <div className="detalle-datos">
            <div><span>Estado</span><strong>{unidadSeleccionada.estado}</strong></div>
            <div><span>Ingresos</span><strong>{dinero(unidadSeleccionada.ingresos)}</strong></div>
            <div><span>Leads</span><strong>{unidadSeleccionada.leads}</strong></div>
            <div><span>Proyección</span><strong>{dinero(unidadSeleccionada.proyectado)}</strong></div>
          </div>
        </div>

        <div className="ai-control-panel">
          <span>ELAN AI Control Center</span>
          <h4>Preparado</h4>
          <p>Base lista para automatizar clasificación de mensajes, estado de leads, reportes y seguimiento comercial.</p>
          <div className="ai-checklist">
            <small>Clasificación WhatsApp</small>
            <small>Resumen ejecutivo</small>
            <small>Alertas automáticas</small>
            <small>Recomendaciones comerciales</small>
          </div>
        </div>
      </div>

      <div className="alertas-layout">
        <div className="centro-alertas">
          <div className="bloque-header">
            <span>Alertas ejecutivas</span>
            <strong>{alertas.length}</strong>
          </div>

          <div className="alertas-lista">
            {alertas.map((alerta, index) => (
              <div className="alerta-card" key={`${alerta.titulo}-${index}`}>
                <div className="alerta-icono">⚠️</div>
                <div>
                  <h4>{alerta.titulo}</h4>
                  <p>{alerta.detalle}</p>
                </div>
                <span className="alerta-nivel">{alerta.nivel}</span>
              </div>
            ))}

            {alertas.length === 0 && (
              <div className="alerta-card">
                <div className="alerta-icono">✅</div>
                <div>
                  <h4>Sin alertas críticas</h4>
                  <p>El LAB está listo para recibir más datos reales del CRM Central.</p>
                </div>
                <span className="alerta-nivel">OK</span>
              </div>
            )}
          </div>
        </div>

        <div className="actividad-reciente">
          <div className="bloque-header">
            <span>Timeline Global</span>
            <strong>{ultimasOperaciones.length}</strong>
          </div>

          <div className="actividad-lista">
            {ultimasOperaciones.map((op) => (
              <div className="actividad-item" key={`${op.tipo}-${op.id}`}>
                <time>{op.fecha || 'CRM'}</time>
                <div>
                  <strong>{op.tipo} · {op.unidad}</strong>
                  <p>{op.cliente} · {op.estado}</p>
                </div>
              </div>
            ))}

            {ultimasOperaciones.length === 0 && (
              <div className="actividad-item">
                <time>CRM</time>
                <div>
                  <strong>Sin operaciones reales todavía</strong>
                  <p>Cuando el CRM tenga cotizaciones, pedidos o cobros, aparecerán aquí.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="filtros-operaciones">
        <input
          type="text"
          placeholder="Buscar por unidad, cliente, estado o responsable..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <select value={unidadFiltro} onChange={(e) => setUnidadFiltro(e.target.value)}>
          {unidadesFiltroOpciones.map((unidad) => (
            <option key={unidad} value={unidad}>{unidad}</option>
          ))}
        </select>
      </div>

      <div className="tabla-wrapper">
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {operacionesFiltradas.map((op) => (
              <tr key={`${op.tipo}-${op.id}`}>
                <td><strong>{op.unidad}</strong></td>
                <td>{op.tipo}</td>
                <td>{op.cliente}</td>
                <td>
                  <span className={`estado estado-${normalizarTexto(op.estado).replace(/\s+/g, '-')}`}>
                    {op.estado}
                  </span>
                </td>
                <td>{op.responsable}</td>
                <td>{obtenerMonto(op) > 0 ? dinero(obtenerMonto(op)) : 'Sin monto'}</td>
              </tr>
            ))}

            {operacionesFiltradas.length === 0 && (
              <tr>
                <td colSpan="6" className="sin-resultados">No hay operaciones reales registradas todavía en el CRM.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="metricas-grid metricas-finales">
        <div className="metrica-card"><span>Total visible filtrado</span><strong>{dinero(totalMonto)}</strong></div>
        <div className="metrica-card"><span>Mensajes pendientes</span><strong>{mensajesPendientes}</strong></div>
        <div className="metrica-card"><span>Estado integración</span><strong>Activa</strong></div>
      </div>
    </section>
  );
}
