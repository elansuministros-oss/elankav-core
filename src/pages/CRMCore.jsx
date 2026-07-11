import { useEffect, useMemo, useState } from 'react';

const EMPTY_FORM = {
  displayName: '',
  canonicalId: '',
  entityType: 'client'
};

function StatusBadge({ status }) {
  const label = status === 'READY'
    ? 'Operativo'
    : status === 'MIGRATION_PENDING'
      ? 'Migración pendiente'
      : 'Sin conexión';

  return <span className={`crm-status crm-status-${String(status || 'error').toLowerCase()}`}>{label}</span>;
}

export default function CRMCore({ authToken }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('LOADING');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`
  }), [authToken]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/crm', { headers });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatus(payload.status || 'ERROR');
        throw new Error(payload.error || 'No fue posible consultar el CRM.');
      }
      setData(payload);
      setStatus(payload.status || 'READY');
    } catch (err) {
      setError(err.message);
      if (status === 'LOADING') setStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const createContact = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setCreated(null);

    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatus(payload.status || 'ERROR');
        throw new Error(payload.error || 'No fue posible crear el contacto.');
      }
      setCreated(payload.identity);
      setForm(EMPTY_FORM);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="crm-core module-card">
      <div className="crm-heading">
        <div>
          <span>CRM Core</span>
          <h2>Centro de contactos y conversaciones</h2>
          <p>Fuente central para ELANVISUAL, ELANHOME, ELANPET, ELANCENTER y futuras plataformas.</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="crm-actions">
        <button type="button" onClick={loadDashboard} disabled={loading}>
          {loading ? 'Validando…' : 'Validar conexión'}
        </button>
        <small>Versión CRM-001B · Acceso privado con token de administrador</small>
      </div>

      {error && (
        <div className="crm-alert">
          <strong>No se pudo validar el CRM.</strong>
          <p>{error}</p>
          {status === 'MIGRATION_PENDING' && <p>La interfaz está lista, pero falta aplicar la migración CRM en Supabase.</p>}
        </div>
      )}

      <div className="crm-metrics">
        <article><span>Identidades</span><strong>{data?.counts?.identities ?? '—'}</strong></article>
        <article><span>Conversaciones</span><strong>{data?.counts?.conversations ?? '—'}</strong></article>
        <article><span>Mensajes</span><strong>{data?.counts?.messages ?? '—'}</strong></article>
        <article><span>Estado</span><strong>{status}</strong></article>
      </div>

      <div className="crm-grid">
        <form className="crm-form" onSubmit={createContact}>
          <h3>Crear contacto de prueba</h3>
          <label>
            Nombre
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Ej. Cliente de prueba"
              required
            />
          </label>
          <label>
            Identificador canónico
            <input
              value={form.canonicalId}
              onChange={(event) => setForm({ ...form, canonicalId: event.target.value })}
              placeholder="Teléfono, correo o ID"
              required
            />
          </label>
          <label>
            Tipo
            <select
              value={form.entityType}
              onChange={(event) => setForm({ ...form, entityType: event.target.value })}
            >
              <option value="client">Cliente</option>
              <option value="supplier">Proveedor</option>
              <option value="seller">Vendedor</option>
              <option value="employee">Empleado</option>
              <option value="owner">Propietario</option>
            </select>
          </label>
          <button type="submit" disabled={loading || status !== 'READY'}>Crear y comprobar persistencia</button>
          {created && <p className="crm-success">Guardado en Supabase: {created.display_name}</p>}
        </form>

        <section className="crm-list">
          <div className="crm-list-head">
            <h3>Identidades recientes</h3>
            <span>{data?.identities?.length || 0} registros</span>
          </div>
          {!data?.identities?.length && <p className="crm-empty">Aún no hay identidades visibles.</p>}
          {data?.identities?.map((identity) => (
            <article key={identity.id}>
              <div>
                <strong>{identity.display_name || 'Sin nombre'}</strong>
                <small>{identity.canonical_id}</small>
              </div>
              <span>{identity.entity_type}</span>
            </article>
          ))}
        </section>
      </div>

      <section className="crm-table-block">
        <div className="crm-list-head">
          <h3>Conversaciones recientes</h3>
          <span>{data?.conversations?.length || 0} registros</span>
        </div>
        {!data?.conversations?.length ? (
          <p className="crm-empty">Todavía no hay conversaciones conectadas.</p>
        ) : (
          <div className="crm-table">
            {data.conversations.map((conversation) => (
              <article key={conversation.id}>
                <strong>{conversation.platform || 'sin plataforma'}</strong>
                <span>{conversation.channel}</span>
                <span>{conversation.stage}</span>
                <span>{conversation.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
