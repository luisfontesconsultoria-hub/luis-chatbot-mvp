/** API-facing command-center service. Keeps the HTTP layer thin and deterministic. */
const { getCommandCenter } = require('./command-center-repository');
async function getCommandCenterResponse(repo, options={}) { return getCommandCenter(repo, options); }
module.exports={getCommandCenterResponse};
