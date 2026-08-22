/** Server-side Supabase adapter aligned with the existing V1 schema. */
const { TABLES, assertRepository } = require('./supabase-contract');

function createSupabaseRepository(client) {
  if (!client || typeof client.from !== 'function') throw new Error('SUPABASE_CLIENT_REQUIRED');
  return assertRepository({
    async listLeads({ limit = 50, source, status } = {}) {
      let q = client.from(TABLES.leads).select('*').limit(limit);
      if (source) q = q.eq('source', source);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async getLead(id) {
      const { data, error } = await client.from(TABLES.leads).select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    async createLead(payload) {
      const { data, error } = await client.from(TABLES.leads).insert(payload).select('*').single();
      if (error) throw error;
      return data;
    },
    async updateLead(id, patch) {
      const { data, error } = await client.from(TABLES.leads).update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      return data;
    },
    async createMessage(payload) {
      const { data, error } = await client.from(TABLES.messages).insert(payload).select('*').single();
      if (error) throw error;
      return data;
    },
    async listMessages({ leadId, limit = 100 } = {}) {
      const { data, error } = await client.from(TABLES.messages).select('*').eq('lead_id', leadId).order('created_at', { ascending:false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    async createEvent(payload) {
      const { data, error } = await client.from(TABLES.events).insert(payload).select('*').single();
      if (error) throw error;
      return data;
    },
    async createAudit(payload) {
      const { data, error } = await client.from(TABLES.audit).insert(payload).select('*').single();
      if (error) throw error;
      return data;
    }
  });
}
module.exports = { createSupabaseRepository };
