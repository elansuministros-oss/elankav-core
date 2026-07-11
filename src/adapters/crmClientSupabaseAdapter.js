import { supabase } from '../lib/supabase';

async function listRecent(table, columns, limit = 25) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function listIdentities() {
  return listRecent(
    'crm_identities',
    'id,canonical_id,display_name,entity_type,created_at'
  );
}

async function listConversations() {
  return listRecent(
    'crm_conversations',
    'id,identity_id,channel,platform,stage,status,created_at'
  );
}

async function listMessages() {
  return listRecent(
    'crm_messages',
    'id,conversation_id,direction,body,status,created_at'
  );
}

async function createIdentity({ displayName, canonicalId, entityType }) {
  const { data, error } = await supabase
    .from('crm_identities')
    .insert({
      canonical_id: canonicalId,
      display_name: displayName,
      entity_type: entityType,
      metadata: { source: 'crm-ui-validation' }
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export {
  listIdentities,
  listConversations,
  listMessages,
  createIdentity
};
