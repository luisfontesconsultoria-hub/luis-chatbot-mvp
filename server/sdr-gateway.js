/** Stable gateway between webhook persistence and the existing SDR/AI implementation. */
function createSdrGateway({ qualify = async () => ({ status:'PENDING' }), respond = async () => null } = {}) {
  return {
    async process({ lead, message }) {
      if (!lead) return { status:'NO_LEAD' };
      const qualification = await qualify({ lead, message });
      if (qualification?.status === 'HUMAN_REQUIRED') return { status:'HUMAN_REQUIRED', qualification };
      const response = await respond({ lead, message, qualification });
      return { status:'PROCESSED', qualification, response };
    }
  };
}
module.exports = { createSdrGateway };
