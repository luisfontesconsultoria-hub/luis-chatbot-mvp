/** Dependency-light Supabase adapter boundary. Inject a server-side client; never create it from browser code. */
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
    async createActivity(payload) {
      const { data, error } = await client.from(TABLES.activities).insert(payload).select('*').single();
      if (error) throw error;
      return data;
    },
    async listActivities({ leadId, limit = 100 }) {
      const { data, error } = await client.from(TABLES.activities).select('*').eq('leadId', leadId).order('createdAt', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    }
  });
}
module.exports = { createSupabaseRepository };
