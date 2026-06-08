import { useMemo } from 'react';
import OperacionesCentrales from './OperacionesCentrales';
import {
  cargarDatosCRM,
  calcularEstadoGlobal,
  construirReporteEjecutivo,
} from './core/CentralBridge';

export default function App() {
  const datosCore = useMemo(() => cargarDatosCRM(), []);
  const estadoGlobal = useMemo(() => calcularEstadoGlobal(datosCore), [datosCore]);
  const reporteEjecutivo = useMemo(
    () => construirReporteEjecutivo(datosCore),
    [datosCore]
  );

  return (
    <div className="app">
      <div className="core-shell">
        <div className="core-hero">
          <span className="core-badge">CentralBridge activo</span>
          <h1>ELANKAV CORE</h1>
          <p>Consola ejecutiva conectada al CRM CENTRAL vía LocalStorage.</p>

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
              <strong>
                C$ {estadoGlobal.ingresosVisibles.toLocaleString('es-NI')}
              </strong>
            </div>
          </div>
        </div>

        <OperacionesCentrales
          datosCore={datosCore}
          estadoGlobal={estadoGlobal}
          reporteEjecutivo={reporteEjecutivo}
        />
      </div>
    </div>
  );
}