(() => {
  let timer = null;
  let busy = false;

  function dashboardStyles() {
    if (document.querySelector('#dashboard-navigation-style')) return;
    const s = document.createElement('style');
    s.id = 'dashboard-navigation-style';
    s.textContent = `
      .day-grid{gap:14px}
      .day-item{padding:14px 16px;min-height:88px;display:flex;flex-direction:column;justify-content:center;gap:5px;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease}
      .day-item:hover{transform:translateY(-1px)}
      .day-item span,.day-item small{line-height:1.4}
      .day-item strong{line-height:1.15;margin:1px 0}
      .pipeline{gap:12px}
      .pipeline .stage{padding:14px 16px;min-height:72px;display:flex;flex-direction:column;justify-content:center;gap:5px;cursor:pointer}
      .pipeline .stage span{line-height:1.35}
      .pipeline .stage strong{line-height:1.1}
    `;
    document.head.appendChild(s);
  }

  function filterLeads(kind) {
    state.dashboardFilter = kind || null;
    if (typeof show === 'function') show('leads');
    if (typeof renderLeads === 'function') renderLeads();
  }

  function installLeadFilter() {
    if (window.__dashboardLeadFilterInstalled || typeof window.renderLeads !== 'function') return;
    const original = window.renderLeads;
    window.renderLeads = function () {
      const filter = state.dashboardFilter;
      if (!filter) return original();
      const all = state.leads;
      const matches = lead => {
        const stage = String(leadStage(lead) || '').toUpperCase();
        const next = String(lead.nextAction || '').toUpperCase();
        const priority = String(lead.assistantPriority || '').toUpperCase();
        if (filter === 'FOLLOW_UP') return next === 'FAZER_FOLLOW_UP' || stage === 'AGUARDANDO_RETORNO';
        if (filter === 'HIGH') return priority === 'HIGH';
        if (filter === 'WAITING') return ['AGUARDANDO_RETORNO','AGUARDANDO_RETORNO_DO_LUIS'].includes(stage);
        if (filter === 'CONVERTED') return stage === 'CONVERTIDO';
        return stage === String(filter).toUpperCase();
      };
      state.leads = all.filter(matches);
      try { original(); } finally { state.leads = all; }
    };
    window.__dashboardLeadFilterInstalled = true;
  }

  function wireDashboard() {
    dashboardStyles();
    installLeadFilter();

    const items = document.querySelectorAll('#view-dashboard .day-item');
    const actions = ['FOLLOW_UP','HIGH','WAITING','CONVERTED'];
    items.forEach((item, i) => {
      if (i >= actions.length || item.dataset.dashboardWired === '1') return;
      item.dataset.dashboardWired = '1';
      item.title = 'Abrir itens relacionados';
      item.addEventListener('click', () => filterLeads(actions[i]));
    });

    const stages = document.querySelectorAll('#view-dashboard #pipeline .stage');
    const stageKeys = ['NEW','QUALIFYING','QUALIFIED','SCHEDULING','NEGOTIATION'];
    stages.forEach((item, i) => {
      if (i >= stageKeys.length || item.dataset.dashboardWired === '1') return;
      item.dataset.dashboardWired = '1';
      item.title = stageKeys[i] === 'SCHEDULING' && typeof window.openAppointments === 'function'
        ? 'Abrir agendamentos'
        : 'Abrir clientes desta etapa';
      item.addEventListener('click', () => {
        if (stageKeys[i] === 'SCHEDULING' && typeof window.openAppointments === 'function') {
          state.dashboardFilter = null;
          window.openAppointments();
          return;
        }
        filterLeads(stageKeys[i]);
      });
    });
  }

  async function refresh() {
    if (busy || !state?.token) return;
    busy = true;
    try {
      const d = await api('/api/crm/leads?limit=100');
      const previousSelected = state.selected?.id ? String(state.selected.id) : null;
      state.leads = d.leads || [];
      if (typeof renderDashboard === 'function') renderDashboard();
      wireDashboard();
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
    dashboardStyles();
    wireDashboard();
  }

  window.addEventListener('load', start);
  start();
})();
