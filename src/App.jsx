import { useMemo, useState } from 'react';
import CentroIA from './pages/CentroIA';
import TestSupabase from './pages/TestSupabase';
import AI23CentroCostos from './pages/AI23CentroCostos';
import { cargarDatosCRM, calcularEstadoGlobal, construirReporteEjecutivo } from './core/CentralBridge';
import './App.css';

const MODULOS = [
  { id: 'ia', titulo: 'Centro IA', detalle: 'Preguntar y decidir' },
  { id: 'operacion', titulo: 'Operación', detalle: 'Pedidos y cobros' },
  { id: 'whatsapp', titulo: 'WhatsApp', detalle: 'Leads y seguimiento' },
  { id: 'reportes', titulo: 'Reportes', detalle: 'Estado ejecutivo' },
  { id: 'ai23', titulo: 'AI-23 Costos', detalle: 'Centro de Costos' },
  { id: 'admin', titulo: 'Administrador', detalle: 'Seguridad y sistema' },
];

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('kavtore_token') || '');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [modulo, setModulo] = useState('ia');

  const datosCore = useMemo(() => cargarDatosCRM(), []);
  const estadoGlobal = useMemo(() => calcularEstadoGlobal(datosCore), [datosCore]);
  const reporteEjecutivo = useMemo(() => construirReporteEjecutivo(datosCore), [datosCore]);

  const moduloActivo = MODULOS.find((item) => item.id === modulo) || MODULOS[0];

  const ingresar = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) throw new Error(data.error || 'Acceso denegado.');

      sessionStorage.setItem('kavtore_token', data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  const salir = () => {
    sessionStorage.removeItem('kavtore_token');
    setToken('');
    setClave('');
    setMenu(false);
    setModulo('ia');
  };

  const abrirModulo = (id) => {
    setModulo(id);
    setMenu(false);
  };

  if (!token) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={ingresar}>
          <span>ELAN KAVTORÉ OS</span>
          <h1>Administrador</h1>
          <p>Acceso privado personal.</p>

          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Usuario" />
          <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Contraseña" type="password" />

          {error && <strong>{error}</strong>}

          <button type="submit">Ingresar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="kavtore-app">
      <header className="app-topbar">
        <button className="hamburger-btn" type="button" onClick={() => setMenu(true)} aria-label="Abrir menú">
          <i></i><i></i><i></i>
        </button>

        <div>
          <strong>ELAN KAVTORÉ</strong>
          <small>{moduloActivo.titulo}</small>
        </div>
      </header>

      {menu && (
        <section className="menu-layer">
          <button className="menu-backdrop" type="button" onClick={() => setMenu(false)} aria-label="Cerrar menú" />

          <nav className="menu-panel">
            <div className="menu-head">
              <strong>Menú</strong>
              <small>Administrador</small>
            </div>

            {MODULOS.map((item) => (
              <button
                key={item.id}
                className={modulo === item.id ? 'menu-item activo' : 'menu-item'}
                type="button"
                onClick={() => abrirModulo(item.id)}
              >
                <strong>{item.titulo}</strong>
                <span>{item.detalle}</span>
              </button>
            ))}

            <button className="menu-item salir" type="button" onClick={salir}>
              <strong>Cerrar sesión</strong>
              <span>Bloquear acceso</span>
            </button>
          </nav>
        </section>
      )}

      {modulo === 'ia' && (
        <CentroIA
          authToken={token}
          datosCore={datosCore}
          estadoGlobal={estadoGlobal}
          reporteEjecutivo={reporteEjecutivo}
        />
      )}

      {modulo === 'ai23' && (
        <AI23CentroCostos />
      )}

      {modulo === 'admin' && (
        <section className="module-card admin-module">
          <span>Administrador</span>
          <h2>Seguridad del sistema</h2>
          <p>La contraseña actual se cambia en Vercel por seguridad.</p>

          <TestSupabase />

          <div className="admin-grid">
            <article>
              <strong>Cambiar contraseña</strong>
              <p>Editar variable KAVTORE_ADMIN_PASS en Vercel y hacer Redeploy.</p>
            </article>

            <article>
              <strong>OpenAI</strong>
              <p>Conexión lista. Pendiente crédito API.</p>
            </article>

            <article>
              <strong>Supabase</strong>
              <p>Conectado al CRM central.</p>
            </article>

            <article>
              <strong>App móvil</strong>
              <p>PWA activa para Android y iPhone.</p>
            </article>
          </div>
        </section>
      )}

      {modulo !== 'ia' && modulo !== 'admin' && (
        <section className="module-card">
          <span>{moduloActivo.titulo}</span>
          <h2>{moduloActivo.titulo}</h2>
          <p>Este módulo está reservado para activación en la siguiente fase.</p>
        </section>
      )}
    </main>
  );
}

