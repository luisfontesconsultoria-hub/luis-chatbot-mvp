/* Painel "Robô de vendas": define o que cada número de WhatsApp faz e cadastra os produtos. */
(() => {
  const VIEW = '#view-ia';
  const ROOT_ID = 'sales-robot';
  const MODE_LABEL = {
    OFF: 'Desligado (só registra as conversas)',
    CONTA_PJ: 'Roteiro Conta PJ',
    PRODUCT: 'Vender produto'
  };
  const SOURCE_LABEL = { GOOGLE_ADS: 'Google Ads', META_ADS: 'Meta Ads', INSTAGRAM: 'Instagram', WEBSITE: 'Site', DIRECT: 'Outra' };
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
    SDR_SETTINGS_WRITE_FAILED: 'Não foi possível salvar. Tente de novo.'
  };

  const state = { settings: null, slots: [], editing: null, message: null };
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
      '#sales-robot h4{margin:22px 0 4px;font-size:14px}',
      '#sales-robot label{display:grid;gap:6px;color:var(--muted);font-size:12px;align-content:start}',
      '#sales-robot input,#sales-robot select{width:100%;min-width:0;background:#0b1222;border:1px solid var(--line);border-radius:9px;color:#fff;padding:10px;font:inherit;font-size:14px}',
      '#sales-robot .sr-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(190px,1.3fr) minmax(170px,1.2fr) auto;gap:12px;align-items:end;padding:14px 0;border-bottom:1px solid var(--line)}',
      '#sales-robot .sr-row strong{display:block}',
      '#sales-robot .sr-product{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}',
      '#sales-robot .sr-product code,#sales-robot .sr-link{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}',
      '#sales-robot .sr-link{display:block;margin-top:8px;padding:10px;border:1px dashed var(--line);border-radius:9px;color:#c8d2e8;background:#0b1222}',
      '#sales-robot .sr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '#sales-robot textarea{width:100%;min-height:92px;resize:vertical;background:#0b1222;border:1px solid var(--line);border-radius:9px;color:#fff;padding:12px;font:inherit}',
      '#sales-robot .sr-form{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '#sales-robot .sr-wide{grid-column:1/-1}',
      '#sales-robot .sr-hint{font-size:12px;color:var(--muted)}',
      '#sales-robot .sr-msg{margin-top:12px;font-size:13px}',
      '#sales-robot .sr-msg.ok{color:var(--good)}',
      '#sales-robot button:disabled,#sales-robot select:disabled{opacity:.55;cursor:not-allowed}',
      '@media(max-width:900px){#sales-robot .sr-row,#sales-robot .sr-form{grid-template-columns:1fr}#sales-robot .sr-product{flex-direction:column}#sales-robot .sr-actions{justify-content:flex-start}}'
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
  const connectedPhone = () => {
    const slot = state.slots.find(s => String(s.status).toUpperCase() === 'CONNECTED' && s.phone);
    return slot ? String(slot.phone).replace(/\D/g, '') : '';
  };

  /** Link que vai no anúncio: abre o WhatsApp com o código da campanha já escrito. */
  function adLink(p) {
    const phone = connectedPhone();
    if (!phone || !p.code) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Quero saber mais sobre ${p.name} (ref ${p.code})`)}`;
  }

  function slotRow(cfg) {
    const live = state.slots.find(s => Number(s.slot) === cfg.slot) || {};
    const connected = String(live.status || '').toUpperCase() === 'CONNECTED';
    const products = (state.settings.products || []).filter(p => p.active !== false);
    const modeOptions = state.settings.modes.map(m => `<option value="${esc(m)}" ${m === cfg.mode ? 'selected' : ''}>${esc(MODE_LABEL[m] || m)}</option>`).join('');
    const productOptions = ['<option value="">Selecione o produto</option>']
      .concat(products.map(p => `<option value="${esc(p.id)}" ${p.id === cfg.productId ? 'selected' : ''}>${esc(p.name)}</option>`)).join('');
    return `<div class="sr-row" data-slot="${cfg.slot}">
      <div><strong>WhatsApp ${cfg.slot}</strong><span class="sr-hint">${connected ? esc(live.phone || 'Conectado') : 'Não conectado'}</span></div>
      <label>O que o robô faz neste número<select data-field="mode">${modeOptions}</select></label>
      <label>Produto<select data-field="productId" ${cfg.mode === 'PRODUCT' ? '' : 'disabled'}>${productOptions}</select></label>
      <button class="primary" data-action="save-slot">Salvar</button>
    </div>`;
  }

  function productRow(p) {
    const link = adLink(p);
    const linkBlock = link
      ? `<span class="sr-hint">Link para usar no anúncio:</span><span class="sr-link">${esc(link)}</span>`
      : `<span class="sr-hint">${p.code ? 'Conecte um número de WhatsApp para gerar o link do anúncio.' : 'Defina um código de campanha para gerar o link do anúncio.'}</span>`;
    return `<div class="sr-product">
      <div>
        <strong>${esc(p.name)}</strong> ${p.active === false ? '<span class="pill">Desativado</span>' : ''}
        <div class="sr-hint">Código: <code>${esc(p.code || 'sem código')}</code> · Origem: ${esc(SOURCE_LABEL[p.source] || p.source)}${p.price ? ` · Valor: ${esc(p.price)}` : ''}</div>
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
    return `<form class="sr-form" data-form="product">
      <input type="hidden" name="id" value="${esc(p.id || '')}">
      <label>Nome do produto<input name="name" required maxlength="${limits.name || 80}" value="${esc(p.name || '')}"></label>
      <label>Link de afiliado (página oficial)<input name="link" required type="url" placeholder="https://" maxlength="${limits.link || 500}" value="${esc(p.link || '')}"></label>
      <label>Código da campanha<input name="code" maxlength="${limits.code || 20}" placeholder="Ex.: EMAG" value="${esc(p.code || '')}"><span class="sr-hint">Vai no link do anúncio. É assim que o CRM sabe de qual anúncio o cliente veio.</span></label>
      <label>Valor (opcional)<input name="price" maxlength="${limits.price || 80}" placeholder="Ex.: R$ 197,00" value="${esc(p.price || '')}"><span class="sr-hint">O robô só cita valor se estiver escrito aqui.</span></label>
      <label>Origem dos anúncios<select name="source">${sourceOptions}</select></label>
      <label>Situação<select name="active"><option value="true" ${p.active === false ? '' : 'selected'}>Ativo</option><option value="false" ${p.active === false ? 'selected' : ''}>Desativado</option></select></label>
      <label class="sr-wide">Apresentação (primeira mensagem do robô)<textarea name="pitch" maxlength="${limits.pitch || 600}" placeholder="Em duas ou três frases: o que é o produto e para quem serve.">${esc(p.pitch || '')}</textarea></label>
      <label class="sr-wide">O que o robô pode dizer sobre o produto<textarea name="knowledge" maxlength="${limits.knowledge || 6000}" style="min-height:150px" placeholder="Conteúdo, forma de acesso, garantia, formas de pagamento, dúvidas frequentes. O robô responde só com o que estiver aqui.">${esc(p.knowledge || '')}</textarea></label>
      <div class="sr-wide sr-actions" style="justify-content:flex-start">
        <button class="primary" type="submit">Salvar produto</button>
        <button class="ghost" type="button" data-action="cancel-product">Cancelar</button>
      </div>
    </form>`;
  }

  function render() {
    const el = root();
    if (!el) return;
    styles();
    if (!state.settings) { el.innerHTML = '<h3>Robô de vendas</h3><p class="muted">Carregando...</p>'; return; }
    const s = state.settings;
    const products = s.products || [];
    const aiPill = s.ai?.enabled
      ? '<span class="pill green">IA ligada</span>'
      : '<span class="pill">IA desligada</span>';
    const aiNote = s.ai?.enabled
      ? 'Com a IA ligada, o robô responde dúvidas usando só o que está no cadastro do produto. Preço ou link fora do cadastro são bloqueados.'
      : 'Sem IA, o robô apresenta o produto, envia o link e passa as dúvidas para você atender.';
    const diskWarning = s.persistent ? '' : '<div class="warning"><strong>Configuração temporária</strong><p>Esta configuração está em disco temporário e será perdida quando o servidor reiniciar. Enquanto isso não for corrigido, o robô volta a ficar desligado a cada reinício.</p></div>';
    const message = state.message ? `<div class="sr-msg ${state.message.ok ? 'ok' : 'danger'}" role="status">${esc(state.message.text)}</div>` : '';
    el.innerHTML = `
      <div class="card-head"><div><h3>Robô de vendas</h3><p class="muted">Escolha o que cada número faz quando um cliente chama. Vale para qualquer número conectado.</p></div>${aiPill}</div>
      ${diskWarning}
      <h4>Números</h4>
      ${s.slots.map(slotRow).join('')}
      <p class="sr-hint" style="margin-top:10px">${esc(aiNote)}</p>
      <div class="card-head" style="margin:26px 0 0"><h4 style="margin:0">Produtos</h4>${state.editing ? '' : '<button class="ghost" data-action="new-product">+ Novo produto</button>'}</div>
      ${products.length ? products.map(productRow).join('') : '<p class="muted">Nenhum produto cadastrado. Cadastre o primeiro para o robô poder vender.</p>'}
      ${state.editing ? productForm() : ''}
      ${message}`;
  }

  async function load() {
    if (!root()) return;
    try {
      const [settings, wa] = await Promise.all([api('/api/sdr/settings'), api('/api/whatsapp/slots').catch(() => ({ slots: [] }))]);
      state.settings = settings;
      state.slots = Array.isArray(wa.slots) ? wa.slots : [];
    } catch (error) {
      const el = root();
      if (el) el.innerHTML = `<h3>Robô de vendas</h3><p class="danger">${esc(errorText(error))}</p>`;
      return;
    }
    render();
  }

  function notify(text, ok = true) { state.message = { text, ok }; render(); }

  function onChange(event) {
    const select = event.target.closest('select[data-field="mode"]');
    if (!select) return;
    const productSelect = select.closest('.sr-row').querySelector('select[data-field="productId"]');
    productSelect.disabled = select.value !== 'PRODUCT';
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
    if (action === 'save-slot') {
      const row = button.closest('.sr-row');
      const mode = row.querySelector('[data-field="mode"]').value;
      const productId = row.querySelector('[data-field="productId"]').value || null;
      button.disabled = true;
      try {
        await api(`/api/sdr/slots/${row.dataset.slot}`, { method: 'POST', body: JSON.stringify({ mode, productId }) });
        await load();
        notify(`WhatsApp ${row.dataset.slot}: ${MODE_LABEL[mode]}.`);
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
      let msg = form.parentElement.querySelector('.sr-msg');
      if (!msg) { msg = document.createElement('div'); form.parentElement.appendChild(msg); }
      msg.className = 'sr-msg danger';
      msg.setAttribute('role', 'alert');
      msg.textContent = errorText(error);
    }
  }

  function boot() {
    if (boot.done) return;
    boot.done = true;
    document.querySelectorAll('.nav[data-view="ia"]').forEach(b => b.addEventListener('click', () => setTimeout(load, 80)));
    document.querySelectorAll('[data-goto="ia"]').forEach(b => b.addEventListener('click', () => setTimeout(load, 80)));
    if (document.querySelector(`${VIEW}.active`)) load();
  }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
