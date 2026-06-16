import { useMemo, useState } from 'react';
import { responderELANAI, analizarCRM } from '../ai/ElanAIEngine';

export default function CentroIA({ datosCore, estadoGlobal, reporteEjecutivo }) {
  const [pregunta, setPregunta] = useState('');
  const [cargandoIA, setCargandoIA] = useState(false);
  const [respuesta, setRespuesta] = useState(
    'Hola Erick. Soy ELAN AI conectado a KAVTORÉ. Puedo analizar el CRM CENTRAL y ayudarte a decidir qué atender primero.'
  );

  const analisis = useMemo(
    () => analizarCRM(datosCore, estadoGlobal),
    [datosCore, estadoGlobal]
  );

  const consultasRapidas = [
    '¿Qué debo atender hoy?',
    '¿Cuánto hay por cobrar?',
    '¿Qué pedidos están pendientes?',
    '¿Qué empresas están activas?',
    '¿Cómo está producción?',
    '¿Cómo está inventario?',
    '¿Cómo están los proveedores?',
  ];

  const consultar = async (consultaManual) => {
    const consulta = consultaManual || pregunta;

    if (!consulta.trim()) {
      setRespuesta('Escribí una consulta para que KAVTORÉ pueda analizarla.');
      return;
    }

    setPregunta(consulta);
    setCargandoIA(true);
    setRespuesta('Consultando GPT conectado a KAVTORÉ...');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pregunta: consulta,
          datos: {
            datosCore,
            estadoGlobal,
            reporteEjecutivo,
            analisis,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo consultar OpenAI.');
      }

      setRespuesta(data.respuesta || 'KAVTORÉ no devolvió respuesta.');
    } catch (error) {
      console.error('Error consultando OpenAI:', error);
      setRespuesta(
        responderELANAI(consulta, datosCore, estadoGlobal, reporteEjecutivo)
      );
    } finally {
      setCargandoIA(false);
    }
  };

  return (
    <section className="ia-panel">
      <div className="ia-header">
        <span>ELAN AI · Inteligencia operativa</span>
        <h2>Centro IA KAVTORÉ</h2>
        <p>
          Analiza empresas, pedidos, cobros, producción, inventario y proveedores desde el CRM CENTRAL.
        </p>
      </div>

      <div className="metricas-grid">
        <div className="metrica-card">
          <span>Pedidos visibles</span>
          <strong>{analisis.pedidos.length}</strong>
        </div>

        <div className="metrica-card">
          <span>Pendiente por cobrar</span>
          <strong>C${analisis.pendienteCobro.toLocaleString('es-NI')}</strong>
        </div>

        <div className="metrica-card">
          <span>Empresas activas</span>
          <strong>{analisis.empresasActivas.length}</strong>
        </div>
      </div>

      <div className="ia-acciones">
        {consultasRapidas.map((item) => (
          <button key={item} type="button" onClick={() => consultar(item)} disabled={cargandoIA}>
            {item}
          </button>
        ))}
      </div>

      <div className="ia-consulta">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Preguntá algo a KAVTORÉ..."
        />
        <button type="button" onClick={() => consultar()} disabled={cargandoIA}>
          {cargandoIA ? 'Consultando...' : 'Consultar IA'}
        </button>
      </div>

      <div className="ia-respuesta">
        <strong>Respuesta ejecutiva:</strong>
        <p>{respuesta}</p>
      </div>
    </section>
  );
}
