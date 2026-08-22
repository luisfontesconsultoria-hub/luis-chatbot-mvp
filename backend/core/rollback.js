/** Emergency pilot controls. Disable processing without deleting data. */
function createKillSwitch({ enabled = false } = {}) {
  let active = enabled;
  return {
    enable(){ active = true; },
    disable(){ active = false; },
    isActive(){ return active; },
    assertEnabled(){ if (active) throw new Error('V1_KILL_SWITCH_ACTIVE'); return true; }
  };
}
module.exports = { createKillSwitch };
