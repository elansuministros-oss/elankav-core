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
  construirReporteEjecutivo,
  enriquecerConUnidad,
  dinero,
} from './CentralBridge';

const CoreContext = createContext(null);

export function CoreProvider({ children }) {
  const [unidadActiva, setUnidadActiva] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [vistaActiva, setVistaActiva] = useState('dashboard');

  const data = useMemo(() => {
    const operaciones = enriquecerConUnidad(operacionesIniciales, unidadesGrupo);
    const leads = enriquecerConUnidad(leadsIniciales, unidadesGrupo);
    const mensajes = enriquecerConUnidad(mensajesWhatsApp, unidadesGrupo);
    const clientes = enriquecerConUnidad(clientesIniciales, unidadesGrupo);
    const empresas = enriquecerConUnidad(empresasIniciales, unidadesGrupo);
    const timeline = enriquecerConUnidad(timelineInicial, unidadesGrupo);
    const reporte = construirReporteEjecutivo({
      unidades: unidadesGrupo,
      operaciones: operacionesIniciales,
      leads: leadsIniciales,
      mensajes: mensajesWhatsApp,
      empresas: empresasIniciales,
      clientes: clientesIniciales,
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
    };
  }, []);

  const aplicarFiltros = (items = [], campos = []) => {
    return items.filter((item) => {
      const coincideUnidad = unidadActiva === 'todas' || item.unidadId === unidadActiva;
      const texto = campos.map((campo) => item[campo] || '').join(' ').toLowerCase();
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
