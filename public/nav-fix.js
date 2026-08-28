(function(){
  function bind(){
    document.querySelectorAll('.nav').forEach(function(button){
      button.onclick=function(e){
        e.preventDefault();
        var view=button.getAttribute('data-view');
        document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});
        var target=document.getElementById('view-'+view);
        if(target)target.classList.add('active');
        document.querySelectorAll('.nav').forEach(function(b){b.classList.toggle('active',b===button)});
        var titles={dashboard:'Visão geral',inbox:'Conversas',leads:'Clientes e leads',whatsapp:'WhatsApp',ia:'Assistente comercial',settings:'Preferências'};
        var title=document.getElementById('page-title');
        if(title)title.textContent=titles[view]||view;
        try{
          if(view==='leads'&&typeof window.renderLeads==='function')window.renderLeads();
          if(view==='inbox'&&typeof window.renderContacts==='function')window.renderContacts();
          if(view==='whatsapp'&&typeof window.renderSlots==='function')window.renderSlots();
        }catch(error){console.error('CRM_NAV_RENDER_ERROR',error)}
      };
    });
    document.querySelectorAll('[data-goto]').forEach(function(button){button.onclick=function(e){e.preventDefault();var target=document.querySelector('.nav[data-view="'+button.getAttribute('data-goto')+'"]');if(target)target.click()}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
