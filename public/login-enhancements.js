document.addEventListener('DOMContentLoaded',()=>{
  const form=document.querySelector('#login-form');
  const password=document.querySelector('#login-password');
  if(password&&!password.dataset.toggleReady){
    password.dataset.toggleReady='1';
    const wrap=password.parentElement;
    if(wrap){
      wrap.style.position='relative';
      const button=document.createElement('button');
      button.type='button';
      button.className='password-toggle';
      button.setAttribute('aria-label','Mostrar senha');
      button.setAttribute('title','Mostrar senha');
      button.textContent='👁';
      Object.assign(button.style,{position:'absolute',right:'10px',bottom:'10px',border:'0',background:'transparent',cursor:'pointer',fontSize:'18px',lineHeight:'1',padding:'6px',opacity:'0.8'});
      button.addEventListener('click',()=>{
        const visible=password.type==='text';
        password.type=visible?'password':'text';
        button.textContent=visible?'👁':'🙈';
        button.setAttribute('aria-label',visible?'Mostrar senha':'Ocultar senha');
        button.setAttribute('title',visible?'Mostrar senha':'Ocultar senha');
      });
      wrap.appendChild(button);
      password.style.paddingRight='48px';
    }
  }
  if(!form)return;
  form.onsubmit=async(e)=>{
    e.preventDefault();
    const error=document.querySelector('#login-error');
    const submit=form.querySelector('button[type="submit"]');
    if(error)error.textContent='';
    if(submit){submit.disabled=true;submit.textContent='Entrando...'}
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:(document.querySelector('#login-user')?.value||'').trim(),password:password?.value||''})});
      let data={};
      try{data=await r.json()}catch{}
      if(!r.ok||!data.token)throw new Error('INVALID_CREDENTIALS');
      sessionStorage.setItem('crm_token',data.token);
      window.location.reload();
    }catch(err){
      if(error)error.textContent=err.name==='TypeError'?'Não foi possível conectar ao servidor.':'Não foi possível acessar. Confira seus dados.';
      if(submit){submit.disabled=false;submit.textContent='Entrar'}
    }
  };
});
