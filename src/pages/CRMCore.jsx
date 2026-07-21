import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCrmIdentity,
  loadCrmDashboard
} from '../services/crmClientService';
import './CRMCore.css';

const EMPTY_FORM = {
  displayName: '',
  canonicalId: '',
  entityType: 'client'
};

const CRM_SECTIONS = [
  { id: 'summary', label: 'Resumen', icon: 'layout' },
  { id: 'contacts', label: 'Contactos', icon: 'users' },
  { id: 'companies', label: 'Empresas', icon: 'building' },
  { id: 'conversations', label: 'Conversaciones', icon: 'message' },
  { id: 'followup', label: 'Seguimiento', icon: 'target' },
  { id: 'activity', label: 'Actividad', icon: 'activity' },
  { id: 'technical', label: 'Configuración técnica', icon: 'settings' }
];

const BASE_PLATFORMS = [
  { id: 'all', label: 'Todas' },
  { id: 'elanvisual', label: 'ELANVISUAL' },
  { id: 'elanhome', label: 'ELANHOME' },
  { id: 'elanpet', label: 'ELANPET' },
  { id: 'elancenter', label: 'ELANCENTER' },
  { id: 'elan-ai', label: 'ELAN AI' }
];

const PLATFORM_ALIASES = {
  'elan-visual': 'elanvisual',
  'elan-home': 'elanhome',
  'elan-pet': 'elanpet',
  'elan-center': 'elancenter',
  elanai: 'elan-ai'
};

const PLATFORM_LABELS = BASE_PLATFORMS.reduce((labels, platform) => {
  labels[platform.id] = platform.label;
  return labels;
}, {});

const ENTITY_TYPE_LABELS = {
  client: 'Cliente',
  supplier: 'Proveedor',
  seller: 'Vendedor',
  employee: 'Empleado',
  owner: 'Propietario',
  company: 'Empresa',
  business: 'Empresa',
  organization: 'Organización',
  unknown: 'Sin clasificar'
};

const COMPANY_ENTITY_TYPES = new Set([
  'company',
  'business',
  'organization',
  'enterprise',
  'empresa'
]);

const STATUS_DETAILS = {
  READY: {
    label: 'Operativo',
    description: 'El CRM respondió correctamente.',
    icon: 'check'
  },
  MIGRATION_PENDING: {
    label: 'Migración pendiente',
    description: 'La interfaz está lista, pero el backend reporta tablas o relaciones pendientes.',
    icon: 'warning'
  },
  ACCESS_DENIED: {
    label: 'Acceso denegado',
    description: 'El token o las políticas de acceso no permiten consultar el CRM.',
    icon: 'lock'
  },
  CONFIG_PENDING: {
    label: 'Configuración pendiente',
    description: 'Falta configuración de servidor para completar la conexión.',
    icon: 'settings'
  },
  LOADING: {
    label: 'Validando',
    description: 'Consultando el estado actual del CRM.',
    icon: 'loader'
  },
  ERROR: {
    label: 'Sin conexión',
    description: 'No fue posible validar el CRM.',
    icon: 'warning'
  }
};

function normalizeValue(value) {
  return String(value || '').trim();
}

function normalizeSearch(value) {
  return normalizeValue(value).toLowerCase();
}

function normalizePlatform(value) {
  const normalized = normalizeSearch(value).replace(/[\s_]+/g, '-');
  return PLATFORM_ALIASES[normalized] || normalized;
}

function getPlatformLabel(value) {
  const normalized = normalizePlatform(value);
  return PLATFORM_LABELS[normalized] || normalizeValue(value).toUpperCase() || 'Sin plataforma';
}

function getEntityTypeLabel(value) {
  const normalized = normalizeSearch(value);
  return ENTITY_TYPE_LABELS[normalized] || normalizeValue(value) || 'Información no disponible';
}

function getStatusDetails(status) {
  return STATUS_DETAILS[status] || STATUS_DETAILS.ERROR;
}

function getStatusClass(status) {
  return normalizeSearch(status || 'error').replace(/[^a-z0-9]+/g, '-');
}

function formatDateTime(value) {
  if (!value) return 'Información no disponible';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Información no disponible';

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getTimestamp(value) {
  if (!value) return 0;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildDashboardModel(data) {
  const identities = Array.isArray(data?.identities) ? data.identities : [];
  const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];

  const conversationsByIdentity = new Map();
  const messagesByConversation = new Map();

  conversations.forEach((conversation) => {
    if (!conversation?.identity_id) return;
    const current = conversationsByIdentity.get(conversation.identity_id) || [];
    current.push(conversation);
    conversationsByIdentity.set(conversation.identity_id, current);
  });

  messages.forEach((message) => {
    if (!message?.conversation_id) return;
    const current = messagesByConversation.get(message.conversation_id) || [];
    current.push(message);
    messagesByConversation.set(message.conversation_id, current);
  });

  const contacts = identities.map((identity) => {
    const relatedConversations = conversationsByIdentity.get(identity.id) || [];
    const relatedMessages = relatedConversations.flatMap(
      (conversation) => messagesByConversation.get(conversation.id) || []
    );
    const platformIds = [
      ...new Set(
        relatedConversations
          .map((conversation) => normalizePlatform(conversation.platform))
          .filter(Boolean)
      )
    ];
    const timestamps = [
      identity.created_at,
      ...relatedConversations.map((conversation) => conversation.created_at),
      ...relatedMessages.map((message) => message.created_at)
    ].map(getTimestamp).filter(Boolean);
    const lastActivity = timestamps.length ? Math.max(...timestamps) : 0;

    return {
      id: identity.id,
      displayName: identity.display_name || '',
      canonicalId: identity.canonical_id || '',
      entityType: identity.entity_type || '',
      status: identity.status || '',
      metadata: identity.metadata || null,
      createdAt: identity.created_at || '',
      platformIds,
      relatedConversations,
      relatedMessages,
      conversationCount: relatedConversations.length,
      messageCount: relatedMessages.length,
      lastActivity
    };
  });

  const platformSummary = conversations.reduce((summary, conversation) => {
    const platformId = normalizePlatform(conversation.platform);
    if (!platformId) return summary;
    summary[platformId] = (summary[platformId] || 0) + 1;
    return summary;
  }, {});

  const activity = [
    ...identities.map((identity) => ({
      id: `identity-${identity.id}`,
      type: 'Identidad',
      title: identity.display_name || 'Sin nombre',
      description: identity.canonical_id || 'Información no disponible',
      timestamp: identity.created_at,
      sortValue: getTimestamp(identity.created_at)
    })),
    ...conversations.map((conversation) => ({
      id: `conversation-${conversation.id}`,
      type: 'Conversación',
      title: getPlatformLabel(conversation.platform),
      description: [
        conversation.channel,
        conversation.stage,
        conversation.status
      ].filter(Boolean).join(' · ') || 'Información no disponible',
      timestamp: conversation.created_at,
      sortValue: getTimestamp(conversation.created_at)
    })),
    ...messages.map((message) => ({
      id: `message-${message.id}`,
      type: 'Mensaje',
      title: message.direction || 'Sin dirección',
      description: message.status || 'Información no disponible',
      timestamp: message.created_at,
      sortValue: getTimestamp(message.created_at)
    }))
  ].filter((item) => item.sortValue).sort((a, b) => b.sortValue - a.sortValue);

  return {
    contacts,
    conversations,
    messages,
    conversationsByIdentity,
    messagesByConversation,
    platformSummary,
    activity,
    counts: {
      identities: data?.counts?.identities ?? identities.length,
      conversations: data?.counts?.conversations ?? conversations.length,
      messages: data?.counts?.messages ?? messages.length
    }
  };
}

function Icon({ name }) {
  const paths = {
    activity: ['M22 12h-4l-3 8-6-16-3 8H2'],
    arrow: ['M5 12h14', 'M13 5l7 7-7 7'],
    building: ['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-3', 'M9 9h.01', 'M9 13h.01', 'M9 17h.01'],
    check: ['M20 6 9 17l-5-5'],
    chevron: ['M9 18l6-6-6-6'],
    database: ['M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3z', 'M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
    layout: ['M3 5a2 2 0 0 1 2-2h6v18H5a2 2 0 0 1-2-2V5z', 'M13 3h6a2 2 0 0 1 2 2v5h-8V3z', 'M13 12h8v7a2 2 0 0 1-2 2h-6v-9z'],
    loader: ['M21 12a9 9 0 0 1-9 9', 'M3 12a9 9 0 0 1 9-9'],
    lock: ['M6 11V8a6 6 0 0 1 12 0v3', 'M5 11h14v10H5V11z'],
    message: ['M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z'],
    plus: ['M12 5v14', 'M5 12h14'],
    search: ['M21 21l-4.35-4.35', 'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z'],
    settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.07a2 2 0 0 1-2.83 2.83l-.07-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6l-.05.08a2 2 0 0 1-3.9 0L10 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.07.06a2 2 0 0 1-2.83-2.83l.06-.07A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1l-.08-.05a2 2 0 0 1 0-3.9L4 10a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.07a2 2 0 0 1 2.83-2.83l.07.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6l.05-.08a2 2 0 0 1 3.9 0L14 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.07-.06a2 2 0 0 1 2.83 2.83l-.06.07A1.7 1.7 0 0 0 19.4 9c0 .4.21.77.6 1l.08.05a2 2 0 0 1 0 3.9L20 14a1.7 1.7 0 0 0-.6 1z'],
    target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    warning: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
    x: ['M18 6 6 18', 'M6 6l12 12']
  };

  return (
    <svg className="crm-icon" viewBox="0 0 24 24" aria-hidden="true">
      {(paths[name] || paths.layout).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function StatusBadge({ status }) {
  const details = getStatusDetails(status);

  return (
    <span className={`crm-status-badge crm-status-${getStatusClass(status)}`}>
      <Icon name={details.icon} />
      {details.label}
    </span>
  );
}

function CrmHeader({ status, refreshing, onRefresh }) {
  const details = getStatusDetails(status);

  return (
    <header className="crm-header">
      <div className="crm-header-copy">
        <span className="crm-eyebrow">CRM Core</span>
        <h1 id="crm-title">Centro profesional de identidades ELANKAV</h1>
        <p>
          Directorio único para administrar contactos, empresas y conversaciones
          sin duplicar personas por plataforma.
        </p>
      </div>

      <div className="crm-header-actions">
        <StatusBadge status={status} />
        <button
          className="crm-button crm-button-primary"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Icon name="database" />
          {refreshing ? 'Actualizando...' : 'Actualizar datos'}
        </button>
        <small>{details.description}</small>
      </div>
    </header>
  );
}

function CrmSidebar({ activeSection, onChangeSection }) {
  return (
    <aside className="crm-sidebar" aria-label="Navegación interna del CRM">
      <div className="crm-sidebar-brand">
        <span>ELANKAV</span>
        <strong>CRM Core</strong>
      </div>

      <nav className="crm-section-nav">
        {CRM_SECTIONS.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? 'crm-nav-item active' : 'crm-nav-item'}
            type="button"
            onClick={() => onChangeSection(section.id)}
            aria-current={activeSection === section.id ? 'page' : undefined}
          >
            <Icon name={section.icon} />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function CrmPlatformFilter({ platforms, activePlatform, counts, onChange }) {
  return (
    <section className="crm-platform-filter" aria-label="Filtro por plataforma">
      <div>
        <span className="crm-section-kicker">Contexto multiplataforma</span>
        <strong>Filtrar por relación o conversación</strong>
      </div>

      <div className="crm-platform-scroll" role="list">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            className={activePlatform === platform.id ? 'crm-platform-chip active' : 'crm-platform-chip'}
            type="button"
            onClick={() => onChange(platform.id)}
            aria-pressed={activePlatform === platform.id}
          >
            <span>{platform.label}</span>
            <small>{counts[platform.id] ?? 0}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ title, value, description, icon, loading, tone = 'default' }) {
  return (
    <article className={`crm-metric crm-metric-${tone}`} aria-busy={loading}>
      <div className="crm-metric-icon">
        <Icon name={icon} />
      </div>
      <span>{title}</span>
      <strong>{loading ? '...' : value}</strong>
      <p>{description}</p>
    </article>
  );
}

function CrmMetrics({ model, status, loading }) {
  const hasConversationStatus = model.conversations.some((conversation) => conversation.status);
  const activeConversations = model.conversations.filter((conversation) => {
    const value = normalizeSearch(conversation.status);
    return ['open', 'active', 'in-progress', 'in_progress', 'pending'].includes(value);
  }).length;

  const metrics = [
    {
      title: 'Total de identidades',
      value: model.counts.identities,
      description: 'Identidades únicas recibidas desde el servicio.',
      icon: 'users'
    },
    {
      title: 'Total de conversaciones',
      value: model.counts.conversations,
      description: 'Conversaciones recientes disponibles en el dashboard.',
      icon: 'message'
    },
    {
      title: 'Total de mensajes',
      value: model.counts.messages,
      description: 'Mensajes recientes retornados por el backend.',
      icon: 'activity'
    },
    {
      title: 'Estado del CRM',
      value: getStatusDetails(status).label,
      description: status || 'Sin estado reportado.',
      icon: getStatusDetails(status).icon,
      tone: status === 'READY' ? 'success' : 'warning'
    }
  ];

  if (hasConversationStatus) {
    metrics.push({
      title: 'Conversaciones activas',
      value: activeConversations,
      description: 'Calculado solo con el campo status recibido.',
      icon: 'target',
      tone: 'accent'
    });
  }

  return (
    <section className="crm-metrics" aria-label="Indicadores principales">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          {...metric}
          loading={loading}
        />
      ))}
    </section>
  );
}

function CrmNotice({ status, error, loading }) {
  if (loading) {
    return (
      <div className="crm-notice crm-notice-info" role="status">
        <Icon name="loader" />
        <div>
          <strong>Cargando datos reales del CRM.</strong>
          <p>Consultando el servicio existente antes de mostrar la operación.</p>
        </div>
      </div>
    );
  }

  if (!error && status === 'READY') return null;

  const details = getStatusDetails(status);
  const tone = status === 'ACCESS_DENIED' || status === 'ERROR' ? 'danger' : 'warning';

  return (
    <div className={`crm-notice crm-notice-${tone}`} role="alert">
      <Icon name={details.icon} />
      <div>
        <strong>{details.label}</strong>
        <p>{error || details.description}</p>
        {status === 'MIGRATION_PENDING' && (
          <p>La interfaz está lista, pero falta aplicar la migración CRM en Supabase.</p>
        )}
        {status === 'ACCESS_DENIED' && (
          <p>Las tablas pueden existir, pero el token o la política RLS no autoriza la lectura.</p>
        )}
      </div>
    </div>
  );
}

function CrmEmptyState({ title, description, icon = 'database', compact = false }) {
  return (
    <div className={compact ? 'crm-empty-state compact' : 'crm-empty-state'}>
      <Icon name={icon} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ContactBadges({ platformIds }) {
  if (!platformIds.length) {
    return <span className="crm-muted">Sin datos disponibles</span>;
  }

  return (
    <div className="crm-badge-list">
      {platformIds.map((platformId) => (
        <span className="crm-platform-badge" key={platformId}>
          {getPlatformLabel(platformId)}
        </span>
      ))}
    </div>
  );
}

function CrmContactList({
  contacts,
  selectedId,
  onSelect,
  loading,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  sortOrder,
  onSortOrderChange,
  typeOptions,
  platformLabel
}) {
  return (
    <section className="crm-surface crm-directory" aria-labelledby="crm-directory-title">
      <div className="crm-section-head">
        <div>
          <span className="crm-section-kicker">Directorio</span>
          <h2 id="crm-directory-title">Contactos</h2>
          <p>Una identidad puede reunir una o varias relaciones por plataforma.</p>
        </div>
        <strong className="crm-result-count">{contacts.length} resultados</strong>
      </div>

      <div className="crm-directory-controls" aria-label="Filtros del directorio">
        <label className="crm-control" htmlFor="crm-contact-search">
          <span>Buscar</span>
          <div className="crm-input-with-icon">
            <Icon name="search" />
            <input
              id="crm-contact-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Nombre o identificador"
            />
          </div>
        </label>

        <label className="crm-control" htmlFor="crm-contact-type">
          <span>Tipo</span>
          <select
            id="crm-contact-type"
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{getEntityTypeLabel(type)}</option>
            ))}
          </select>
        </label>

        <label className="crm-control" htmlFor="crm-contact-sort">
          <span>Ordenar</span>
          <select
            id="crm-contact-sort"
            value={sortOrder}
            onChange={(event) => onSortOrderChange(event.target.value)}
          >
            <option value="recent">Última actividad</option>
            <option value="name">Nombre</option>
            <option value="type">Tipo</option>
          </select>
        </label>
      </div>

      <div className="crm-filter-summary">
        <span>Plataforma activa: {platformLabel}</span>
      </div>

      {loading ? (
        <CrmEmptyState
          compact
          icon="loader"
          title="Cargando directorio"
          description="Leyendo identidades desde el servicio existente."
        />
      ) : !contacts.length ? (
        <CrmEmptyState
          icon="users"
          title="Sin datos disponibles"
          description="No hay identidades que coincidan con los filtros actuales."
        />
      ) : (
        <div className="crm-directory-table" role="table" aria-label="Directorio de contactos">
          <div className="crm-directory-row crm-directory-header" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">Identificador canónico</span>
            <span role="columnheader">Tipo</span>
            <span role="columnheader">Plataformas</span>
            <span role="columnheader">Última actividad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Acción</span>
          </div>

          {contacts.map((contact) => (
            <div
              key={contact.id}
              className={selectedId === contact.id ? 'crm-directory-row active' : 'crm-directory-row'}
              role="row"
            >
              <div role="cell">
                <span className="crm-cell-label">Nombre</span>
                <strong>{contact.displayName || 'Sin nombre'}</strong>
              </div>
              <div role="cell">
                <span className="crm-cell-label">Identificador</span>
                <span>{contact.canonicalId || 'Información no disponible'}</span>
              </div>
              <div role="cell">
                <span className="crm-cell-label">Tipo</span>
                <span>{getEntityTypeLabel(contact.entityType)}</span>
              </div>
              <div role="cell">
                <span className="crm-cell-label">Plataformas</span>
                <ContactBadges platformIds={contact.platformIds} />
              </div>
              <div role="cell">
                <span className="crm-cell-label">Última actividad</span>
                <span>{contact.lastActivity ? formatDateTime(contact.lastActivity) : 'Información no disponible'}</span>
              </div>
              <div role="cell">
                <span className="crm-cell-label">Estado</span>
                <span>{contact.status || 'Información no disponible'}</span>
              </div>
              <div role="cell" className="crm-row-action">
                <button
                  className="crm-button crm-button-secondary"
                  type="button"
                  onClick={() => onSelect(contact.id)}
                >
                  Abrir
                  <Icon name="chevron" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CrmContactPanel({ contact, onClose }) {
  return (
    <aside className="crm-surface crm-contact-panel" aria-labelledby="crm-contact-panel-title">
      <div className="crm-panel-head">
        <div>
          <span className="crm-section-kicker">Detalle</span>
          <h2 id="crm-contact-panel-title">Contacto seleccionado</h2>
        </div>
        <button
          className="crm-icon-button"
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle de contacto"
          disabled={!contact}
        >
          <Icon name="x" />
        </button>
      </div>

      {!contact ? (
        <CrmEmptyState
          compact
          icon="users"
          title="Seleccioná un contacto"
          description="El detalle se abre sin abandonar el directorio."
        />
      ) : (
        <div className="crm-detail-stack">
          <div className="crm-contact-hero">
            <strong>{contact.displayName || 'Sin nombre'}</strong>
            <span>{contact.canonicalId || 'Información no disponible'}</span>
          </div>

          <dl className="crm-detail-list">
            <div>
              <dt>Tipo de entidad</dt>
              <dd>{getEntityTypeLabel(contact.entityType)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{contact.status || 'Información no disponible'}</dd>
            </div>
            <div>
              <dt>Última actividad</dt>
              <dd>{contact.lastActivity ? formatDateTime(contact.lastActivity) : 'Información no disponible'}</dd>
            </div>
            <div>
              <dt>Plataformas relacionadas</dt>
              <dd><ContactBadges platformIds={contact.platformIds} /></dd>
            </div>
          </dl>

          <section className="crm-panel-section">
            <h3>Conversaciones relacionadas</h3>
            {!contact.relatedConversations.length ? (
              <p className="crm-muted">Sin datos disponibles</p>
            ) : (
              <div className="crm-mini-list">
                {contact.relatedConversations.map((conversation) => (
                  <article key={conversation.id}>
                    <span className="crm-platform-badge">{getPlatformLabel(conversation.platform)}</span>
                    <strong>{conversation.channel || 'Canal no disponible'}</strong>
                    <small>{conversation.status || 'Información no disponible'}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="crm-panel-section">
            <h3>Actividad disponible</h3>
            <p>
              {contact.messageCount
                ? `${contact.messageCount} mensajes recientes vinculados por conversaciones.`
                : 'Información no disponible'}
            </p>
          </section>

          <details className="crm-technical-details">
            <summary>Datos técnicos secundarios</summary>
            <dl>
              <div>
                <dt>Identificador interno</dt>
                <dd>{contact.id || 'Información no disponible'}</dd>
              </div>
              <div>
                <dt>Fecha de creación</dt>
                <dd>{formatDateTime(contact.createdAt)}</dd>
              </div>
            </dl>
          </details>
        </div>
      )}
    </aside>
  );
}

function CrmConversationList({ conversations, identityById, loading, platformLabel }) {
  return (
    <section className="crm-surface crm-conversations" aria-labelledby="crm-conversations-title">
      <div className="crm-section-head">
        <div>
          <span className="crm-section-kicker">Operación</span>
          <h2 id="crm-conversations-title">Conversaciones recientes</h2>
          <p>Se muestran únicamente conversaciones reales devueltas por el backend.</p>
        </div>
        <strong className="crm-result-count">{conversations.length} registros</strong>
      </div>

      <div className="crm-filter-summary">
        <span>Plataforma activa: {platformLabel}</span>
      </div>

      {loading ? (
        <CrmEmptyState
          compact
          icon="loader"
          title="Cargando conversaciones"
          description="Validando información reciente del CRM."
        />
      ) : !conversations.length ? (
        <CrmEmptyState
          icon="message"
          title="Sin datos disponibles"
          description="No hay conversaciones visibles para este contexto."
        />
      ) : (
        <div className="crm-conversation-list">
          {conversations.map((conversation) => {
            const identity = identityById.get(conversation.identity_id);

            return (
              <article key={conversation.id}>
                <div>
                  <span className="crm-platform-badge">{getPlatformLabel(conversation.platform)}</span>
                  <strong>{identity?.displayName || 'Identidad no disponible'}</strong>
                  <small>{conversation.channel || 'Canal no disponible'}</small>
                </div>
                <dl>
                  <div>
                    <dt>Etapa</dt>
                    <dd>{conversation.stage || 'Información no disponible'}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{conversation.status || 'Información no disponible'}</dd>
                  </div>
                  <div>
                    <dt>Creación</dt>
                    <dd>{formatDateTime(conversation.created_at)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CrmPlatformDistribution({ platformSummary }) {
  const entries = Object.entries(platformSummary)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="crm-surface crm-distribution" aria-labelledby="crm-distribution-title">
      <div className="crm-section-head compact">
        <div>
          <span className="crm-section-kicker">Distribución</span>
          <h2 id="crm-distribution-title">Plataformas en conversaciones</h2>
          <p>Conteo calculado solo con `conversations.platform`.</p>
        </div>
      </div>

      {!entries.length ? (
        <CrmEmptyState
          compact
          icon="database"
          title="Sin datos disponibles"
          description="El dashboard actual no permite distribuir identidades por plataforma."
        />
      ) : (
        <div className="crm-distribution-list">
          {entries.map(([platformId, total]) => (
            <article key={platformId}>
              <span>{getPlatformLabel(platformId)}</span>
              <strong>{total}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CrmActivityList({ activity }) {
  return (
    <section className="crm-surface" aria-labelledby="crm-activity-title">
      <div className="crm-section-head">
        <div>
          <span className="crm-section-kicker">Actividad</span>
          <h2 id="crm-activity-title">Actividad reciente</h2>
          <p>Eventos construidos solo desde identidades, conversaciones y mensajes recibidos.</p>
        </div>
        <strong className="crm-result-count">{activity.length} eventos</strong>
      </div>

      {!activity.length ? (
        <CrmEmptyState
          icon="activity"
          title="Sin datos disponibles"
          description="No hay fechas de actividad en el contrato actual."
        />
      ) : (
        <div className="crm-activity-list">
          {activity.map((event) => (
            <article key={event.id}>
              <span>{event.type}</span>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
              <small>{formatDateTime(event.timestamp)}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CrmCompaniesSection({ companies }) {
  return (
    <section className="crm-surface" aria-labelledby="crm-companies-title">
      <div className="crm-section-head">
        <div>
          <span className="crm-section-kicker">Empresas</span>
          <h2 id="crm-companies-title">Directorio de empresas</h2>
          <p>Preparado para perfiles empresariales sin duplicar identidades personales.</p>
        </div>
        <strong className="crm-result-count">{companies.length} registros</strong>
      </div>

      {!companies.length ? (
        <CrmEmptyState
          icon="building"
          title="Sin datos disponibles"
          description="loadCrmDashboard() no devuelve todavía perfiles o relaciones de empresa suficientes para esta vista."
        />
      ) : (
        <div className="crm-simple-list">
          {companies.map((company) => (
            <article key={company.id}>
              <strong>{company.displayName || 'Sin nombre'}</strong>
              <span>{company.canonicalId || 'Información no disponible'}</span>
              <ContactBadges platformIds={company.platformIds} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CrmSystemStatus({ status, data, error, refreshing, onRefresh }) {
  const details = getStatusDetails(status);

  return (
    <section className="crm-surface crm-system-status" aria-labelledby="crm-system-title">
      <div className="crm-section-head">
        <div>
          <span className="crm-section-kicker">Diagnóstico técnico</span>
          <h2 id="crm-system-title">Estado del sistema</h2>
          <p>Información separada de la operación diaria del CRM.</p>
        </div>
        <button
          className="crm-button crm-button-primary"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Icon name="database" />
          {refreshing ? 'Validando...' : 'Validar conexión'}
        </button>
      </div>

      <div className="crm-system-grid">
        <article>
          <span>Estado real</span>
          <strong>{status || 'ERROR'}</strong>
          <p>{details.description}</p>
        </article>
        <article>
          <span>Versión CRM</span>
          <strong>{data?.version || 'Información no disponible'}</strong>
          <p>Valor devuelto por loadCrmDashboard().</p>
        </article>
        <article>
          <span>Flujo</span>
          <strong>UI → Service → Adapter/API → Supabase</strong>
          <p>La interfaz mantiene los servicios existentes.</p>
        </article>
      </div>

      <div className="crm-system-messages">
        {error ? (
          <div className="crm-notice crm-notice-danger" role="alert">
            <Icon name="warning" />
            <div>
              <strong>Mensaje técnico</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div className="crm-notice crm-notice-success" role="status">
            <Icon name="check" />
            <div>
              <strong>Estado operativo</strong>
              <p>No hay errores técnicos reportados por la última consulta.</p>
            </div>
          </div>
        )}

        {status === 'MIGRATION_PENDING' && (
          <div className="crm-notice crm-notice-warning" role="status">
            <Icon name="warning" />
            <div>
              <strong>Migración pendiente</strong>
              <p>El backend reporta tablas, relaciones o columnas no disponibles.</p>
            </div>
          </div>
        )}

        {status === 'ACCESS_DENIED' && (
          <div className="crm-notice crm-notice-danger" role="status">
            <Icon name="lock" />
            <div>
              <strong>Acceso denegado</strong>
              <p>Revisar token de administrador o política RLS desde la configuración segura correspondiente.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CrmContactForm({
  form,
  onChange,
  onSubmit,
  submitting,
  status,
  created,
  formError,
  attempted
}) {
  const disabled = submitting || status !== 'READY';
  const displayNameInvalid = attempted && !normalizeValue(form.displayName);
  const canonicalIdInvalid = attempted && !normalizeValue(form.canonicalId);

  return (
    <form className="crm-surface crm-form" onSubmit={onSubmit} noValidate>
      <div className="crm-section-head compact">
        <div>
          <span className="crm-section-kicker">Alta manual</span>
          <h2>Nuevo contacto</h2>
          <p>Crear una identidad única sin asociarla todavía a plataformas.</p>
        </div>
      </div>

      <label className="crm-control" htmlFor="crm-display-name">
        <span>Nombre</span>
        <input
          id="crm-display-name"
          value={form.displayName}
          onChange={(event) => onChange({ ...form, displayName: event.target.value })}
          placeholder="Ej. Carlos López"
          required
          aria-invalid={displayNameInvalid}
          aria-describedby={displayNameInvalid ? 'crm-display-name-error' : 'crm-display-name-help'}
        />
        <small id="crm-display-name-help">Nombre visible de la identidad central.</small>
        {displayNameInvalid && (
          <strong id="crm-display-name-error" className="crm-field-error">El nombre es obligatorio.</strong>
        )}
      </label>

      <label className="crm-control" htmlFor="crm-canonical-id">
        <span>Identificador canónico</span>
        <input
          id="crm-canonical-id"
          value={form.canonicalId}
          onChange={(event) => onChange({ ...form, canonicalId: event.target.value })}
          placeholder="Teléfono, correo o ID externo"
          required
          aria-invalid={canonicalIdInvalid}
          aria-describedby={canonicalIdInvalid ? 'crm-canonical-id-error' : 'crm-canonical-id-help'}
        />
        <small id="crm-canonical-id-help">Clave única actual aceptada por createCrmIdentity().</small>
        {canonicalIdInvalid && (
          <strong id="crm-canonical-id-error" className="crm-field-error">El identificador es obligatorio.</strong>
        )}
      </label>

      <label className="crm-control" htmlFor="crm-entity-type">
        <span>Tipo</span>
        <select
          id="crm-entity-type"
          value={form.entityType}
          onChange={(event) => onChange({ ...form, entityType: event.target.value })}
        >
          <option value="client">Cliente</option>
          <option value="supplier">Proveedor</option>
          <option value="seller">Vendedor</option>
          <option value="employee">Empleado</option>
          <option value="owner">Propietario</option>
        </select>
      </label>

      <div className="crm-form-note">
        La relación con plataformas se administrará cuando el servicio correspondiente esté disponible.
      </div>

      {created && (
        <div className="crm-notice crm-notice-success" role="status">
          <Icon name="check" />
          <div>
            <strong>Contacto creado</strong>
            <p>{created.display_name || 'La identidad fue guardada correctamente.'}</p>
          </div>
        </div>
      )}

      {formError && (
        <div className="crm-notice crm-notice-danger" role="alert">
          <Icon name="warning" />
          <div>
            <strong>No se pudo crear el contacto</strong>
            <p>{formError}</p>
          </div>
        </div>
      )}

      <button className="crm-button crm-button-primary" type="submit" disabled={disabled}>
        <Icon name="plus" />
        {submitting ? 'Guardando...' : 'Crear contacto'}
      </button>
    </form>
  );
}

function getFilteredContacts({ contacts, query, typeFilter, platformFilter, sortOrder }) {
  const search = normalizeSearch(query);

  return contacts
    .filter((contact) => {
      const matchesQuery = !search || [
        contact.displayName,
        contact.canonicalId,
        contact.entityType,
        ...contact.platformIds.map(getPlatformLabel)
      ].some((value) => normalizeSearch(value).includes(search));
      const matchesType = typeFilter === 'all' || normalizeSearch(contact.entityType) === typeFilter;
      const matchesPlatform = platformFilter === 'all' || contact.platformIds.includes(platformFilter);

      return matchesQuery && matchesType && matchesPlatform;
    })
    .sort((a, b) => {
      if (sortOrder === 'name') {
        return (a.displayName || '').localeCompare(b.displayName || '', 'es');
      }

      if (sortOrder === 'type') {
        return (a.entityType || '').localeCompare(b.entityType || '', 'es');
      }

      return b.lastActivity - a.lastActivity;
    });
}

function getFilteredConversations(conversations, platformFilter) {
  if (platformFilter === 'all') return conversations;
  return conversations.filter(
    (conversation) => normalizePlatform(conversation.platform) === platformFilter
  );
}

export default function CRMCore({ authToken }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('LOADING');
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formAttempted, setFormAttempted] = useState(false);
  const [created, setCreated] = useState(null);
  const [activeSection, setActiveSection] = useState('summary');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [selectedContactId, setSelectedContactId] = useState('');

  const loadDashboard = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const result = await loadCrmDashboard(authToken);
      setData(result);
      setStatus(result.status || 'ERROR');

      if (!result.ok) {
        setError(result.error || 'No fue posible consultar el CRM.');
      }
    } catch (loadError) {
      setStatus('ERROR');
      setData(null);
      setError(loadError?.message || 'No fue posible consultar el CRM.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadDashboard({ initial: true });
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadDashboard]);

  const model = useMemo(() => buildDashboardModel(data), [data]);

  const platformOptions = useMemo(() => {
    const knownIds = new Set(BASE_PLATFORMS.map((platform) => platform.id));
    const unknownPlatforms = Object.keys(model.platformSummary)
      .filter((platformId) => platformId && !knownIds.has(platformId))
      .map((platformId) => ({ id: platformId, label: getPlatformLabel(platformId) }));

    return [...BASE_PLATFORMS, ...unknownPlatforms];
  }, [model.platformSummary]);

  const contactPlatformCounts = useMemo(() => {
    const counts = { all: model.contacts.length };

    model.contacts.forEach((contact) => {
      contact.platformIds.forEach((platformId) => {
        counts[platformId] = (counts[platformId] || 0) + 1;
      });
    });

    return counts;
  }, [model.contacts]);

  const typeOptions = useMemo(() => [
    ...new Set(
      model.contacts
        .map((contact) => normalizeSearch(contact.entityType))
        .filter(Boolean)
    )
  ].sort(), [model.contacts]);

  const filteredContacts = useMemo(() => getFilteredContacts({
    contacts: model.contacts,
    query,
    typeFilter,
    platformFilter,
    sortOrder
  }), [model.contacts, platformFilter, query, sortOrder, typeFilter]);

  const filteredConversations = useMemo(
    () => getFilteredConversations(model.conversations, platformFilter),
    [model.conversations, platformFilter]
  );

  const identityById = useMemo(() => {
    const entries = model.contacts.map((contact) => [contact.id, contact]);
    return new Map(entries);
  }, [model.contacts]);

  const selectedContact = useMemo(
    () => filteredContacts.find((contact) => contact.id === selectedContactId) || null,
    [filteredContacts, selectedContactId]
  );

  const companyContacts = useMemo(
    () => model.contacts.filter((contact) => COMPANY_ENTITY_TYPES.has(normalizeSearch(contact.entityType))),
    [model.contacts]
  );

  const activePlatformLabel = platformOptions.find(
    (platform) => platform.id === platformFilter
  )?.label || 'Todas';

  const createContact = async (event) => {
    event.preventDefault();
    setFormAttempted(true);
    setFormError('');
    setCreated(null);

    const payload = {
      displayName: normalizeValue(form.displayName),
      canonicalId: normalizeValue(form.canonicalId),
      entityType: normalizeValue(form.entityType) || 'client'
    };

    if (!payload.displayName || !payload.canonicalId) {
      setFormError('Completá los campos obligatorios antes de crear el contacto.');
      return;
    }

    setFormSubmitting(true);

    const result = await createCrmIdentity(payload, authToken);
    setStatus(result.status || 'ERROR');

    if (!result.ok) {
      setFormError(result.error || 'No fue posible crear el contacto.');
      setFormSubmitting(false);
      return;
    }

    setCreated(result.identity);
    setForm(EMPTY_FORM);
    setFormAttempted(false);
    setFormSubmitting(false);
    await loadDashboard();
  };

  const contactListProps = {
    contacts: filteredContacts,
    selectedId: selectedContactId,
    onSelect: setSelectedContactId,
    loading: initialLoading,
    query,
    onQueryChange: setQuery,
    typeFilter,
    onTypeFilterChange: setTypeFilter,
    sortOrder,
    onSortOrderChange: setSortOrder,
    typeOptions,
    platformLabel: activePlatformLabel
  };

  const renderSection = () => {
    if (activeSection === 'summary') {
      return (
        <>
          <CrmMetrics model={model} status={status} loading={initialLoading} />
          <div className="crm-work-grid">
            <CrmContactList {...contactListProps} />
            <CrmContactPanel
              contact={selectedContact}
              onClose={() => setSelectedContactId('')}
            />
          </div>
          <div className="crm-two-column">
            <CrmConversationList
              conversations={filteredConversations}
              identityById={identityById}
              loading={initialLoading}
              platformLabel={activePlatformLabel}
            />
            <CrmPlatformDistribution platformSummary={model.platformSummary} />
          </div>
        </>
      );
    }

    if (activeSection === 'contacts') {
      return (
        <>
          <div className="crm-work-grid">
            <CrmContactList {...contactListProps} />
            <CrmContactPanel
              contact={selectedContact}
              onClose={() => setSelectedContactId('')}
            />
          </div>
          <CrmContactForm
            form={form}
            onChange={setForm}
            onSubmit={createContact}
            submitting={formSubmitting}
            status={status}
            created={created}
            formError={formError}
            attempted={formAttempted}
          />
        </>
      );
    }

    if (activeSection === 'companies') {
      return <CrmCompaniesSection companies={companyContacts} />;
    }

    if (activeSection === 'conversations') {
      return (
        <div className="crm-two-column wide-first">
          <CrmConversationList
            conversations={filteredConversations}
            identityById={identityById}
            loading={initialLoading}
            platformLabel={activePlatformLabel}
          />
          <CrmPlatformDistribution platformSummary={model.platformSummary} />
        </div>
      );
    }

    if (activeSection === 'followup') {
      return (
        <section className="crm-surface">
          <CrmEmptyState
            icon="target"
            title="Próxima fase"
            description="loadCrmDashboard() no devuelve todavía oportunidades, tareas o seguimientos operativos."
          />
        </section>
      );
    }

    if (activeSection === 'activity') {
      return <CrmActivityList activity={model.activity} />;
    }

    return (
      <CrmSystemStatus
        status={status}
        data={data}
        error={error}
        refreshing={refreshing}
        onRefresh={loadDashboard}
      />
    );
  };

  return (
    <section className="crm-core" aria-labelledby="crm-title">
      <CrmHeader
        status={status}
        refreshing={refreshing}
        onRefresh={loadDashboard}
      />

      <div className="crm-shell">
        <CrmSidebar
          activeSection={activeSection}
          onChangeSection={setActiveSection}
        />

        <main className="crm-main">
          <CrmPlatformFilter
            platforms={platformOptions}
            activePlatform={platformFilter}
            counts={contactPlatformCounts}
            onChange={setPlatformFilter}
          />

          <CrmNotice
            status={status}
            error={error}
            loading={initialLoading}
          />

          {renderSection()}
        </main>
      </div>
    </section>
  );
}
