(() => {
  const q = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields = [
    ['name','Nome do cliente / responsável'],['phone','WhatsApp / Telefone'],['cnpj','CNPJ'],['companyName','Razão social'],
    ['tradeName','Nome fantasia'],['interest','Interesse'],['bankCurrent','Banco atual'],['machineCurrent','Máquina atual'],
    ['monthlyRevenue','Faturamento mensal'],['painPoint','Necessidade / dor'],['owner','Responsável interno'],
    ['nextAction','Próxima ação'],['status','Status comercial'],['source','Origem'],['campaign','Campanha'],
    ['address','Logradouro'],['addressNumber','Número'],['neighborhood','Bairro'],['city','Cidade'],['state','Estado'],['zipCode','CEP'],['companyStatus','Situação da empresa']
  ];
  function injectStyles(){
    if(q('#crm-enhancement-style')) return;
    const s=document.createElement('style');s.id='crm-enhancement-style';s.textContent=`
      .crm-edit-btn{margin-left:auto;white-space:nowrap}.crm-modal{position:fixed;inset:0;background:rgba(3,7,18,.72);backdrop-filter:blur(8px);display:grid;place-items:center;z-index:100}.crm-modal-card{width:min(760px,94vw);max-height:88vh;overflow:auto;background:#11182b;border:1px solid #2b3857;border-radius:18px;padding:22px;box-shadow:0 25px 80px rgba(0,0,0,.45)}.crm-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.crm-edit-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.crm-edit-grid label{display:grid;gap:6px;color:#93a0b8;font-size:12px}.crm-edit-grid input,.crm-edit-grid select,.crm-edit-grid textarea{background:#0b1222;border:1px solid #24304a;border-radius:9px;color:#fff;padding:10px;font:inherit}.crm-edit-grid textarea{min-height:72px;resize:vertical}.crm-edit-wide{grid-column:1/-1}.crm-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}@media(max-width:700px){.crm-edit-grid{grid-template-columns:1fr}.crm-edit-wide{grid-column:auto}.crm-edit-btn{margin-left:0}}
    `;document.head.appendChild(s);
  }
  function currentLead(){return state?.selected||null}
  function makeField(key,label,lead){
    const value=lead?.[key] ?? '';
    if(key==='interest') return `<label>${label}<select name="${key}"><option value="">Selecione</option><option ${value==='Conta PJ'?'selected':''}>Conta PJ</option><option ${value==='Máquina de cartão'?'selected':''}>Máquina de cartão</option><option ${value==='Conta PJ + Máquina'?'selected':''}>Conta PJ + Máquina</option><option ${value==='Outro'?'selected':''}>Outro</option></select></label>`;
    if(key==='status') return `<label>${label}<select name="${key}"><option value="">Selecione</option><option ${value==='NEW'?'selected':''} value="NEW">Novo</option><option ${value==='QUALIFYING'?'selected':''} value="QUALIFYING">Em qualificação</option><option ${value==='QUALIFIED'?'selected':''} value="QUALIFIED">Qualificado</option><option ${value==='ACCEPTED'?'selected':''} value="ACCEPTED">Oportunidade</option><option ${value==='SCHEDULING'?'selected':''} value="SCHEDULING">Agendamento</option><option ${value==='CONFIRMED'?'selected':''} value="CONFIRMED">Confirmado</option><option ${value==='NEGOTIATION'?'selected':''} value="NEGOTIATION">Negociação</option><option ${value==='AGUARDANDO_RETORNO'?'selected':''} value="AGUARDANDO_RETORNO">Aguardando retorno</option><option ${value==='AGUARDANDO_RETORNO_DO_LUIS'?'selected':''} value="AGUARDANDO_RETORNO_DO_LUIS">Aguardando atendimento</option><option ${value==='CONVERTIDO'?'selected':''} value="CONVERTIDO">Convertido</option><option ${value==='PERDIDO'?'selected':''} value="PERDIDO">Encerrado</option></select></label>`;
    if(key==='painPoint') return `<label class="crm-edit-wide">${label}<textarea name="${key}">${esc(value)}</textarea></label>`;
    return `<label>${label}<input name="${key}" value="${esc(value)}"></label>`;
  }
  function openEditor(){
    const lead=currentLead();if(!lead)return;
    injectStyles();
    const modal=document.createElement('div');modal.className='crm-modal';modal.id='crm-edit-modal';
    modal.innerHTML=`<div class="crm-modal-card"><div class="crm-modal-head"><div><h3>Editar cliente</h3><p class="muted">Atualize nome, dados da empresa e informações comerciais internas.</p></div><button class="ghost" id="crm-edit-close" type="button">Fechar</button></div><form id="crm-edit-form" class="crm-edit-grid">${fields.map(([k,l])=>makeField(k,l,lead)).join('')}<div class="crm-edit-wide"><p id="crm-edit-error" class="danger"></p></div><div class="crm-edit-wide crm-modal-actions"><button type="button" class="ghost" id="crm-edit-cancel">Cancelar</button><button type="submit" class="primary">Salvar alterações</button></div></form></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();q('#crm-edit-close').onclick=close;q('#crm-edit-cancel').onclick=close;
    q('#crm-edit-form').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;try{const data=Object.fromEntries(new FormData(e.currentTarget).entries());data.phone=String(data.phone||'').replace(/\D/g,'');data.cnpj=String(data.cnpj||'').replace(/\D/g,'');const r=await api(`/api/crm/leads/${encodeURIComponent(lead.id)}`,{method:'PATCH',body:JSON.stringify(data)});const idx=state.leads.findIndex(x=>String(x.id)===String(lead.id));if(idx>=0)state.leads[idx]=r.lead;state.selected=r.lead;close();renderDashboard();renderLeads();renderContacts();await showConversation(lead.id);toast('Dados do cliente atualizados');}catch(err){q('#crm-edit-error').textContent=err?.data?.error||err?.message||'Não foi possível salvar as alterações.';}finally{btn.disabled=false}};
  }
  function addEditButton(){
    const head=q('.chat-head');if(!head)return;
    let b=q('#crm-edit-lead');
    if(!b){b=document.createElement('button');b.id='crm-edit-lead';b.className='ghost crm-edit-btn';b.type='button';b.textContent='Editar cliente';head.appendChild(b)}
    b.onclick=openEditor;
  }
  function wireComposer(){
    const form=q('#send-form');if(!form||form.dataset.crmEnhanced==='1')return;form.dataset.crmEnhanced='1';form.onsubmit=async e=>{e.preventDefault();const lead=currentLead(),input=q('#send-text');const text=String(input?.value||'').trim();if(!lead||!text)return;const btn=form.querySelector('button');btn.disabled=true;try{await api(`/api/crm/leads/${encodeURIComponent(lead.id)}/messages`,{method:'POST',body:JSON.stringify({text})});input.value='';await showConversation(lead.id);toast('Mensagem enviada pelo WhatsApp');}catch(err){toast(err?.data?.error||err?.message||'Não foi possível enviar a mensagem.');}finally{btn.disabled=false}};
  }
  function wrapConversation(){
    if(typeof window.showConversation!=='function'||window.__crmEnhancedConversation)return;
    const original=window.showConversation;window.showConversation=async function(id){const r=await original(id);addEditButton();wireComposer();return r};window.__crmEnhancedConversation=true;
  }
  function enhance(){wrapConversation();addEditButton();wireComposer()}
  window.addEventListener('load',enhance);setInterval(enhance,1500);
})();
