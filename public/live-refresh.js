(() => {
  let timer = null;
  let busy = false;
  async function refresh() {
    if (busy || !window.state?.token) return;
    busy = true;
    try {
      const d = await window.api('/api/crm/leads?limit=100');
      const previousSelected = window.state.selected?.id ? String(window.state.selected.id) : null;
      window.state.leads = d.leads || [];
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderLeads === 'function') window.renderLeads();
      if (typeof window.renderContacts === 'function') window.renderContacts();
      if (previousSelected) {
        const updated = window.state.leads.find(x => String(x.id) === previousSelected);
        if (updated) {
          window.state.selected = updated;
          if (document.querySelector('#view-inbox')?.classList.contains('active') && typeof window.showConversation === 'function') {
            await window.showConversation(previousSelected);
          }
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
