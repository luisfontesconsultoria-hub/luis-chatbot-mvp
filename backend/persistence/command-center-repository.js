/** Repository-backed command center. */
const { buildCommandCenter } = require('./daily-command-center');

async function getCommandCenter(repo,{leadId,limit=200,appointments=[],routeStops=[],now=Date.now()}={}) {
  const events=await repo.listEvents({leadId,limit});
  return buildCommandCenter({events,appointments,routeStops,now});
}

module.exports={getCommandCenter};
