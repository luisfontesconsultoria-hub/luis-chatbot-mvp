const { toDbLead, fromDbLead } = require('./crm-mapper');
const input = { companyName:'Empresa Teste', contactName:'Ana', productInterest:'CONTA_PJ', createdAt:'2026-08-22T12:00:00Z', status:'NEW', score:80 };
const db = toDbLead(input);
if (db.company_name !== 'Empresa Teste' || db.contact_name !== 'Ana' || db.created_at !== input.createdAt) throw Error('CRM_TO_DB_MAPPING_FAILED');
const crm = fromDbLead(db);
if (crm.companyName !== input.companyName || crm.contactName !== input.contactName || crm.createdAt !== input.createdAt) throw Error('DB_TO_CRM_MAPPING_FAILED');
console.log('PASS CRM/Supabase mapper round-trip');
