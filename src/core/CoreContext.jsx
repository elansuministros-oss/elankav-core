import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

function parsearValor(valor) {
  if (typeof valor !== 'string') return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

function normalizarCRMJson(json = {}) {
  const base = { ...json };

  return {
    empresas: parsearValor(base.empresas || base.elankav_empresas || []),
    contactos: parsearValor(base.contactos || base.elankav_contactos || []),
    clientes: parsearValor(base.clientes || base.elankav_clientes || []),
    cotizaciones: parsearValor(base.cotizaciones || base.elankav_cotizaciones || []),
    pedidos: parsearValor(base.pedidos || base.elankav_pedidos || []),
    ordenesTrabajo: parsearValor(base.ordenesTrabajo || base.elankav_ordenes_trabajo || []),
    produccion: parsearValor(base.produccion || base.elankav_produccion || []),
    cobros: parsearValor(base.cobros || base.elankav_cobros || []),
    comisiones: parsearValor(base.comisiones || base.elankav_comisiones || []),
    inventario: parsearValor(base.inventario || base.elankav_inventario || []),
    materiales: parsearValor(base.materiales || base.elankav_materiales || []),
    proveedores: parsearValor(base.proveedores || base.elankav_proveedores || []),
    compras: parsearValor(base.compras || base.elankav_compras || []),
    cuentasPorCobrar: parsearValor(base.cuentasPorCobrar || base.elankav_cuentas_por_cobrar || []),
    cuentasPorPagar: parsearValor(base.cuentasPorPagar || base.elankav_cuentas_por_pagar || []),

    leads: parsearValor(
      base.leads ||
        base.leadsWhatsApp ||
        base.elankav_leads_whatsapp ||
        []
    ),

    mensajes: parsearValor(base.mensajes || base.elankav_mensajes_whatsapp || []),
    operaciones: parsearValor(base.operaciones || base.elankav_operaciones || []),
    timeline: parsearValor(base.timeline || base.elankav_timeline || []),
  };
}

function tieneDatosCRM(crm = {}) {
  return Object.values(crm).some((valor) => Array.isArray(valor) && valor.length > 0);
}

export function CoreProvider({ children }) {
  const [unidadActiva, setUnidadActiva] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [crmExterno, setCrmExterno] = useState(null);
  const [fuenteExterna, setFuenteExterna] = useState('CARGANDO');

  useEffect(() => {
    let activo = true;

    async function cargarCRMExterno() {
      try {
        const respuesta = await fetch('/api/crm-live', { cache: 'no-store' });

        if (!respuesta.ok) {
          throw new Error('api crm-live no disponible');
        }

        const json = await respuesta.json();
        const normalizado = normalizarCRMJson(json);

        if (activo && tieneDatosCRM(normalizado)) {
          setCrmExterno(normalizado);
          setFuenteExterna('SUPABASE LIVE');
          return;
        }

        if (activo) {
          setCrmExterno(null);
          setFuenteExterna('SUPABASE VACIO');
        }
      } catch (error) {
        console.warn('No se pudo cargar /crm-central.json. Se usarÃ¡ localStorage o demo.', error);

        if (activo) {
          setCrmExterno(null);
          setFuenteExterna('CRM LOCAL / DEMO');
        }
      }
    }

    cargarCRMExterno();

    return () => {
      activo = false;
    };
  }, []);

  const data = useMemo(() => {
    let crmLocal = {};

    try {
      crmLocal = cargarDatosCRM?.() || {};
    } catch (error) {
      console.warn('CRM CENTRAL local no disponible. Usando datos demo de coreData.js.', error);
      crmLocal = {};
    }

    const crm = tieneDatosCRM(crmExterno) ? crmExterno : crmLocal;

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
      fuenteDatos: tieneDatosCRM(crmExterno)
        ? 'CRM CENTRAL JSON'
        : tieneDatosCRM(crmLocal)
          ? 'CRM CENTRAL LOCAL'
          : 'DEMO CORE',
      fuenteExterna,
    };
  }, [crmExterno, fuenteExterna]);

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
