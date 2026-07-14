import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExternalConversationId,
  isOwnerIdentity,
  normalizeHistoryRows
} from '../services/conversationMemoryService.js';

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
