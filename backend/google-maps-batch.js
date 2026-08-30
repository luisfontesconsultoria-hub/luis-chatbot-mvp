/**
 * Google Maps capture batch engine - isolated V1.
 * No CRM/Supabase/WhatsApp writes.
 */
const { buildCaptureBatch } = require('./google-maps-capture');
const { processCaptureBatch } = require('./google-maps-pipeline');
const { enrichPlaceWithCnpj, evaluateLeadEligibility } = require('./google-maps-cnpj');
const { toCrmLead } = require('./google-maps-lead-adapter');

const STAGES = Object.freeze({
  CAPTURED: 'CAPTURED',
  QUALIFIED: 'QUALIFIED',
  CNPJ_PENDING: 'CNPJ_PENDING',
  CNPJ_ENRICHED: 'CNPJ_ENRICHED',
  ELIGIBLE: 'ELIGIBLE',
  REJECTED: 'REJECTED',
  DUPLICATE: 'DUPLICATE',
  REVIEW: 'REVIEW',
  READY_FOR_CRM: 'READY_FOR_CRM',
});

function createBatchId(prefix = 'GM') {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function createCaptureBatch(input = [], metadata = {}) {
  const batchId = metadata.batchId || createBatchId();
  const capturedAt = metadata.capturedAt || new Date().toISOString();
  const records = buildCaptureBatch(input).map((place, index) => ({
    ...place,
    batchId,
    recordId: `${batchId}-${String(index + 1).padStart(4, '0')}`,
    capturedAt,
    stage: STAGES.CAPTURED,
  }));
  return { batchId, capturedAt, source: 'GOOGLE_MAPS', records };
}

function runQualification(batch, existing = []) {
  const result = processCaptureBatch(batch.records, existing);
  const accepted = result.accepted.map(record => ({
    ...record,
    stage: record.qualification === 'READY_FOR_CNPJ' ? STAGES.CNPJ_PENDING : STAGES.REVIEW,
  }));
  const duplicates = result.duplicates.map(record => ({ ...record, stage: STAGES.DUPLICATE }));
  return { ...batch, records: [...accepted, ...duplicates], stats: { ...result, acceptedCount: accepted.length } };
}

function applyCnpjResults(batch, resultsByCnpj = {}, options = {}) {
  const records = batch.records.map(record => {
    if (record.stage !== STAGES.CNPJ_PENDING) return record;
    const cnpj = record.cnpj;
    const response = cnpj ? resultsByCnpj[cnpj] : null;
    if (!response) return { ...record, stage: STAGES.CNPJ_PENDING, cnpjLookup: 'PENDING' };

    const enriched = enrichPlaceWithCnpj(record, response);
    const evaluated = evaluateLeadEligibility(enriched, options);
    return {
      ...evaluated,
      stage: evaluated.eligibility === 'ELIGIBLE' ? STAGES.ELIGIBLE : STAGES.REJECTED,
    };
  });
  return { ...batch, records };
}

function finalizeForCrm(batch, options = {}) {
  const records = batch.records.map(record => {
    if (record.stage !== STAGES.ELIGIBLE) return record;
    return { ...record, stage: STAGES.READY_FOR_CRM, crmLead: toCrmLead(record) };
  });
  return {
    ...batch,
    records,
    readyForCrm: records.filter(r => r.stage === STAGES.READY_FOR_CRM).map(r => r.crmLead),
    stats: {
      total: records.length,
      readyForCrm: records.filter(r => r.stage === STAGES.READY_FOR_CRM).length,
      rejected: records.filter(r => r.stage === STAGES.REJECTED).length,
      duplicate: records.filter(r => r.stage === STAGES.DUPLICATE).length,
      review: records.filter(r => r.stage === STAGES.REVIEW).length,
      cnpjPending: records.filter(r => r.stage === STAGES.CNPJ_PENDING).length,
    },
    options,
  };
}

module.exports = { STAGES, createBatchId, createCaptureBatch, runQualification, applyCnpjResults, finalizeForCrm };
