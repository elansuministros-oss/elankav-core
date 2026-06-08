import React, { createContext, useContext, useMemo, useState } from 'react';

import {
  clientesIniciales,
  empresasIniciales,
  leadsIniciales,
  mensajesWhatsApp,
  operacionesIniciales,
  tareasIA,
  timelineInicial,
  unidadesGrupo,
} from '../data/coreData';

import {
  cargarDatosCRM,
  construirReporteEjecutivo,
  enriquecerConUnidad,
  dinero,
} from './CentralBridge';

const CoreContext = createContext(null);

function usarDatosSeguros(valorReal, valorDemo) {
  return Array.isArray(valorReal) && valorReal.length > 0 ? valorReal : valorDemo;
}

export function CoreProvider({ children }) {
  const [unidadActiva, setUnidadActiva] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [vistaActiva, setVistaActiva] = useState('dashboard');

  const data = useMemo(() => {
    let crm = {};

    try {
      crm = cargarDatosCRM?.() || {};
    } catch (error) {
      console.warn('CRM CENTRAL no disponible. Usando datos demo de coreData.js.', error);
      crm = {};
    }

    const empresasBase = usarDatosSeguros(crm.empresas, empresasIniciales);
    const clientesBase = usarDatosSeguros(crm.clientes, clientesIniciales);
    const leadsBase = usarDatosSeguros(crm.leads, leadsIniciales);
    const mensajesBase = usarDatosSeguros(crm.mensajes, mensajesWhatsApp);
    const operacionesBase = usarDatosSeguros(crm.operaciones, operacionesIniciales);
    const timelineBase = usarDatosSeguros(crm.timeline, timelineInicial);

    const operaciones = enriquecerConUnidad(operacionesBase, unidadesGrupo);
    const leads = enriquecerConUnidad(leadsBase, unidadesGrupo);
    const mensajes = enriquecerConUnidad(mensajesBase, unidadesGrupo);
    const clientes = enriquecerConUnidad(clientesBase, unidadesGrupo);
    const empresas = enriquecerConUnidad(empresasBase, unidadesGrupo);
    const timeline = enriquecerConUnidad(timelineBase, unidadesGrupo);

    const reporte = construirReporteEjecutivo({
      unidades: unidadesGrupo,
      operaciones: operacionesBase,
      leads: leadsBase,
      mensajes: mensajesBase,
      empresas: empresasBase,
      clientes: clientesBase,
      crm,
    });

    return {
      unidades: unidadesGrupo,
      operaciones,
      leads,
      mensajes,
      clientes,
      empresas,
      timeline,
      tareasIA,
      reporte,
      crm,
      fuenteDatos: Object.keys(crm || {}).length > 0 ? 'CRM CENTRAL' : 'DEMO CORE',
    };
  }, []);

  const aplicarFiltros = (items = [], campos = []) => {
    return items.filter((item) => {
      const coincideUnidad = unidadActiva === 'todas' || item.unidadId === unidadActiva;

      const texto = campos
        .map((campo) => item?.[campo] || '')
        .join(' ')
        .toLowerCase();

      const coincideBusqueda = texto.includes(busqueda.toLowerCase());

      return coincideUnidad && coincideBusqueda;
    });
  };

  const value = {
    ...data,
    unidadActiva,
    setUnidadActiva,
    busqueda,
    setBusqueda,
    vistaActiva,
    setVistaActiva,
    aplicarFiltros,
    dinero,
  };

  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

export function useCore() {
  const context = useContext(CoreContext);

  if (!context) {
    throw new Error('useCore debe usarse dentro de CoreProvider');
  }

  return context;
}