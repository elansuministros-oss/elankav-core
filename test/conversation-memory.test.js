import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExternalConversationId,
  isOwnerIdentity,
  loadConversationMemory,
  recordConversationExchange,
  normalizeHistoryRows
} from '../services/conversationMemoryService.js';

function createFakeSupabase(store) {
  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = 'select';
      this.value = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push(row => row[column] === value);

      if (this.operation === 'update') {
        for (const row of store[this.table]) {
          if (this.filters.every(filter => filter(row))) {
            Object.assign(row, this.value);
          }
        }

        return Promise.resolve({ error: null });
      }

      return this;
    }

    in(column, values) {
      this.filters.push(row => values.includes(row[column]));
      return this;
    }

    order(column, { ascending }) {
      this.orderBy = { column, ascending };
      return this;
    }

    async limit(limit) {
      let rows = this.filtered();

      if (this.orderBy) {
        const direction = this.orderBy.ascending ? 1 : -1;
        rows = rows.sort((left, right) =>
          String(left[this.orderBy.column]).localeCompare(
            String(right[this.orderBy.column])
          ) * direction
        );
      }

      return { data: rows.slice(0, limit), error: null };
    }

    async maybeSingle() {
      return { data: this.filtered()[0] || null, error: null };
    }

    insert(value) {
      this.operation = 'insert';
      this.value = value;
      return this;
    }

    async single() {
      const row = {
        id: `${this.table}-${store[this.table].length + 1}`,
        created_at: new Date().toISOString(),
        ...this.value
      };
      store[this.table].push(row);
      return { data: row, error: null };
    }

    async upsert(rows) {
      for (const row of rows) {
        const duplicate = store[this.table].some(existing =>
          existing.conversation_id === row.conversation_id &&
          existing.external_message_id === row.external_message_id
        );

        if (!duplicate) {
          store[this.table].push({
            id: `${this.table}-${store[this.table].length + 1}`,
            created_at: new Date().toISOString(),
            ...row
          });
        }
      }

      return { error: null };
    }

    update(value) {
      this.operation = 'update';
      this.value = value;
      return this;
    }

    filtered() {
      return store[this.table].filter(row =>
        this.filters.every(filter => filter(row))
      );
    }
  }

  return {
    from(table) {
      return new Query(table);
    }
  };
}

test('CLIENT-CONTEXT-01 separa conversaciones por plataforma', () => {
  assert.equal(
    buildExternalConversationId({
      platform: 'ELANVISUAL',
      externalUserId: '50586999046'
    }),
    'whatsapp:elanvisual:50586999046'
  );

  assert.equal(
    buildExternalConversationId({
      platform: 'ELANPET',
      externalUserId: '50586999046'
    }),
    'whatsapp:elanpet:50586999046'
  );
});

test('CLIENT-CONTEXT-01 excluye Owner Mode de memoria comercial', () => {
  assert.equal(
    isOwnerIdentity({ entityType: 'owner', roles: ['owner'] }),
    true
  );
  assert.equal(
    isOwnerIdentity({ entityType: 'client', roles: [] }),
    false
  );
});

test('CLIENT-CONTEXT-01 reconstruye el historial en orden cronológico', () => {
  const history = normalizeHistoryRows([
    { direction: 'outbound', body: 'Claro, el rótulo será de 60 por 60.' },
    { direction: 'inbound', body: 'Quiero uno de 60 por 60.' },
    { direction: 'outbound', body: '¿Qué medida necesitás?' },
    { direction: 'inbound', body: 'Quiero un rótulo acrílico.' }
  ]);

  assert.deepEqual(history, [
    { role: 'user', content: 'Quiero un rótulo acrílico.' },
    { role: 'assistant', content: '¿Qué medida necesitás?' },
    { role: 'user', content: 'Quiero uno de 60 por 60.' },
    { role: 'assistant', content: 'Claro, el rótulo será de 60 por 60.' }
  ]);
});

test('CLIENT-CONTEXT-01 recupera memoria después de recrear el proceso', async () => {
  const store = {
    crm_identities: [],
    crm_conversations: [],
    crm_messages: []
  };
  const identity = {
    canonicalId: '50586999046',
    entityType: 'client',
    roles: []
  };

  const firstProcess = createFakeSupabase(store);
  const initial = await loadConversationMemory({
    supabase: firstProcess,
    identity,
    platform: 'ELANVISUAL'
  });

  assert.equal(initial.enabled, true);
  assert.deepEqual(initial.history, []);

  const saved = await recordConversationExchange({
    supabase: firstProcess,
    memory: initial,
    incomingMessageId: 'WAHA-001',
    userMessage: 'Quiero un rótulo acrílico.',
    assistantMessage: '¿Qué medida necesitás?'
  });

  assert.equal(saved.status, 'SAVED');

  const processAfterRestart = createFakeSupabase(store);
  const restored = await loadConversationMemory({
    supabase: processAfterRestart,
    identity,
    platform: 'ELANVISUAL'
  });

  assert.deepEqual(restored.history, [
    { role: 'user', content: 'Quiero un rótulo acrílico.' },
    { role: 'assistant', content: '¿Qué medida necesitás?' }
  ]);
});
