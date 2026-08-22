const { toDbLead, fromDbLead } = require('./crm-mapper');
const input = { companyName:'Empresa Teste', name:'Ana', phone:'5551999999999', productInterest:'CONTA_PJ', createdAt:'2026-08-22T12:00:00Z', status:'NEW' };
const db = toDbLead(input);
if (db.company_name !== 'Empresa Teste' || db.name !== 'Ana' || db.phone !== input.phone || db.created_at !== input.createdAt) throw Error('CRM_TO_DB_MAPPING_FAILED');
const crm = fromDbLead(db);
if (crm.companyName !== input.companyName || crm.name !== input.name || crm.phone !== input.phone || crm.createdAt !== input.createdAt) throw Error('DB_TO_CRM_MAPPING_FAILED');
console.log('PASS CRM/Supabase mapper round-trip');
