import { useMemo, useState } from 'react';
import CentroIA from './pages/CentroIA';
import { cargarDatosCRM, calcularEstadoGlobal, construirReporteEjecutivo } from './core/CentralBridge';
import './App.css';

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('kavtore_token') || '');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);

  const datosCore = useMemo(() => cargarDatosCRM(), []);
  const estadoGlobal = useMemo(() => calcularEstadoGlobal(datosCore), [datosCore]);
  const reporteEjecutivo = useMemo(() => construirReporteEjecutivo(datosCore), [datosCore]);

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
        <button className="hamburger-btn" type="button" onClick={() => setMenu(true)}>
          <i></i><i></i><i></i>
        </button>
        <div>
          <strong>ELAN KAVTORÉ</strong>
          <small>Centro IA</small>
        </div>
      </header>

      {menu && (
        <section className="menu-layer">
          <button className="menu-backdrop" type="button" onClick={() => setMenu(false)} />
          <nav className="menu-panel">
            <div className="menu-head">
              <strong>Menú</strong>
              <small>Administrador</small>
            </div>

            <button className="menu-item activo" type="button" onClick={() => setMenu(false)}>
              <strong>Centro IA</strong>
              <span>Preguntar y decidir</span>
            </button>

            <button className="menu-item" type="button">
              <strong>Operación</strong>
              <span>Pedidos y cobros</span>
            </button>

            <button className="menu-item" type="button">
              <strong>WhatsApp</strong>
              <span>Leads y seguimiento</span>
            </button>

            <button className="menu-item" type="button">
              <strong>Reportes</strong>
              <span>Estado ejecutivo</span>
            </button>

            <button className="menu-item salir" type="button" onClick={salir}>
              <strong>Cerrar sesión</strong>
              <span>Bloquear acceso</span>
            </button>
          </nav>
        </section>
      )}

      <CentroIA
        authToken={token}
        datosCore={datosCore}
        estadoGlobal={estadoGlobal}
        reporteEjecutivo={reporteEjecutivo}
      />
    </main>
  );
}
