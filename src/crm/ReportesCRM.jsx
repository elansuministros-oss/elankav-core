import React, { useMemo } from 'react';
import { useCore } from '../core/context/CoreContext';

const asegurarArray = (valor) => (Array.isArray(valor) ? valor : []);

const calcularTotal = (items, campos = []) =>
  asegurarArray(items).reduce((total, item) => {
    const valorEncontrado = campos
      .map((campo) => Number(item?.[campo]))
      .find((valor) => Number.isFinite(valor));

    return total + (valorEncontrado || 0);
  }, 0);

const descargarJSON = (nombreArchivo, datos) => {
  const contenido = JSON.stringify(datos, null, 2);
  const blob = new Blob([contenido], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};

export default function ReportesCRM() {
  const core = useCore();

  const datosCRMCentral = useMemo(
    () => ({
      fuente: 'CRM CENTRAL ELANKAV',
      destino: 'ELAN KAVTORE',
      version: 'PDR-0005',
      actualizadoEn: new Date().toISOString(),
      empresas: asegurarArray(core.empresas),
      contactos: asegurarArray(core.contactos),
      seguimiento: asegurarArray(core.seguimiento),
      vendedores: asegurarArray(core.vendedores),
      veterinarias: asegurarArray(core.veterinarias),
      afiliados: asegurarArray(core.afiliados),
      proveedores: asegurarArray(core.proveedores),
      compras: asegurarArray(core.compras),
      cuentasPorPagar: asegurarArray(core.cuentasPorPagar),
      cuentasPorCobrar: asegurarArray(core.cuentasPorCobrar),
      flujoCaja: asegurarArray(core.flujoCaja),
      cotizaciones: asegurarArray(core.cotizaciones),
      pedidos: asegurarArray(core.pedidos),
      ordenesTrabajo: asegurarArray(core.ordenesTrabajo),
      produccion: asegurarArray(core.produccion),
      cobros: asegurarArray(core.cobros),
      comisiones: asegurarArray(core.comisiones),
      inventario: asegurarArray(core.inventario),
      materiales: asegurarArray(core.materiales),
      auditoriaCRM: asegurarArray(core.auditoriaCRM),
      notificacionesCRM: asegurarArray(core.notificacionesCRM),
      leadsWhatsApp: asegurarArray(core.leadsWhatsApp),
      usuariosCRM: asegurarArray(core.usuariosCRM),
      rolesCRM: asegurarArray(core.rolesCRM),
    }),
    [core]
  );

  const resumen = useMemo(
    () => ({
      empresas: datosCRMCentral.empresas.length,
      contactos: datosCRMCentral.contactos.length,
      pedidos: datosCRMCentral.pedidos.length,
      ordenesTrabajo: datosCRMCentral.ordenesTrabajo.length,
      produccion: datosCRMCentral.produccion.length,
      cobros: datosCRMCentral.cobros.length,
      inventario: datosCRMCentral.inventario.length,
      materiales: datosCRMCentral.materiales.length,
      totalCobrado: calcularTotal(datosCRMCentral.cobros, ['monto', 'total', 'valor', 'importe']),
      totalPedidos: calcularTotal(datosCRMCentral.pedidos, ['total', 'monto', 'valor', 'importe']),
    }),
    [datosCRMCentral]
  );

  const exportarCRMCentral = () => {
    descargarJSON('crm-central.json', datosCRMCentral);
  };

  return (
    <section className="crm-panel reportes-crm">
      <div className="crm-panel-header">
        <div>
          <p className="eyebrow">CRM CENTRAL</p>
          <h2>Reportes y exportación ejecutiva</h2>
          <p>
            Exporta los datos reales del CRM CENTRAL para alimentar ELAN KAVTORÉ mediante
            <strong> crm-central.json</strong>.
          </p>
        </div>

        <button className="primary-btn" type="button" onClick={exportarCRMCentral}>
          Exportar CRM CENTRAL
        </button>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Empresas</span>
          <strong>{resumen.empresas}</strong>
        </article>

        <article className="stat-card">
          <span>Contactos</span>
          <strong>{resumen.contactos}</strong>
        </article>

        <article className="stat-card">
          <span>Pedidos</span>
          <strong>{resumen.pedidos}</strong>
        </article>

        <article className="stat-card">
          <span>Producción</span>
          <strong>{resumen.produccion}</strong>
        </article>

        <article className="stat-card">
          <span>Cobros</span>
          <strong>{resumen.cobros}</strong>
        </article>

        <article className="stat-card">
          <span>Inventario</span>
          <strong>{resumen.inventario}</strong>
        </article>
      </div>

      <div className="crm-card">
        <h3>Cadena activa</h3>
        <p>
          ELANPET / CRM CENTRAL → descarga <strong>crm-central.json</strong> → copiar a
          <strong> D:\\ELAN\\LAB\\public</strong> → KAVTORÉ lee datos reales.
        </p>
      </div>

      <div className="crm-card">
        <h3>Contenido incluido en la exportación</h3>
        <div className="mini-grid">
          <span>Empresas: {resumen.empresas}</span>
          <span>Contactos: {resumen.contactos}</span>
          <span>Pedidos: {resumen.pedidos}</span>
          <span>Órdenes: {resumen.ordenesTrabajo}</span>
          <span>Producción: {resumen.produccion}</span>
          <span>Cobros: {resumen.cobros}</span>
          <span>Inventario: {resumen.inventario}</span>
          <span>Materiales: {resumen.materiales}</span>
        </div>
      </div>
    </section>
  );
}
