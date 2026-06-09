import { useMemo } from 'react';
import OperacionesCentrales from './OperacionesCentrales';
import CentroIA from './pages/CentroIA';
import CentroWhatsAppIA from './pages/CentroWhatsAppIA';

import {
  cargarDatosCRM,
  calcularEstadoGlobal,
  construirReporteEjecutivo,
  dinero,
} from './core/CentralBridge';

export default function App() {
  const datosCore = useMemo(() => cargarDatosCRM(), []);

  const estadoGlobal = useMemo(
    () => calcularEstadoGlobal(datosCore),
    [datosCore]
  );

  const reporteEjecutivo = useMemo(
    () => construirReporteEjecutivo(datosCore),
    [datosCore]
  );

  return (
    <div className="app">
      <div className="core-shell">
        <div className="core-hero">
          <span className="core-badge">
            CentralBridge activo · ELAN KAVTORÉ OS
          </span>

          <h1>ELAN KAVTORÉ</h1>

          <p>
            Asistente operativo inteligente de ELANKAV. Lee el CRM CENTRAL por
            medio de CentralBridge y convierte operaciones, clientes, leads,
            proveedores y reportes en decisiones ejecutivas.
          </p>

          <div className="metricas-grid">
            <div className="metrica-card">
              <span>Operaciones</span>
              <strong>{estadoGlobal.operaciones}</strong>
            </div>

            <div className="metrica-card">
              <span>Empresas</span>
              <strong>{estadoGlobal.empresas}</strong>
            </div>

            <div className="metrica-card">
              <span>Ingresos visibles</span>
              <strong>{dinero(estadoGlobal.ingresosVisibles)}</strong>
            </div>
          </div>
        </div>

        <CentroIA
          datosCore={datosCore}
          estadoGlobal={estadoGlobal}
          reporteEjecutivo={reporteEjecutivo}
        />

        <CentroWhatsAppIA />

        <OperacionesCentrales
          datosCore={datosCore}
          estadoGlobal={estadoGlobal}
          reporteEjecutivo={reporteEjecutivo}
        />
      </div>
    </div>
  );
}