import { useMemo, useState } from 'react';
import { responderELANAI, analizarCRM } from '../ai/ElanAIEngine';

export default function CentroIA({ authToken, datosCore, estadoGlobal, reporteEjecutivo }) {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState('');

  const analisis = useMemo(() => analizarCRM(datosCore, estadoGlobal), [datosCore, estadoGlobal]);

  const pedidos = analisis?.pedidos || [];
  const empresas = analisis?.empresasActivas || [];
  const pendienteCobro = Number(analisis?.pendienteCobro || 0);

  const consultar = async (texto = '') => {
    const consulta = (texto || pregunta).trim();

    if (!consulta) {
      setAviso('Escribí una consulta.');
      return;
    }

    setPregunta(consulta);
    setCargando(true);
    setAviso('');
    setRespuesta('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          pregunta: consulta,
          datos: {
            estadoGlobal,
            reporteEjecutivo,
            analisis,
            resumen: {
              pedidos: pedidos.length,
              empresas: empresas.length,
              pendienteCobro,
            },
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo consultar KAVTORÉ.');
      }

      setRespuesta(data.respuesta || 'KAVTORÉ no devolvió respuesta.');
    } catch (error) {
      setAviso('OpenAI no respondió. Activé análisis local.');
      setRespuesta(responderELANAI(consulta, datosCore, estadoGlobal, reporteEjecutivo));
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="ia-mobile">
      <section className="ask-card">
        <span>Centro IA</span>
        <h1>¿Qué necesitás analizar?</h1>

        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ejemplo: Qué debo atender hoy..."
          rows={4}
        />

        <button type="button" onClick={() => consultar()} disabled={cargando}>
          {cargando ? 'Analizando...' : 'Analizar'}
        </button>
      </section>

      {aviso && <div className="notice-card">{aviso}</div>}

      <section className="answer-card">
        <span>Respuesta KAVTORÉ</span>
        <div>{respuesta || 'Esperando consulta.'}</div>
      </section>

      <section className="quick-grid">
        <button type="button" onClick={() => consultar('Qué debo atender hoy')} disabled={cargando}>Atender hoy</button>
        <button type="button" onClick={() => consultar('Qué pedidos están pendientes')} disabled={cargando}>Pedidos</button>
        <button type="button" onClick={() => consultar('Cuánto hay por cobrar')} disabled={cargando}>Cobros</button>
        <button type="button" onClick={() => consultar('Qué riesgo ves en la operación')} disabled={cargando}>Riesgos</button>
      </section>

      <section className="mini-state">
        <article><span>Pedidos</span><strong>{pedidos.length}</strong></article>
        <article><span>Cobros</span><strong>C${pendienteCobro.toLocaleString('es-NI')}</strong></article>
        <article><span>Empresas</span><strong>{empresas.length}</strong></article>
      </section>
    </section>
  );
}
