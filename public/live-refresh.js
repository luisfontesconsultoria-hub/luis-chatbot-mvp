(() => {
  let timer = null;
  let busy = false;
  async function refresh() {
    if (busy || !state?.token) return;
    busy = true;
    try {
      const d = await api('/api/crm/leads?limit=100');
      const previousSelected = state.selected?.id ? String(state.selected.id) : null;
      state.leads = d.leads || [];
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderLeads === 'function') renderLeads();
      if (typeof renderContacts === 'function') renderContacts();
      if (previousSelected) {
        const updated = state.leads.find(x => String(x.id) === previousSelected);
        if (updated) {
          state.selected = updated;
          if (document.querySelector('#view-inbox')?.classList.contains('active')) await showConversation(previousSelected);
        }
      }
    } catch (_) {
      // Background refresh must never interrupt the operator's session.
    } finally {
      busy = false;
    }
  }
  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 3000);
  }
  window.addEventListener('load', start);
  start();
})();
