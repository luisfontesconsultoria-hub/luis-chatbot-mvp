const { processCaptureBatch } = require('./google-maps-pipeline');
const { enrichPlaceWithCnpj, evaluateLeadEligibility } = require('./google-maps-cnpj');
const { scoreLead } = require('./google-maps-scoring');
const { matchesFilters } = require('./google-maps-filters');
const { exportReadyBatch } = require('./google-maps-export');

function runCaptureStation(places = [], options = {}) {
  const initial = processCaptureBatch(places, options.existing || []);
  const enriched = initial.accepted.map(place => {
    const hasResolver = typeof options.cnpjResolver === 'function';
    const withCnpj = hasResolver
      ? enrichPlaceWithCnpj(place, options.cnpjResolver(place))
      : { ...place, cnpjLookup: place.cnpj ? 'PENDING_VALIDATION' : 'PENDING' };

    // Capture must not reject a lead merely because the CNPJ provider is not
    // connected yet. It remains pending until an authorized provider enriches it.
    if (!withCnpj.cnpj) {
      return {
        ...scoreLead(withCnpj, options.scoring || {}),
        eligibility: 'CNPJ_PENDING',
        eligibilityReasons: ['CNPJ_VALIDATION_PENDING'],
      };
    }

    const eligible = evaluateLeadEligibility(withCnpj, options.eligibility || {});
    const scored = scoreLead(eligible, options.scoring || {});
    const filtered = matchesFilters(scored, options.filters || {});
    if (filtered.matches) return scored;
    return {
      ...scored,
      eligibility: 'REVIEW',
      eligibilityReasons: [...(scored.eligibilityReasons || []), ...filtered.filterReasons],
    };
  });

  const ready = enriched.filter(lead => lead.eligibility === 'ELIGIBLE');
  return {
    summary: {
      captured: initial.total,
      duplicates: initial.duplicateCount,
      processed: enriched.length,
      eligible: ready.length,
      review: enriched.filter(l => l.eligibility === 'REVIEW').length,
      rejected: enriched.filter(l => l.eligibility === 'REJECTED').length,
      cnpjPending: enriched.filter(l => l.eligibility === 'CNPJ_PENDING').length,
    },
    leads: enriched,
    readyForCrm: exportReadyBatch(ready),
  };
}

module.exports = { runCaptureStation };
