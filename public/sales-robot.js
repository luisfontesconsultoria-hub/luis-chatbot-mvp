/* Aba "Robô SDR": o que cada número de WhatsApp faz, tempo de resposta, horário, produtos e fila humana. */
(() => {
  const VIEW = '#view-sdr';
  const ROOT_ID = 'sales-robot';
  const MODE_LABEL = {
    OFF: 'Desligado (só registra as conversas)',
    CONTA_PJ: 'Roteiro Conta PJ',
    PRODUCT: 'Vender produto'
  };
  const TONE_LABEL = { NEUTRO: 'Cordial (padrão)', PROXIMO: 'Próximo e descontraído', FORMAL: 'Formal', DIRETO: 'Direto e objetivo' };
  const OUTSIDE_LABEL = { AWAY: 'Enviar mensagem de ausência (uma vez por dia)', SILENT: 'Não responder (só registra)' };
  const DAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const SOURCE_LABEL = { GOOGLE_ADS: 'Google Ads', META_ADS: 'Meta Ads', INSTAGRAM: 'Instagram', WEBSITE: 'Site', DIRECT: 'Outra' };
  const GATE_LABEL = {
    HUMAN_HANDOFF: 'Pediu atendimento humano',
    AGUARDANDO_RETORNO_DO_LUIS: 'Aguardando sua consulta (CNPJ)',
    AGUARDANDO_CONFIRMACAO_AGENDA: 'Aguardando confirmar agenda'
  };
  const ERROR_TEXT = {
    CRM_AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente.',
    INVALID_SLOT: 'Número inválido.',
    INVALID_MODE: 'Modo inválido.',
    PRODUCT_REQUIRED_FOR_MODE: 'Escolha um produto para este número vender.',
    PRODUCT_INACTIVE: 'Este produto está desativado.',
    PRODUCT_NAME_REQUIRED: 'Informe o nome do produto.',
    PRODUCT_LINK_INVALID: 'Informe o link de afiliado completo, começando com https://',
    PRODUCT_CODE_INVALID: 'O código deve ter de 3 a 20 letras ou números, sem espaços.',
    PRODUCT_CODE_IN_USE: 'Já existe outro produto com este código.',
    PRODUCT_ALREADY_EXISTS: 'Já existe um produto com este nome.',
    PRODUCT_IN_USE: 'Este produto está em uso por um número. Troque o modo do número antes.',
    PRODUCT_LIMIT_REACHED: 'Limite de produtos atingido.',
    PRODUCT_NOT_FOUND: 'Produto não encontrado.',
    PRODUCT_TRACKING_PARAM_INVALID: 'O parâmetro de rastreio aceita só letras, números e _ (ex.: sck).',
    PRODUCT_TONE_INVALID: 'Tom de conversa inválido.',
    OBJECTION_FORMAT_INVALID: 'Objeções: uma por linha, no formato "palavras, separadas, por vírgula => resposta".',
    DELAY_RANGE_INVALID: 'O tempo máximo de resposta precisa ser maior ou igual ao mínimo.',
    HOURS_INVALID: 'Confira o horário de atendimento (formato 08:00, início diferente do fim).',
    HOURS_DAYS_REQUIRED: 'Marque pelo menos um dia de atendimento.',
    LEAD_NOT_WAITING_HUMAN_GATE: 'Este cliente não está mais aguardando você.',
    SDR_SETTINGS_WRITE_FAILED: 'Não foi possível salvar. Tente de novo.'
  };

  const state = { settings: null, slots: [], queue: [], editing: null, message: null };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => sessionStorage.getItem('crm_token') || '';

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options, credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }
    });
    let data = {};
    try { data = await response.json(); } catch { /* resposta sem corpo */ }
    if (!response.ok) { const error = new Error(data.error || `HTTP_${response.status}`); error.code = data.error; throw error; }
    return data;
  }
  const errorText = error => ERROR_TEXT[error?.code] || 'Não foi possível concluir. Tente de novo.';

  function styles() {
    if (document.querySelector('#sales-robot-style')) return;
    const s = document.createElement('style');
    s.id = 'sales-robot-style';
    s.textContent = [
      '#sales-robot{margin-bottom:16px}',
      '#sales-robot h4{margin:26px 0 4px;font-size:14px}',
      '#sales-robot label{display:grid;gap:6px;color:var(--muted);font-size:12px;align-content:start}',
      '#sales-robot input,#sales-robot select{width:100%;min-width:0;background:#0b1222;border:1px solid var(--line);border-radius:9px;color:#fff;padding:10px;font:inherit;font-size:14px}',
      '#sales-robot input[type=checkbox]{width:auto;padding:0}',
      '#sales-robot .sr-slot{padding:16px 0;border-bottom:1px solid var(--line)}',
      '#sales-robot .sr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}',
      '#sales-robot .sr-check{display:flex;gap:8px;align-items:center;color:#c8d2e8;font-size:13px}',
      '#sales-robot .sr-days{display:flex;flex-wrap:wrap;gap:10px}',
      '#sales-robot .sr-product,#sales-robot .sr-queue-item{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}',
      '#sales-robot code,#sales-robot .sr-link{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}',
      '#sales-robot .sr-link{display:block;margin-top:8px;padding:10px;border:1px dashed var(--line);border-radius:9px;color:#c8d2e8;background:#0b1222}',
      '#sales-robot .sr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '#sales-robot textarea{width:100%;min-height:92px;resize:vertical;background:#0b1222;border:1px solid var(--line);border-radius:9px;color:#fff;padding:12px;font:inherit}',
      '#sales-robot .sr-form{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '#sales-robot .sr-wide{grid-column:1/-1}',
      '#sales-robot .sr-hint{font-size:12px;color:var(--muted)}',
      '#sales-robot .sr-msg{margin-top:12px;font-size:13px}',
      '#sales-robot .sr-msg.ok{color:var(--good)}',
      '#sales-robot button:disabled,#sales-robot select:disabled,#sales-robot input:disabled{opacity:.55;cursor:not-allowed}',
      '@media(max-width:900px){#sales-robot .sr-grid,#sales-robot .sr-form{grid-template-columns:1fr}#sales-robot .sr-product,#sales-robot .sr-queue-item{flex-direction:column}#sales-robot .sr-actions{justify-content:flex-start}}'
    ].join('');
    document.head.appendChild(s);
  }

  function root() {
    const view = document.querySelector(VIEW);
    if (!view) return null;
    let el = document.getElementById(ROOT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT_ID;
      el.className = 'card';
      view.insertBefore(el, view.firstChild);
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('change', onChange);
    }
    return el;
  }

  const product = id => (state.settings?.products || []).find(p => p.id === id) || null;
  const liveSlot = n => state.slots.find(s => Number(s.slot) === Number(n)) || {};
  const slotPhone = n => {
    const live = liveSlot(n);
    return String(live.status || '').toUpperCase() === 'CONNECTED' && live.phone ? String(live.phone).replace(/\D/g, '') : '';
  };

  /** Número que vende o produto (o primeiro conectado em modo produto com ele); senão, qualquer conectado. */
  function phoneFor(p) {
    const cfgs = state.settings?.slots || [];
    const selling = cfgs.find(c => c.mode === 'PRODUCT' && c.productId === p.id && slotPhone(c.slot));
    if (selling) return slotPhone(selling.slot);
    const any = cfgs.find(c => slotPhone(c.slot));
    return any ? slotPhone(any.slot) : '';
  }

  /** Link que vai no anúncio: abre o WhatsApp com o código da campanha já escrito. */
  function adLink(p) {
    const phone = phoneFor(p);
    if (!phone || !p.code) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Quero saber mais sobre ${p.name} (ref ${p.code})`)}`;
  }

  function objectionsText(p) {
    return (p.objections || []).map(o => `${(o.keywords || []).join(', ')} => ${o.answer}`).join('\n');
  }

  function slotBlock(cfg) {
    const live = liveSlot(cfg.slot);
    const connected = String(live.status || '').toUpperCase() === 'CONNECTED';
    const products = (state.settings.products || []).filter(p => p.active !== false);
    const hours = cfg.hours || {};
    const limits = state.settings.limits || {};
    const maxDelay = limits.delayMaxSeconds || 40;
    const modeOptions = state.settings.modes.map(m => `<option value="${esc(m)}" ${m === cfg.mode ? 'selected' : ''}>${esc(MODE_LABEL[m] || m)}</option>`).join('');
    const productOptions = ['<option value="">Selecione o produto</option>']
      .concat(products.map(p => `<option value="${esc(p.id)}" ${p.id === cfg.productId ? 'selected' : ''}>${esc(p.name)}</option>`)).join('');
    const days = DAY_LABEL.map((label, d) => `<label class="sr-check"><input type="checkbox" data-day="${d}" ${(hours.days || []).includes(d) ? 'checked' : ''}> ${label}</label>`).join('');
    const outsideOptions = (state.settings.outsideHours || ['AWAY', 'SILENT']).map(o => `<option value="${o}" ${hours.outside === o ? 'selected' : ''}>${esc(OUTSIDE_LABEL[o] || o)}</option>`).join('');
    return `<div class="sr-slot" data-slot="${cfg.slot}">
      <div class="card-head" style="margin:0"><div><strong>WhatsApp ${cfg.slot}</strong> <span class="sr-hint">${connected ? esc(live.phone || 'Conectado') : 'Não conectado'}</span></div>
        <button class="primary" data-action="save-slot">Salvar número ${cfg.slot}</button></div>
      <div class="sr-grid">
        <label>O que o robô faz neste número<select data-field="mode">${modeOptions}</select></label>
        <label>Produto<select data-field="productId" ${cfg.mode === 'PRODUCT' ? '' : 'disabled'}>${productOptions}</select></label>
        <label class="sr-check" style="align-self:end"><input type="checkbox" data-field="typing" ${cfg.typing === false ? '' : 'checked'}> Mostrar "digitando..." antes de responder</label>
        <label>Esperar no mínimo (segundos)<input data-field="delayMin" type="number" min="0" max="${maxDelay}" value="${esc(cfg.delayMin ?? 0)}"></label>
        <label>Esperar no máximo (segundos)<input data-field="delayMax" type="number" min="0" max="${maxDelay}" value="${esc(cfg.delayMax ?? 0)}"><span class="sr-hint">O robô sorteia um tempo entre o mínimo e o máximo (até ${maxDelay}s). 0 e 0 = responde na hora.</span></label>
        <label class="sr-check" style="align-self:end"><input type="checkbox" data-field="hoursEnabled" ${hours.enabled ? 'checked' : ''}> Usar horário de atendimento</label>
        <label>Início<input data-field="start" type="time" value="${esc(hours.start || '08:00')}"></label>
        <label>Fim<input data-field="end" type="time" value="${esc(hours.end || '20:00')}"><span class="sr-hint">Horário de Brasília. Pode atravessar a meia-noite (ex.: 18:00 às 02:00).</span></label>
        <label>Fora do horário<select data-field="outside">${outsideOptions}</select></label>
        <div class="sr-wide" style="grid-column:1/-1"><span class="sr-hint">Dias de atendimento</span><div class="sr-days" style="margin-top:6px">${days}</div></div>
        <label style="grid-column:1/-1">Mensagem de ausência<textarea data-field="awayMessage" maxlength="${limits.awayMessage || 400}" placeholder="${esc(state.settings.defaultAwayMessage || '')}">${esc(hours.awayMessage || '')}</textarea><span class="sr-hint">Em branco usa o texto padrão acima. {inicio} e {fim} viram o horário configurado.</span></label>
      </div>
    </div>`;
  }

  function productRow(p) {
    const link = adLink(p);
    const linkBlock = link
      ? `<span class="sr-hint">Link para usar no anúncio:</span><span class="sr-link">${esc(link)}</span>`
      : `<span class="sr-hint">${p.code ? 'Conecte um número de WhatsApp para gerar o link do anúncio.' : 'Defina um código de campanha para gerar o link do anúncio.'}</span>`;
    const extras = [
      `Tom: ${esc(TONE_LABEL[p.tone] || p.tone || TONE_LABEL.NEUTRO)}`,
      `IA: ${p.aiEnabled === false ? 'desligada neste produto' : 'permitida'}`,
      `Até ${esc(p.maxReplies || 12)} respostas automáticas`,
      `${(p.objections || []).length} objeção(ões) com resposta pronta`,
      p.trackingParam ? `Rastreio de venda: <code>${esc(p.trackingParam)}</code>` : 'Sem rastreio de venda'
    ].join(' · ');
    return `<div class="sr-product">
      <div>
        <strong>${esc(p.name)}</strong> ${p.active === false ? '<span class="pill">Desativado</span>' : ''}
        <div class="sr-hint">Código: <code>${esc(p.code || 'sem código')}</code> · Origem: ${esc(SOURCE_LABEL[p.source] || p.source)}${p.price ? ` · Valor: ${esc(p.price)}` : ''}</div>
        <div class="sr-hint">${extras}</div>
        <div class="sr-hint">Link de afiliado: <code>${esc(p.link)}</code></div>
        <div style="margin-top:8px">${linkBlock}</div>
      </div>
      <div class="sr-actions">
        ${link ? `<button class="ghost" data-action="copy-link" data-id="${esc(p.id)}">Copiar link do anúncio</button>` : ''}
        <button class="ghost" data-action="edit-product" data-id="${esc(p.id)}">Editar</button>
        <button class="ghost" data-action="remove-product" data-id="${esc(p.id)}">Remover</button>
      </div>
    </div>`;
  }

  function productForm() {
    const p = state.editing === 'new' ? {} : product(state.editing) || {};
    const limits = state.settings.limits || {};
    const sourceOptions = Object.keys(SOURCE_LABEL).map(s => `<option value="${s}" ${(p.source || 'GOOGLE_ADS') === s ? 'selected' : ''}>${SOURCE_LABEL[s]}</option>`).join('');
    const toneOptions = (state.settings.tones || Object.keys(TONE_LABEL)).map(t => `<option value="${t}" ${(p.tone || 'NEUTRO') === t ? 'selected' : ''}>${esc(TONE_LABEL[t] || t)}</option>`).join('');
    return `<form class="sr-form" data-form="product">
      <input type="hidden" name="id" value="${esc(p.id || '')}">
      <label>Nome do produto<input name="name" required maxlength="${limits.name || 80}" value="${esc(p.name || '')}"></label>
      <label>Link de afiliado (página oficial)<input name="link" required type="url" placeholder="https://" maxlength="${limits.link || 500}" value="${esc(p.link || '')}"></label>
      <label>Código da campanha<input name="code" maxlength="${limits.code || 20}" placeholder="Ex.: EMAG" value="${esc(p.code || '')}"><span class="sr-hint">Vai no link do anúncio. É assim que o CRM sabe de qual anúncio o cliente veio.</span></label>
      <label>Valor (opcional)<input name="price" maxlength="${limits.price || 80}" placeholder="Ex.: R$ 197,00" value="${esc(p.price || '')}"><span class="sr-hint">O robô só cita valor se estiver escrito aqui.</span></label>
      <label>Origem dos anúncios<select name="source">${sourceOptions}</select></label>
      <label>Situação<select name="active"><option value="true" ${p.active === false ? '' : 'selected'}>Ativo</option><option value="false" ${p.active === false ? 'selected' : ''}>Desativado</option></select></label>
      <label>Tom da conversa<select name="tone">${toneOptions}</select><span class="sr-hint">Vale para as respostas redigidas pela IA.</span></label>
      <label>IA neste produto<select name="aiEnabled"><option value="true" ${p.aiEnabled === false ? '' : 'selected'}>Permitida (responde dúvidas com o cadastro)</option><option value="false" ${p.aiEnabled === false ? 'selected' : ''}>Desligada (só respostas prontas)</option></select></label>
      <label>Máximo de respostas automáticas por cliente<input name="maxReplies" type="number" min="${limits.maxRepliesMin || 3}" max="${limits.maxRepliesMax || 30}" value="${esc(p.maxReplies || 12)}"><span class="sr-hint">Depois disso a conversa passa para você.</span></label>
      <label>Parâmetro de rastreio da plataforma (opcional)<input name="trackingParam" maxlength="${limits.trackingParam || 30}" placeholder="Ex.: sck" value="${esc(p.trackingParam || '')}"><span class="sr-hint">Confirme na sua plataforma de afiliado. Com ele, a venda aprovada volta para o lead certo.</span></label>
      <label class="sr-wide">Apresentação (primeira mensagem do robô)<textarea name="pitch" maxlength="${limits.pitch || 600}" placeholder="Em duas ou três frases: o que é o produto e para quem serve.">${esc(p.pitch || '')}</textarea></label>
      <label class="sr-wide">O que o robô pode dizer sobre o produto<textarea name="knowledge" maxlength="${limits.knowledge || 6000}" style="min-height:150px" placeholder="Conteúdo, forma de acesso, garantia, formas de pagamento, dúvidas frequentes. O robô responde só com o que estiver aqui.">${esc(p.knowledge || '')}</textarea></label>
      <label class="sr-wide">Objeções com resposta pronta (uma por linha)<textarea name="objections" style="min-height:110px" placeholder="sem tempo, nao tenho tempo => As aulas são curtas e ficam gravadas, você assiste quando puder.&#10;caro, muito caro => Dá para parcelar, e a garantia te deixa testar sem risco.">${esc(objectionsText(p))}</textarea><span class="sr-hint">Formato: palavras-chave separadas por vírgula =&gt; resposta. Quando o cliente usa uma dessas palavras, o robô envia exatamente a sua resposta.</span></label>
      <div class="sr-wide sr-actions" style="justify-content:flex-start">
        <button class="primary" type="submit">Salvar produto</button>
        <button class="ghost" type="button" data-action="cancel-product">Cancelar</button>
      </div>
    </form>`;
  }

  function queueBlock() {
    if (!state.queue.length) return '<p class="muted">Ninguém aguardando você agora.</p>';
    return state.queue.map(l => `<div class="sr-queue-item">
      <div><strong>${esc(l.name || l.phone || 'Cliente')}</strong> <span class="sr-hint">${esc(l.phone || '')}</span>
        <div class="sr-hint">${esc(GATE_LABEL[l.humanGate] || l.humanGate)}${l.interest ? ` · ${esc(l.interest)}` : ''}${l.campaign ? ` · Campanha ${esc(l.campaign)}` : ''}</div></div>
      <div class="sr-actions">
        <button class="ghost" data-action="open-lead" data-id="${esc(l.id)}">Abrir conversa</button>
        <button class="primary" data-action="release" data-id="${esc(l.id)}">${l.humanGate === 'HUMAN_HANDOFF' ? 'Devolver ao robô' : 'Liberar para o robô seguir'}</button>
      </div>
    </div>`).join('');
  }

  function render() {
    const el = root();
    if (!el) return;
    styles();
    if (!state.settings) { el.innerHTML = '<h3>Robô SDR</h3><p class="muted">Carregando...</p>'; return; }
    const s = state.settings;
    const products = s.products || [];
    const aiPill = s.ai?.enabled ? '<span class="pill green">IA ligada</span>' : '<span class="pill">IA desligada</span>';
    const aiNote = s.ai?.enabled
      ? 'Com a IA ligada, o robô responde dúvidas usando só o que está no cadastro do produto. Preço ou link fora do cadastro são bloqueados.'
      : 'A IA está desligada no servidor: o robô apresenta o produto, envia o link, usa as objeções cadastradas e passa as outras dúvidas para você.';
    const diskWarning = s.persistent ? '' : '<div class="warning"><strong>Configuração temporária</strong><p>Esta configuração está em disco temporário e será perdida quando o servidor reiniciar.</p></div>';
    const message = state.message ? `<div class="sr-msg ${state.message.ok ? 'ok' : 'danger'}" role="status">${esc(state.message.text)}</div>` : '';
    const webhook = `${location.origin}/webhooks/affiliate-sale?token=SEU_SEGREDO&platform=NOME_DA_PLATAFORMA`;
    el.innerHTML = `
      <div class="card-head"><div><h3>Robô SDR</h3><p class="muted">Configure o que cada número de WhatsApp faz quando um cliente chama. Toda conversa entra no CRM, com o robô ligado ou não.</p></div>${aiPill}</div>
      ${diskWarning}
      ${message}
      <h4>Aguardando você (${state.queue.length})</h4>
      ${queueBlock()}
      <h4>Números</h4>
      ${s.slots.map(slotBlock).join('')}
      <p class="sr-hint" style="margin-top:10px">${esc(aiNote)}</p>
      <div class="card-head" style="margin:26px 0 0"><h4 style="margin:0">Produtos</h4>${state.editing ? '' : '<button class="ghost" data-action="new-product">+ Novo produto</button>'}</div>
      ${products.length ? products.map(productRow).join('') : '<p class="muted">Nenhum produto cadastrado. Cadastre o primeiro para o robô poder vender.</p>'}
      ${state.editing ? productForm() : ''}
      <h4>Confirmação de venda</h4>
      <p class="sr-hint">Cadastre este endereço como webhook (postback) na plataforma de afiliado. Troque SEU_SEGREDO pelo valor da variável AFFILIATE_WEBHOOK_SECRET do servidor. A venda aprovada marca o cliente como "Venda aprovada" e o robô para de falar com ele.</p>
      <span class="sr-link">${esc(webhook)}</span>`;
  }

  async function load() {
    if (!root()) return;
    try {
      const [settings, wa, queue] = await Promise.all([
        api('/api/sdr/settings'),
        api('/api/whatsapp/slots').catch(() => ({ slots: [] })),
        api('/api/crm/human-queue').catch(() => ({ leads: [] }))
      ]);
      state.settings = settings;
      state.slots = Array.isArray(wa.slots) ? wa.slots : [];
      state.queue = Array.isArray(queue.leads) ? queue.leads : [];
    } catch (error) {
      const el = root();
      if (el) el.innerHTML = `<h3>Robô SDR</h3><p class="danger">${esc(errorText(error))}</p>`;
      return;
    }
    render();
  }

  function notify(text, ok = true) { state.message = { text, ok }; render(); }

  function onChange(event) {
    const select = event.target.closest('select[data-field="mode"]');
    if (!select) return;
    const productSelect = select.closest('.sr-slot').querySelector('select[data-field="productId"]');
    productSelect.disabled = select.value !== 'PRODUCT';
  }

  function readSlot(block) {
    const field = name => block.querySelector(`[data-field="${name}"]`);
    return {
      mode: field('mode').value,
      productId: field('productId').value || null,
      delayMin: Number(field('delayMin').value || 0),
      delayMax: Number(field('delayMax').value || 0),
      typing: field('typing').checked,
      hours: {
        enabled: field('hoursEnabled').checked,
        start: field('start').value,
        end: field('end').value,
        outside: field('outside').value,
        awayMessage: field('awayMessage').value,
        days: [...block.querySelectorAll('input[data-day]')].filter(i => i.checked).map(i => Number(i.dataset.day))
      }
    };
  }

  async function onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'new-product') { state.editing = 'new'; state.message = null; return render(); }
    if (action === 'edit-product') { state.editing = button.dataset.id; state.message = null; return render(); }
    if (action === 'cancel-product') { state.editing = null; return render(); }
    if (action === 'copy-link') {
      const p = product(button.dataset.id);
      const link = p ? adLink(p) : '';
      try { await navigator.clipboard.writeText(link); notify('Link do anúncio copiado.'); }
      catch { notify('Não foi possível copiar. Selecione o link e copie manualmente.', false); }
      return;
    }
    if (action === 'open-lead') {
      const nav = document.querySelector('.nav[data-view="inbox"]');
      if (nav) nav.click();
      if (typeof window.showConversation === 'function') setTimeout(() => window.showConversation(button.dataset.id), 120);
      return;
    }
    if (action === 'release') {
      button.disabled = true;
      try {
        await api(`/api/crm/leads/${encodeURIComponent(button.dataset.id)}/human-release`, { method: 'POST', body: '{}' });
        await load();
        notify('Cliente liberado. O robô volta a responder na próxima mensagem dele.');
      } catch (error) { button.disabled = false; notify(errorText(error), false); }
      return;
    }
    if (action === 'save-slot') {
      const block = button.closest('.sr-slot');
      const payload = readSlot(block);
      button.disabled = true;
      try {
        await api(`/api/sdr/slots/${block.dataset.slot}`, { method: 'POST', body: JSON.stringify(payload) });
        await load();
        notify(`WhatsApp ${block.dataset.slot}: ${MODE_LABEL[payload.mode]}. Configuração salva.`);
      } catch (error) { button.disabled = false; notify(errorText(error), false); }
      return;
    }
    if (action === 'remove-product') {
      const p = product(button.dataset.id);
      if (!p || !window.confirm(`Remover o produto "${p.name}"?`)) return;
      try {
        await api(`/api/sdr/products/${encodeURIComponent(p.id)}/delete`, { method: 'POST', body: '{}' });
        if (state.editing === p.id) state.editing = null;
        await load();
        notify('Produto removido.');
      } catch (error) { notify(errorText(error), false); }
    }
  }

  async function onSubmit(event) {
    const form = event.target.closest('form[data-form="product"]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.active = data.active !== 'false';
    data.aiEnabled = data.aiEnabled !== 'false';
    data.maxReplies = Number(data.maxReplies || 12);
    if (!data.id) delete data.id;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/sdr/products', { method: 'POST', body: JSON.stringify(data) });
      state.editing = null;
      await load();
      notify('Produto salvo.');
    } catch (error) {
      submit.disabled = false;
      // Mantém o que foi digitado: só mostra o erro abaixo do formulário.
      let msg = form.parentElement.querySelector('.sr-form-error');
      if (!msg) { msg = document.createElement('div'); form.after(msg); }
      msg.className = 'sr-msg danger sr-form-error';
      msg.setAttribute('role', 'alert');
      msg.textContent = errorText(error);
    }
  }

  function boot() {
    if (boot.done) return;
    boot.done = true;
    document.querySelectorAll('.nav[data-view="sdr"]').forEach(b => b.addEventListener('click', () => setTimeout(load, 80)));
    document.querySelectorAll('[data-goto="sdr"]').forEach(b => b.addEventListener('click', () => setTimeout(load, 80)));
    if (document.querySelector(`${VIEW}.active`)) load();
  }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
