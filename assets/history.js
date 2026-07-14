const cfg=window.INFO2_GAS_CONFIG||{};
let token='',user=null;
const TOKEN_KEY='info2_id_token';
const $=id=>document.getElementById(id);

function decode(t){
  try{return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))))}
  catch(e){return null}
}

function isValidToken(t){
  const u=decode(t);
  if(!u||!u.email)return null;
  if(Number(u.exp||0)*1000<=Date.now())return null;
  const suffix=cfg.allowedDomainSuffix||'.ed.jp';
  if(!u.email.endsWith(suffix))return null;
  return u;
}

function render(){
  const s=$('history-auth-status'),d=s.querySelector('.auth-dot'),t=s.querySelector('span:last-child');
  if(user){
    d.classList.add('ok');
    t.textContent=`${user.email} でログイン中`;
    $('open-history').disabled=false;
  }else{
    d.classList.remove('ok');
    t.textContent='ログインしていません';
    $('open-history').disabled=true;
  }
}

window.handleHistoryCredential=r=>{
  const candidate=r.credential;
  const candidateUser=isValidToken(candidate);
  const suffix=cfg.allowedDomainSuffix||'.ed.jp';
  if(!candidateUser){
    token='';user=null;
    sessionStorage.removeItem(TOKEN_KEY);
    $('history-warning').classList.remove('hidden');
    $('history-warning').textContent=`${suffix}で終わる学校アカウントを使用してください。`;
  }else{
    token=candidate;
    user=candidateUser;
    sessionStorage.setItem(TOKEN_KEY,token);
    $('history-warning').classList.add('hidden');
  }
  render();
};

function restoreLogin(){
  const saved=sessionStorage.getItem(TOKEN_KEY);
  if(!saved)return;
  const savedUser=isValidToken(saved);
  if(savedUser){token=saved;user=savedUser}
  else sessionStorage.removeItem(TOKEN_KEY);
}

function init(){
  restoreLogin();
  if(!cfg.googleClientId||!cfg.webAppUrl){
    $('history-warning').classList.remove('hidden');
    $('history-warning').textContent='Google連携の設定を読み込めません。更新時に assets/gas-config.js が初期化または削除された可能性があります。以前の設定を復元するか、setup.html の手順で再設定してください。';
  }
  if(!cfg.googleClientId)return;
  const wait=()=>{
    if(!window.google?.accounts?.id){setTimeout(wait,100);return}
    google.accounts.id.initialize({client_id:cfg.googleClientId,callback:window.handleHistoryCredential,auto_select:false});
    google.accounts.id.renderButton($('history-google-button'),{theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'ja',width:260});
  };
  wait();
}

document.addEventListener('DOMContentLoaded',()=>{
  init();
  render();
  $('open-history').onclick=()=>{
    if(!token||!cfg.webAppUrl)return;
    const f=document.createElement('form');
    f.method='POST';
    f.action=cfg.webAppUrl;
    f.target='_self';
    const submissionUrl=new URL('submission.html?from=history',location.href).href;
    [['action','history'],['idToken',token],['submissionUrl',submissionUrl]].forEach(([n,v])=>{
      const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i)
    });
    document.body.appendChild(f);
    f.submit();
  };
});
