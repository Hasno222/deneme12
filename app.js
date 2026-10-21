const SUPABASE_URL='https://bgugtvlixerwlhrgqmfw.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_V11Gt6rJmKP90QQ4G7L-ag_1NpCea-i';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

const PAGE=12;let FREE_LIMIT=2;
const CURS=['TL','Yang'];
const SERVERS=['Alesta','Tramola','Tuva','Yakamoz'];
const UNITS=['Won','KK'];
const PLUS=['+9','+8','+7','+6','+5','+4','+3','+2','+1','+0'];
let CATALOG=[], EFSUN=[], STONES=[], active=0, editId=null, efShown=2;
const STONE_CATS=['Silah','Zırh'];
const cache=new Map();

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(arr,first)=>(first?`<option value="">${first}</option>`:'')+arr.map(v=>`<option>${esc(v)}</option>`).join('');
const clean=s=>s.trim().replace(/[%*,()\\]/g,' ').replace(/\s+/g,' ');

let user=null, view='items', page=0, total=0, timer, toastT, authMode='in', recovery=false;

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}

/* ---------- Kurulum ---------- */
$('#fPlus').innerHTML=opts(PLUS,'Hepsi');$('#pPlus').innerHTML=opts(PLUS);
$('#fCur').innerHTML=opts(CURS,'Hepsi');$('#pCur').innerHTML=opts(CURS);
$('#fSrv').innerHTML=opts(SERVERS,'Hepsi');$('#fySrv').innerHTML=opts(SERVERS,'Hepsi');
$('#pSrv').innerHTML=opts(SERVERS,'Sunucu seç');$('#ySrv').innerHTML=opts(SERVERS,'Sunucu seç');
$('#fyUnit').innerHTML=opts(UNITS,'Hepsi');$('#yUnit').innerHTML=opts(UNITS);
let lastErr='';
addEventListener('error',e=>{lastErr=String(e.message||'').slice(0,200)});
addEventListener('unhandledrejection',e=>{lastErr=String((e.reason&&e.reason.message)||e.reason||'').slice(0,200)});
const fmt=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
const nowIso=()=>new Date().toISOString();
const prefSrv=()=>{try{return localStorage.getItem('srv')||''}catch{return ''}};
const savePref=v=>{try{localStorage.setItem('srv',v)}catch{}};
const contactErr=(n,c)=>{
  if(n&&n.length<2)return 'Karakter adı en az 2 karakter olmalı.';
  if(c&&(c.length<3||/https?:|www\.|\.com|\.net/i.test(c)))return 'İletişim en az 3 karakter olmalı ve bağlantı içermemeli.';
  if(!n&&!c)return 'Karakter adı veya iletişimden en az birini yaz.';
  return '';
};
async function initCatalog(){
  const [a,b,c]=await Promise.all([sb.from('item_catalog').select('category,name').order('name'),sb.from('efsun_catalog').select('name').order('name'),sb.from('stone_catalog').select('name').order('name')]);
  if(a.error||b.error||c.error){toast('Katalog yüklenemedi. supabase.sql dosyasını çalıştırdın mı?');return}
  CATALOG=a.data;EFSUN=b.data.map(x=>x.name);STONES=c.data.map(x=>x.name);
  const cats=[...new Set(CATALOG.map(x=>x.category))].sort((x,y)=>x.localeCompare(y,'tr'));
  $('#fCat').innerHTML=opts(cats,'Hepsi');$('#pCat').innerHTML=opts(cats,'Kategori seç');
  fillNames();
  $('#efRows').innerHTML=[1,2,3,4,5,6].map(i=>`<div class="ef${i>2?' x':''}" id="efr${i}"><select id="ef${i}n" aria-label="Efsun ${i}">${opts(EFSUN,'Efsun '+i+(i>2?'':' (zorunlu)'))}</select><input id="ef${i}v" class="efv" type="text" inputmode="numeric" maxlength="2" placeholder="1-15" autocomplete="off" aria-label="Efsun ${i} değeri">${i>2?`<button class="btn sm bad" type="button" data-rm="${i}" aria-label="Efsunu kaldır">×</button>`:''}</div>`).join('');
  efLayout();
}
function efLayout(){
  for(let n=1;n<=6;n++){const r=$('#efr'+n);if(r)r.classList.toggle('hide',n>efShown)}
  $('#addEf').classList.toggle('hide',efShown>=6);
}
function setEfsuns(item){
  const vals=[];
  if(item)for(let n=1;n<=6;n++){const e=(item['efsun_'+n]||'').match(/^(.*) \+(\d+)$/);if(e)vals.push(e)}
  efShown=Math.max(2,vals.length);
  for(let n=1;n<=6;n++){const e=vals[n-1];$(`#ef${n}n`).value=e?e[1]:'';$(`#ef${n}v`).value=e?e[2]:''}
  efLayout();
}
function efRemove(k){
  const vals=[];
  for(let n=1;n<=efShown;n++)if(n!==k)vals.push([$(`#ef${n}n`).value,$(`#ef${n}v`).value]);
  efShown--;
  for(let n=1;n<=6;n++){const v=vals[n-1]||['',''];$(`#ef${n}n`).value=v[0];$(`#ef${n}v`).value=v[1]}
  efLayout();
}
function stLayout(){$('#addSt').classList.toggle('hide',$('#stRows').children.length>=4)}
function toggleStone(){
  const on=STONE_CATS.includes($('#pCat').value);
  $('#stoneBox').classList.toggle('hide',!on);
  if(!on)$('#stRows').innerHTML='';
  stLayout();
}
function addStone(n,v){
  if($('#stRows').children.length>=4)return;
  const d=document.createElement('div');d.className='ef x';
  d.innerHTML=`<select class="sn" aria-label="Taş">${opts(STONES,'Taş seç')}</select><select class="sv" aria-label="Taş artısı">${opts(['+1','+2','+3','+4'])}</select><button class="btn sm bad" type="button" data-rmst aria-label="Taşı kaldır">×</button>`;
  d.querySelector('.sn').value=n||'';if(v)d.querySelector('.sv').value=v;
  $('#stRows').appendChild(d);stLayout();
}
function fillNames(){const c=$('#pCat').value;$('#pName').innerHTML=opts(CATALOG.filter(x=>x.category===c).map(x=>x.name),c?'İtem seç':'Önce kategori seç')}
async function refreshQuota(){
  if(!user){active=0;FEAT_LIMIT=0;MYRENT=[];$('#quotaBar').classList.add('hide');return}
  const now=nowIso();
  const c=(t,f)=>{const q=sb.from(t).select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('status','active').gt('expires_at',now);return f?q.eq('featured',true):q};
  const [a,b,l,fl,fa,fb,rn]=await Promise.all([c('items'),c('yang_listings'),sb.rpc('my_limit'),sb.rpc('my_featured_limit'),c('items',1),c('yang_listings',1),
    sb.from('premium_rentals').select('pos,ends_at').eq('user_id',user.id).lte('starts_at',now).gt('ends_at',now)]);
  active=(a.count||0)+(b.count||0);FEAT_USED=(fa.count||0)+(fb.count||0);
  if(typeof l.data==='number')FREE_LIMIT=l.data;
  FEAT_LIMIT=typeof fl.data==='number'?fl.data:0;MYRENT=rn.data||[];
  $('#quotaTxt').textContent=`Aktif ilan: ${active}/${FREE_LIMIT}`+(cb('featured_enabled')?` · ⭐ Öne çıkarma: ${FEAT_USED}/${FEAT_LIMIT}`:'')+(MYRENT.length?` · 💎 Premium alan: ${MYRENT.map(r=>'#'+r.pos).join(', ')}`:'');
  $('#quotaBar').classList.toggle('hide',view!=='mine');
}
const dbErr=m=>/check constraint/i.test(m)?'Girdiğin bilgiler kurallara uymuyor. Alanları kontrol et.':m;

/* ---------- Oturum ---------- */
function renderAuth(){
  $('#authBar').innerHTML=user
    ?`<span class="seller" style="margin-right:8px">${esc(user.email)}</span><button class="btn sm" id="outBtn">Çıkış</button>`
    :`<button class="btn sm gold" id="inBtn">Giriş / Kayıt</button>`;
  $('#tabMine').classList.toggle('hide',!user);
  $('#tabAdmin').classList.toggle('hide',!isAdmin);
  applyCfg();
  if(!user&&view==='mine'){setView('items');return}
}
async function setUser(u){user=u;isAdmin=false;renderAuth();if(u){try{const {data}=await sb.rpc('is_admin');isAdmin=data===true}catch{}renderAuth()}load(true)}
sb.auth.getSession().then(({data})=>setUser(data.session?.user||null));
sb.auth.onAuthStateChange((ev,s)=>{
  if(ev==='PASSWORD_RECOVERY'){recovery=true;openAuth('recover')}
  if(ev==='SIGNED_IN'||ev==='SIGNED_OUT'){ if((s?.user?.id||null)!==(user?.id||null)) setUser(s?.user||null) }
});

function openAuth(mode){
  authMode=mode;$('#authErr').textContent='';
  const rec=mode==='recover';
  $('#authModes').classList.toggle('hide',rec);
  $('#emailRow').classList.toggle('hide',rec);
  $('#forgot').classList.toggle('hide',rec);
  $('#consentRow').classList.toggle('hide',mode!=='up');
  $('#oauthRow').classList.toggle('hide',rec||!(cb('oauth_google',false)||cb('oauth_discord',false)));
  document.querySelectorAll('#authModes .tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.mode===mode));
  $('#authTitle').textContent=rec?'Yeni şifre belirle':mode==='in'?'Giriş yap':'Kayıt ol';
  $('#passLbl').textContent=rec?'Yeni şifre':'Şifre';
  $('#authGo').textContent=rec?'Şifreyi kaydet':mode==='in'?'Giriş yap':'Kayıt ol';
  if(!$('#authDlg').open)$('#authDlg').showModal();
}
async function authSubmit(){
  const email=$('#email').value.trim(),password=$('#pass').value,err=$('#authErr'),btn=$('#authGo');
  err.textContent='';
  if(authMode!=='recover'&&!/^\S+@\S+\.\S+$/.test(email)){err.textContent='Geçerli bir e-posta gir.';return}
  if(password.length<6){err.textContent='Şifre en az 6 karakter olmalı.';return}
  if(authMode==='up'&&!cb('signups_open')){err.textContent='Yeni kayıtlar şu an kapalı.';return}
  if(authMode==='up'&&!$('#consent').checked){err.textContent='Devam etmek için şartları kabul etmelisin.';return}
  btn.disabled=true;
  let r;
  if(authMode==='recover'){r=await sb.auth.updateUser({password});if(!r.error){recovery=false;toast('Şifren güncellendi.');$('#authDlg').close()}}
  else if(authMode==='up'){
    r=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(!r.error){ if(r.data.session){toast('Kayıt tamamlandı, hoş geldin!')}else{toast('Kayıt alındı. E-postandaki bağlantıyla hesabını doğrula.')} $('#authDlg').close()}
  }else{
    r=await sb.auth.signInWithPassword({email,password});
    if(!r.error){toast('Giriş yapıldı.');$('#authDlg').close()}
  }
  btn.disabled=false;
  if(r.error)err.textContent=trErr(r.error.message);
}
function trErr(m){
  if(/Invalid login/i.test(m))return 'E-posta veya şifre hatalı.';
  if(/already registered/i.test(m))return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if(/Email not confirmed/i.test(m))return 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.';
  if(/rate limit|too many/i.test(m))return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if(/password/i.test(m))return 'Şifre geçersiz: en az 6 karakter kullan.';
  return 'Bir hata oluştu: '+m;
}
async function forgot(){
  const email=$('#email').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){$('#authErr').textContent='Önce e-posta adresini yaz.';return}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)$('#authErr').textContent=trErr(error.message);
  else{toast('Sıfırlama bağlantısı e-postana gönderildi.');$('#authDlg').close()}
}

/* ---------- İlanları yükle ---------- */
function setView(v){
  view=v;
  const T={items:'#tabItems',yang:'#tabYang',feat:'#tabFeat',prem:'#tabPrem',mine:'#tabMine'};
  for(const k in T)$(T[k]).setAttribute('aria-selected',k===v);
  $('#fItems').classList.toggle('hide',v!=='items');
  $('#fYang').classList.toggle('hide',v!=='yang');
  $('#resetBtn').classList.toggle('hide',!(v==='items'||v==='yang'));
  const note=v==='feat'?(CFG.featured_text||'Öne çıkarılan ilanlar burada ve listelerin en üstünde görünür.'):v==='prem'?(CFG.premium_text||'Premium alanlar zamana göre kiralanır.'):'';
  $('#viewNote').textContent='';if(note){$('#viewNote').innerHTML='<span>'+(v==='prem'?'💎 ':'⭐ ')+esc(note)+'</span>'}
  $('#viewNote').classList.toggle('hide',!note);
  load(true);
}
let loadTok=0,fresh=0,isAdmin=false;
let FEAT_LIMIT=0,FEAT_USED=0,MYRENT=[],OFFERS=[],SHARE=null,ADS={top:[],feed:[],bottom:[]};const adSeen=new Set();
async function load(reset){
  const tok=++loadTok;
  if(reset){page=0;fresh=0;$('#freshBar').classList.add('hide');$('#list').innerHTML='<div class="skel"></div><div class="skel"></div>';$('#moreBtn').classList.add('hide')}
  if(view==='feat')return loadFeat(tok);
  if(view==='prem')return loadPrem(tok);
  let html='',cnt=0,err=null;
  if(view==='mine'){
    if(!user)return;
    const mk=t=>sb.from(t).select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
    const [a,b]=await Promise.all([mk('items'),mk('yang_listings')]);
    err=a.error||b.error;
    if(!err){
      cnt=total=a.data.length+b.data.length;
      html=(a.data.length?`<h4 class="sec">İtem ilanlarım (${a.data.length})</h4>`+a.data.map(card).join(''):'')+(b.data.length?`<h4 class="sec">Yang ilanlarım (${b.data.length})</h4>`+b.data.map(yangCard).join(''):'');
    }
  }else{
    const isY=view==='yang';
    let q=sb.from(isY?'yang_listings':'items').select('*',{count:'exact'}).eq('status','active').gt('expires_at',nowIso());
    if(isY){
      if($('#fySrv').value)q=q.eq('server',$('#fySrv').value);
      if($('#fyUnit').value)q=q.eq('unit',$('#fyUnit').value);
      const s=$('#fySort').value;
      if(s==='low')q=q.order('unit_price',{ascending:true});
      else if(s==='high')q=q.order('unit_price',{ascending:false});
    }else{
      const name=clean($('#fName').value),ef=clean($('#fEfsun').value);
      if(name)q=q.ilike('item_name',`%${name}%`);
      if(ef)q=q.or(['efsun_1','efsun_2','efsun_3','efsun_4','efsun_5','efsun_6'].map(c=>`${c}.ilike.%${ef}%`).join(','));
      if($('#fCat').value)q=q.eq('category',$('#fCat').value);
      if($('#fPlus').value)q=q.ilike('item_name',`%${$('#fPlus').value}`);
      if($('#fCur').value)q=q.eq('currency',$('#fCur').value);
      if($('#fSrv').value)q=q.eq('server',$('#fSrv').value);
      const s=$('#fSort').value;
      if(s==='low')q=q.order('price_value',{ascending:true,nullsFirst:false});
      else if(s==='high')q=q.order('price_value',{ascending:false,nullsFirst:false});
    }
    const sv=isY?$('#fySort').value:$('#fSort').value;if(sv!=='low'&&sv!=='high')q=q.order('featured',{ascending:false});
    q=q.order('created_at',{ascending:false}).range(page*PAGE,page*PAGE+PAGE-1);
    const r=await q;err=r.error;
    if(!err){total=r.count||0;cnt=r.data.length;html=withAds(r.data,isY?yangCard:card,page*PAGE)}
  }
  if(tok!==loadTok)return;
  if(err){$('#list').innerHTML=`<div class="empty" style="grid-column:1/-1">İlanlar yüklenemedi. Bağlantını kontrol edip tekrar dene.<br><small>${esc(err.message)}</small></div>`;return}
  if(reset)$('#list').innerHTML='';
  if(!cnt&&reset){
    $('#list').innerHTML=`<div class="empty" style="grid-column:1/-1">${view==='mine'?'Henüz ilanın yok. "İlan ver" ile ilk ilanını ekle.':view==='yang'?'Bu kriterlere uygun yang ilanı yok.':'Bu kriterlere uygun ilan bulunamadı. Filtreleri gevşetmeyi dene.'}</div>`;
  }else $('#list').insertAdjacentHTML('beforeend',html);
  const shown=$('#list').querySelectorAll('.card').length;
  $('#count').textContent=total?`${total} ilan`:'';
  $('#moreBtn').classList.toggle('hide',view==='mine'||shown>=total);
  refreshQuota();paintAds();
  if(view==='yang'){if(reset)yangStats()}else $('#mkt').classList.add('hide');
}
function parts(i,k,o){
  const pr=!!o&&o.prem===true;
  cache.set(k+i.id,i);
  const ms=new Date(i.expires_at)-Date.now(),expired=ms<=0,sold=i.status==='sold',mine=user&&user.id===i.user_id;
  const st=sold?'<span class="tag st">Satıldı</span>':expired?'<span class="tag st">Süresi doldu</span>':'';
  const tags=`<div class="tags">${i.featured?'<span class="badge">⭐ Öne çıkan</span>':''}${pr?'<span class="badge prem">💎 Premium</span>':''}${i.server?`<span class="tag srv">📍 ${esc(i.server)}</span>`:''}${st}</div>`;
  const who=(i.seller_name?`<span>Karakter adı: <b>${esc(i.seller_name)}</b></span>`:'')+(i.contact_info?`<span>İletişim: <b>${esc(i.contact_info)}</b></span>`:'')||'<span>İletişim bilgisi yok</span>';
  const d=`data-k="${k}" data-id="${i.id}"`;
  const acts=mine
    ?`${ownerExtra(i,d,sold,expired)}<button class="btn sm" data-act="share" ${d} aria-label="Paylaş">🔗</button><button class="btn sm" data-act="edit" ${d}>Düzenle</button>${!sold&&!expired?`<button class="btn sm ok" data-act="sold" ${d}>Satıldı</button>`:`<button class="btn sm ok" data-act="renew" ${d}>Yenile</button>`}<button class="btn sm bad" data-act="del" ${d}>Sil</button>`
    :`<button class="btn sm" data-act="share" ${d} aria-label="Paylaş">🔗</button>${i.seller_name?`<button class="btn sm gold" data-act="copy" data-nick="${esc(i.seller_name)}">/w kopyala</button>`:''}<button class="btn sm" data-act="report" ${d} aria-label="İlanı şikayet et">🚩</button>${isAdmin?`<button class="btn sm bad" data-act="adel" ${d}>🛡 Sil</button><button class="btn sm bad" data-act="aban" ${d}>⛔ Yasakla</button>`:''}`;
  const left=!sold&&!expired?` · ${Math.ceil(ms/36e5)} saat kaldı`:'';
  return {cls:`${sold?'sold':''} ${expired?'exp':''} ${i.featured?'feat':''} ${pr?'prem':''}`,expired,sold,tags,who,acts,left,date:new Date(i.created_at).toLocaleDateString('tr-TR')};
}
function card(i,o){
  const p=parts(i,'i',o);
  const efs=[1,2,3,4,5,6].map(n=>i['efsun_'+n]).filter(Boolean).map((e,k)=>{
    const m=e.match(/^(.*) (\+\d+)$/);
    return `<li><span class="n">${k+1}.</span><span>${esc(m?m[1]:e)}${m?` <b>${esc(m[2])}</b>`:''}</span></li>`}).join('');
  const m=i.item_name.match(/^(.*)\s(\+\d+)$/),plus=m?m[2]:'',base=m?m[1]:i.item_name;
  const price=i.price_value!=null?`${fmt(i.price_value)} ${esc(i.currency||'')}`:esc(i.price||'');
  const stn=(i.stones&&i.stones.length)?`<div class="stn">💎 Taşlar: ${i.stones.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:'';
  return `<article class="card ${p.cls}">
    <div class="head"><h3>${esc(base)}${plus?` <span class="tag plus">${esc(plus)}</span>`:''}</h3><span class="price">${price}</span></div>
    ${p.tags}
    <ol class="efl">${efs}</ol>${stn}
    <div class="who">${p.who}</div>
    <div class="foot"><span>${esc(i.category||'')} · ${p.date}${p.left}</span><div class="acts">${p.acts}</div></div>
  </article>`;
}
function yangCard(i,o){
  const p=parts(i,'y',o);
  return `<article class="card ${p.cls}">
    <div class="head"><h3>💰 ${fmt(i.amount)} ${esc(i.unit)} Yang</h3><span class="price">${fmt(i.price_tl)} TL</span></div>
    ${p.tags}
    <div class="seller">Birim fiyat: <b>${fmt(i.price_tl/i.amount)} TL / ${esc(i.unit)}</b></div>
    <div class="who">${p.who}</div>
    <div class="foot"><span>${p.date}${p.left}</span><div class="acts">${p.acts}</div></div>
  </article>`;
}

/* ---------- İlan ver / düzenle ---------- */
async function openPost(item){
  if(!user){toast('İlan vermek için önce giriş yap.');openAuth('in');return}
  await refreshQuota();
  const live=item&&item.status==='active'&&new Date(item.expires_at)>new Date();
  if(!live&&active>=FREE_LIMIT){openLimit();return}
  editId=item?item.id:null;
  $('#postErr').textContent='';
  $('#postTitle').textContent=item?'İlanı düzenle':'Yeni ilan';
  $('#postGo').textContent=item?'Kaydet ve yeniden yayınla':'Yayınla';
  $('#stRows').innerHTML='';
  $('#pSrv').value=item?item.server||'':prefSrv();
  if(item){
    $('#pCat').value=item.category;fillNames();toggleStone();
    const m=item.item_name.match(/^(.*)\s(\+\d+)$/);
    $('#pName').value=m?m[1]:'';$('#pPlus').value=m?m[2]:'+0';
    setEfsuns(item);
    (item.stones||[]).forEach(x=>{const t=x.match(/^(.*) (\+\d)$/);if(t)addStone(t[1],t[2])});
    $('#pPrice').value=item.price_value??'';$('#pCur').value=item.currency||'TL';
    $('#pNick').value=item.seller_name||'';$('#pContact').value=item.contact_info||'';$('#pDur').value=item.duration_hours||24;
  }else{
    $('#pCat').value='';fillNames();toggleStone();$('#pPlus').selectedIndex=0;setEfsuns(null);
    ['#pPrice','#pNick','#pContact'].forEach(x=>$(x).value='');$('#pCur').selectedIndex=0;$('#pDur').value='24';
  }
  $('#postDlg').showModal();
}
async function postSubmit(){
  const err=$('#postErr'),btn=$('#postGo');err.textContent='';
  const cat=$('#pCat').value,base=$('#pName').value,price=parseFloat($('#pPrice').value);
  const nick=$('#pNick').value.trim()||null,contact=$('#pContact').value.trim()||null;
  if(!$('#pSrv').value){err.textContent='Sunucu seçmelisin.';return}
  if(!cat||!base){err.textContent='Kategori ve item seçmelisin.';return}
  const row={server:$('#pSrv').value,category:cat,item_name:`${base} ${$('#pPlus').value}`,price_value:price,currency:$('#pCur').value,
    price:`${price} ${$('#pCur').value}`,seller_name:nick,contact_info:contact,duration_hours:+$('#pDur').value,status:'active'};
  const seen=new Set();
  for(let n=1;n<=6;n++){
    row['efsun_'+n]=null;
    if(n>efShown)continue;
    const nm=$(`#ef${n}n`).value,v=$(`#ef${n}v`).value.trim();
    if(!nm){err.textContent=`${n}. efsunu seç${n>2?' ya da × ile kaldır':''}.`;return}
    if(!/^\d{1,2}$/.test(v)||+v<1||+v>15){err.textContent=`${n}. efsun değeri 1 ile 15 arasında bir sayı olmalı.`;return}
    if(seen.has(nm)){err.textContent='Aynı efsunu iki kez seçtin.';return}
    seen.add(nm);row['efsun_'+n]=`${nm} +${+v}`;
  }
  row.stones=[];
  for(const r of $('#stRows').children){
    const nm=r.querySelector('.sn').value;
    if(!nm){err.textContent='Taş seç ya da × ile kaldır.';return}
    row.stones.push(`${nm} ${r.querySelector('.sv').value}`);
  }
  if(!(price>0)){err.textContent='Geçerli bir fiyat gir.';return}
  if(nick&&nick.length<2){err.textContent='Karakter adı en az 2 karakter olmalı.';return}
  if(contact&&(contact.length<3||/https?:|www\.|\.com|\.net/i.test(contact))){err.textContent='İletişim en az 3 karakter olmalı ve bağlantı içermemeli.';return}
  if(!nick&&!contact){err.textContent='Karakter adı veya iletişimden en az birini yaz.';return}
  btn.disabled=true;
  let r;
  if(editId){row.expires_at=new Date().toISOString();r=await sb.from('items').update(row).eq('id',editId).eq('user_id',user.id)}
  else{row.user_id=user.id;r=await sb.from('items').insert([row])}
  btn.disabled=false;
  if(r.error){err.textContent=dbErr(r.error.message);return}
  savePref(row.server);
  $('#postDlg').close();toast(editId?'İlan güncellendi ve yeniden yayınlandı.':'İlan yayınlandı!');
  view==='mine'?load(true):setView('mine');
}

/* ---------- Yeni ilan türü / Yang ---------- */
async function openNew(){
  if(!cb('posting_open')&&!isAdmin)return toast('Yeni ilan verme şu an geçici olarak kapalı. Biraz sonra tekrar dene.');
  if(!user){toast('İlan vermek için önce giriş yap.');openAuth('in');return}
  await refreshQuota();
  if(active>=FREE_LIMIT){openLimit();return}
  $('#typeDlg').showModal();
}
let yEditId=null;
async function openYang(item){
  if(!user){toast('İlan vermek için önce giriş yap.');openAuth('in');return}
  await refreshQuota();
  const live=item&&item.status==='active'&&new Date(item.expires_at)>new Date();
  if(!live&&active>=FREE_LIMIT){openLimit();return}
  yEditId=item?item.id:null;
  $('#yErr').textContent='';
  $('#yTitle').textContent=item?'Yang ilanını düzenle':'Yang ilanı';
  $('#yGo').textContent=item?'Kaydet ve yeniden yayınla':'Yayınla';
  $('#ySrv').value=item?item.server||'':prefSrv();
  $('#yAmt').value=item?item.amount:'';$('#yUnit').value=item?item.unit:UNITS[0];
  $('#yPrice').value=item?item.price_tl:'';
  $('#yNick').value=item?item.seller_name||'':'';$('#yContact').value=item?item.contact_info||'':'';
  $('#yDur').value=item?item.duration_hours||24:'24';
  yCalc();$('#yangDlg').showModal();
}
function yCalc(){const a=parseFloat($('#yAmt').value),p=parseFloat($('#yPrice').value);$('#yUnitPrice').textContent=a>0&&p>0?`Birim fiyat: yaklaşık ${fmt(p/a)} TL / ${$('#yUnit').value}`:''}
async function yangSubmit(){
  const err=$('#yErr'),btn=$('#yGo');err.textContent='';
  const srv=$('#ySrv').value,amt=parseFloat($('#yAmt').value),pr=parseFloat($('#yPrice').value);
  const nick=$('#yNick').value.trim()||null,contact=$('#yContact').value.trim()||null;
  if(!srv){err.textContent='Sunucu seçmelisin.';return}
  if(!(amt>0)||amt>=1e12){err.textContent='Geçerli bir yang miktarı gir.';return}
  if(!(pr>0)||pr>=1e9){err.textContent='Geçerli bir fiyat gir.';return}
  const ce=contactErr(nick,contact);if(ce){err.textContent=ce;return}
  const row={server:srv,amount:amt,unit:$('#yUnit').value,price_tl:pr,seller_name:nick,contact_info:contact,duration_hours:+$('#yDur').value,status:'active'};
  btn.disabled=true;
  let r;
  if(yEditId){row.expires_at=nowIso();r=await sb.from('yang_listings').update(row).eq('id',yEditId).eq('user_id',user.id)}
  else{row.user_id=user.id;r=await sb.from('yang_listings').insert([row])}
  btn.disabled=false;
  if(r.error){err.textContent=dbErr(r.error.message);return}
  savePref(srv);$('#yangDlg').close();toast(yEditId?'Yang ilanı güncellendi.':'Yang ilanı yayınlandı!');
  view==='mine'?load(true):setView('mine');
}

/* ---------- Geri bildirim ---------- */
let fbRef=null;
function openFeedback(kind,ref,msg){
  fbRef=ref||null;
  $('#fbKind').value=kind||'hata';$('#fbKind').disabled=!!ref;
  $('#fbRefTxt').textContent=ref?(/^(plan|slot|ad):/.test(ref)?'Talep':`Şikayet edilen ilan: ${ref.replace('items:','İtem #').replace('yang_listings:','Yang #')}`):'';
  $('#fbRefTxt').classList.toggle('hide',!ref);
  $('#fbMsg').value=msg||'';$('#fbErr').textContent='';$('#fbDlg').showModal();
}
async function fbSubmit(){
  const err=$('#fbErr');err.textContent='';
  if($('#fbHp').value){$('#fbDlg').close();return}
  const msg=$('#fbMsg').value.trim(),contact=$('#fbContact').value.trim()||null;
  if(msg.length<10){err.textContent='Lütfen en az 10 karakterlik bir açıklama yaz.';return}
  let last=0;try{last=+localStorage.getItem('fbT')||0}catch{}
  if(Date.now()-last<30000){err.textContent='Lütfen biraz bekleyip tekrar dene.';return}
  $('#fbGo').disabled=true;
  const {error}=await sb.from('feedback').insert([{kind:fbRef?(/^(plan|slot|ad):/.test(fbRef)?'diger':'sikayet'):$('#fbKind').value,message:msg,contact,ref:fbRef,page:location.href.slice(0,300),view,user_agent:navigator.userAgent.slice(0,300),last_error:lastErr||null}]);
  $('#fbGo').disabled=false;
  if(error){err.textContent='Gönderilemedi: '+error.message;return}
  try{localStorage.setItem('fbT',Date.now())}catch{}
  $('#fbDlg').close();toast('Teşekkürler! Bildirimin bize ulaştı.');
}

/* ---------- Olaylar ---------- */
async function onCardClick(e){
  const b=e.target.closest('button[data-act]');if(!b)return;
  const act=b.dataset.act,id=b.dataset.id,k=b.dataset.k,T=k==='y'?'yang_listings':'items';
  if(act==='copy'){
    try{await navigator.clipboard.writeText('/w '+b.dataset.nick);toast('Kopyalandı: /w '+b.dataset.nick)}
    catch{toast('Satıcı: '+b.dataset.nick)}
    return;
  }
  if(ADMIN_ACTS.includes(act)){if(!isAdmin)return;return adminAct(b)}
  if(act==='share')return openShare(k,id);
  if(act==='feat'){await refreshQuota();if(FEAT_USED>=FEAT_LIMIT)return openLimit();
    const {error}=await sb.from(T).update({featured:true}).eq('id',id).eq('user_id',user.id);
    return error?toast(dbErr(error.message)):(toast('İlanın öne çıkarıldı ⭐'),load(true))}
  if(act==='unfeat'){const {error}=await sb.from(T).update({featured:false}).eq('id',id).eq('user_id',user.id);
    return error?toast(dbErr(error.message)):(toast('Öne çıkarma kaldırıldı.'),load(true))}
  if(act==='prem'){
    if(!MYRENT.length)return toast('Aktif premium alanın yok.');
    let pos=MYRENT[0].pos;
    if(MYRENT.length>1){pos=+prompt('Hangi alana yerleştirilsin? '+MYRENT.map(r=>r.pos).join(', '),MYRENT[0].pos);if(!MYRENT.some(r=>r.pos===pos))return}
    const {error}=await sb.rpc('premium_attach',{p_pos:pos,p_kind:k==='y'?'yang':'item',p_id:+id});
    return error?toast(dbErr(error.message)):(toast('İlanın premium alana yerleştirildi 💎'),$('#viewDlg').open&&$('#viewDlg').close(),setView('prem'))}
  if(act==='edit')return k==='y'?openYang(cache.get('y'+id)):openPost(cache.get('i'+id));
  if(act==='report')return openFeedback('sikayet',`${T}:${id}`);
  if(act==='del'){ if(!confirm('Bu ilanı silmek istediğine emin misin?'))return;
    const {error}=await sb.from(T).delete().eq('id',id).eq('user_id',user.id);
    return error?toast('Silinemedi: '+error.message):(toast('İlan silindi.'),load(true)) }
  if(act==='renew'){await refreshQuota();if(active>=FREE_LIMIT)return openLimit()}
  const patch=act==='sold'?{status:'sold'}:{status:'active',expires_at:nowIso()};
  const {error}=await sb.from(T).update(patch).eq('id',id).eq('user_id',user.id);
  error?toast(dbErr(error.message)):(toast(act==='sold'?'Satıldı olarak işaretlendi.':'İlan yeniden yayınlandı.'),load(true));
}
$('#list').addEventListener('click',onCardClick);$('#viewBody').addEventListener('click',onCardClick);
$('#authBar').addEventListener('click',async e=>{
  if(e.target.id==='inBtn')openAuth('in');
  if(e.target.id==='outBtn'){await sb.auth.signOut();setUser(null);toast('Çıkış yapıldı.')}
});
document.querySelectorAll('#authModes .tab').forEach(b=>b.onclick=()=>openAuth(b.dataset.mode));
$('#authGo').onclick=authSubmit;$('#forgot').onclick=forgot;
$('#authClose').onclick=()=>$('#authDlg').close();
$('#pass').addEventListener('keydown',e=>{if(e.key==='Enter')authSubmit()});
$('#newBtn').onclick=openNew;$('#postGo').onclick=postSubmit;$('#postClose').onclick=()=>$('#postDlg').close();
$('#tabItems').onclick=()=>setView('items');$('#tabYang').onclick=()=>setView('yang');$('#tabMine').onclick=()=>setView('mine');
$('#moreBtn').onclick=()=>{page++;load(false)};
['fName','fEfsun'].forEach(id=>$('#'+id).addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),350)}));
['fCat','fPlus','fSort','fCur','fSrv','fySrv','fyUnit','fySort'].forEach(id=>$('#'+id).addEventListener('change',()=>load(true)));
$('#resetBtn').onclick=()=>{['fName','fEfsun','fCat','fPlus','fCur','fSrv','fySrv','fyUnit'].forEach(id=>$('#'+id).value='');$('#fSort').value='new';$('#fySort').value='new';load(true)};
$('#pCat').onchange=()=>{fillNames();toggleStone()};
$('#addEf').onclick=()=>{if(efShown<6){efShown++;efLayout()}};
$('#addSt').onclick=()=>addStone();
$('#efRows').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(b)efRemove(+b.dataset.rm)});
$('#stRows').addEventListener('click',e=>{if(e.target.closest('[data-rmst]')){e.target.closest('.ef').remove();stLayout()}});
$('#moreSlots').onclick=()=>openLimit();
$('#limitClose').onclick=()=>$('#limitDlg').close();
$('#efRows').addEventListener('input',e=>{if(!e.target.classList.contains('efv'))return;let v=e.target.value.replace(/\D/g,'').replace(/^0+/,'');if(+v>15)v='15';e.target.value=v});
$('#chItem').onclick=()=>{$('#typeDlg').close();openPost()};
$('#chYang').onclick=()=>{$('#typeDlg').close();openYang()};
$('#typeClose').onclick=()=>$('#typeDlg').close();
$('#yGo').onclick=yangSubmit;$('#yClose').onclick=()=>$('#yangDlg').close();
['yAmt','yPrice'].forEach(id=>$('#'+id).addEventListener('input',yCalc));$('#yUnit').onchange=yCalc;
$('#fbBtn').onclick=()=>openFeedback();$('#fbLink').onclick=()=>openFeedback();
$('#fbGo').onclick=fbSubmit;$('#fbClose').onclick=()=>$('#fbDlg').close();
/* ---------- Yönetim paneli ---------- */
const ADMIN_ACTS=['adel','aban','fbdone','refdel','refban','unban'];
async function banUser(uid,reason){
  const {error}=await sb.from('banned_users').upsert({user_id:uid,reason:reason||null},{onConflict:'user_id'});
  if(error)return error;
  await Promise.all([sb.from('items').delete().eq('user_id',uid),sb.from('yang_listings').delete().eq('user_id',uid)]);
  return null;
}
async function adminAct(b){
  const {act,id,k,fb,ref,uid}=b.dataset,T=k==='y'?'yang_listings':'items';
  const done=async()=>{if(fb)await sb.from('feedback').update({status:'cozuldu'}).eq('id',fb)};
  const fin=m=>{toast(m);load(true)};
  if(act==='fbdone'){await done();return fin('İşaretlendi.')}
  if(act==='unban'){const {error}=await sb.from('banned_users').delete().eq('user_id',uid);return error?toast(error.message):fin('Yasak kaldırıldı.')}
  if(act==='adel'){if(!confirm('Bu ilan yönetici olarak silinsin mi?'))return;const {error}=await sb.from(T).delete().eq('id',id);return error?toast(error.message):fin('İlan silindi.')}
  if(act==='aban'){
    const l=cache.get(k+id);if(!l)return;
    if(l.user_id===user.id)return toast('Kendini yasaklayamazsın.');
    const why=prompt('Yasaklama sebebi (isteğe bağlı). Kullanıcının tüm ilanları silinecek:');if(why===null)return;
    const e=await banUser(l.user_id,why);return e?toast(e.message):fin('Kullanıcı yasaklandı.');
  }
  const [t,rid]=(ref||'').split(':');
  if(!['items','yang_listings'].includes(t)||!/^\d+$/.test(rid||''))return toast('Geçersiz ilan bilgisi.');
  if(act==='refdel'){
    if(!confirm('İlan silinsin mi?'))return;
    const {error}=await sb.from(t).delete().eq('id',rid);if(error)return toast(error.message);
    await done();return fin('İlan silindi.');
  }
  const {data,error}=await sb.from(t).select('user_id').eq('id',rid).maybeSingle();
  if(error||!data)return toast('İlan bulunamadı (zaten silinmiş olabilir). Bildirimi "Çözüldü" yapabilirsin.');
  if(data.user_id===user.id)return toast('Kendini yasaklayamazsın.');
  const why=prompt('Yasaklama sebebi (isteğe bağlı). Kullanıcının tüm ilanları silinecek:');if(why===null)return;
  const e=await banUser(data.user_id,why);if(e)return toast(e.message);
  await done();fin('Kullanıcı yasaklandı.');
}

/* ---------- Piyasa özeti (yang) ---------- */
async function yangStats(){
  let q=sb.from('yang_listings').select('unit,unit_price').eq('status','active').gt('expires_at',nowIso()).limit(500);
  if($('#fySrv').value)q=q.eq('server',$('#fySrv').value);
  const {data,error}=await q,box=$('#mkt');
  if(view!=='yang')return;
  if(error||!data||!data.length){box.classList.add('hide');return}
  const by={};data.forEach(r=>{(by[r.unit]=by[r.unit]||[]).push(Number(r.unit_price))});
  const row=([u,a])=>{a.sort((x,y)=>x-y);const m=a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;
    return `1 ${esc(u)}: en düşük <b>${fmt(a[0])}</b> · ortanca <b>${fmt(m)}</b> TL (${a.length} ilan)`};
  box.innerHTML=`<span>📊 <b>Piyasa özeti${$('#fySrv').value?' · '+esc($('#fySrv').value):''}</b><br>${Object.entries(by).map(row).join('<br>')}</span>`;
  box.classList.remove('hide');
}

/* ---------- Canlı yeni ilan bildirimi ---------- */
function bump(v,p){
  if(view!==v||(user&&p.new&&p.new.user_id===user.id))return;
  fresh++;const b=$('#freshBar');b.textContent=`🔔 ${fresh} yeni ilan · Göster`;b.classList.remove('hide');
}
$('#freshBar').onclick=()=>load(true);
try{
  sb.channel('listings')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'items'},p=>bump('items',p))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'yang_listings'},p=>bump('yang',p))
    .subscribe();
}catch{}

/* ---------- Duyuru çubuğu (site_notice tablosundan) ---------- */
(async()=>{try{
  const {data}=await sb.from('site_notice').select('message').eq('active',true).order('id',{ascending:false}).limit(1);
  const m=data&&data[0]&&data[0].message;
  if(m&&sessionStorage.getItem('sn')!==m){
    const n=$('#siteNotice');n.innerHTML=`<span>📢 ${esc(m)}</span><button class="btn sm" id="snX">Tamam</button>`;n.classList.remove('hide');
    $('#snX').onclick=()=>{n.classList.add('hide');try{sessionStorage.setItem('sn',m)}catch{}};
  }
}catch{}})();

/* ---------- Şartlar / gizlilik / güvenlik ---------- */
const LEGAL={
 terms:['Kullanım şartları',`<p>Bu site, <b>Mobile2 Global</b> oyuncularının aradıklarını kolayca bulabilmesi için hazırlanmış bağımsız bir arama ve ilan platformudur. <b>Alışveriş oyunun içinde yapılır;</b> bu sitede satış, ödeme veya teslimat yoktur. Oyunun yapımcısı veya yayıncısıyla bağlantısı yoktur; oyun ve marka adları sahiplerine aittir.</p>
 <ul><li><b>Aracı değiliz.</b> İlanlardaki bilgilerin doğruluğunu garanti etmeyiz ve oyun içi işlemlerden doğan zararlardan sorumlu değiliz. Öne çıkarma, premium alan ve reklam gibi ücretli hizmetler yalnızca ilan görünürlüğüdür; item veya yang satışı değildir.</li>
 <li><b>Oyun kuralları.</b> Oyun içi ve oyun dışı ticaretin ilgili oyunun kurallarına uygunluğu kullanıcının sorumluluğundadır.</li>
 <li><b>Yasaklar.</b> Sahte veya yanıltıcı ilan, dolandırıcılık, spam, reklam/bağlantı paylaşımı, hakaret ve taciz yasaktır.</li>
 <li><b>Yaptırım.</b> Kurallara aykırı ilanlar uyarı yapılmadan silinebilir, tekrarında hesap kısıtlanabilir.</li>
 <li><b>İlanlar.</b> İlanlar 24 veya 48 saat yayında kalır. Ücretsiz kullanımda aynı anda en fazla 2 aktif ilan verilebilir. Bu kurallar değişebilir.</li></ul>`],
 privacy:['Gizlilik bilgilendirmesi',`<p>Hangi veriyi neden tuttuğumuzu açıkça yazıyoruz:</p>
 <ul><li><b>E-posta ve şifre:</b> Hesap açmak ve giriş için. Şifren şifrelenmiş saklanır, bize görünmez.</li>
 <li><b>İlan bilgileri:</b> Karakter adı ve iletişim bilgisi dahil, ilanla birlikte <b>herkese açık</b> görünür. Kişisel bilgilerini (telefon, adres vb.) yazma.</li>
 <li><b>Geri bildirimler:</b> Gönderdiğin mesaj, sayfa bilgisi, cihaz türü ve varsa son hata, sorunu çözmek için saklanır.</li>
 <li><b>Saklama yeri:</b> Veriler Supabase altyapısında tutulur. Verilerin satılmaz veya reklam amacıyla paylaşılmaz.</li>
 <li><b>Silme talebi:</b> Hesabının ve ilanlarının silinmesi için "Geri bildirim" formundan bize yaz.</li></ul>`],
 safety:['Güvenli alışveriş ipuçları',`<ul><li><b>Şifreni kimseyle paylaşma.</b> Yönetici dahil kimse senden oyun şifreni istemez.</li>
 <li><b>Çok ucuz fiyata şüpheyle bak.</b> Piyasanın çok altındaki ilanlar çoğunlukla dolandırıcılıktır. Yang sekmesindeki piyasa özetine bak.</li>
 <li><b>Küçük başla.</b> Tanımadığın biriyle ilk işlemde mümkünse küçük miktarla dene.</li>
 <li><b>Takası oyun içinde, işlem penceresinde yap.</b> Karşı tarafın itemi/yangı koyduğunu görmeden onay verme; "önce sen gönder" diyenlere dikkat et.</li>
 <li><b>Karakter adını kontrol et.</b> İlandaki karakter adıyla konuştuğun kişinin aynı olduğundan emin ol.</li>
 <li><b>Şüpheli ilan gördün mü?</b> İlandaki 🚩 butonuyla bize bildir, bakalım.</li></ul>`]
};
function showLegal(k){$('#legalTitle').textContent=LEGAL[k][0];$('#legalBody').innerHTML=LEGAL[k][1];if(!$('#legalDlg').open)$('#legalDlg').showModal()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-legal]');if(!b)return;e.preventDefault();showLegal(b.dataset.legal)});
$('#legalClose').onclick=()=>$('#legalDlg').close();
$('#tabAdmin').onclick=()=>{location.href='admin.html'};

/* ---------- Site ayarları (yönetim panelinden) ---------- */
let CFG={},PLAN_CACHE={};
const cb=(k,d=true)=>CFG[k]===undefined?d:CFG[k]==='true';
async function loadCfg(){
  try{const {data}=await sb.from('site_settings').select('key,value');CFG={};(data||[]).forEach(r=>CFG[r.key]=r.value)}catch{}
  applyCfg();loadAds();
}
function applyCfg(){
  const set=(id,k)=>{if(CFG[k])$(id).textContent=CFG[k]};
  set('#brandTxt','site_title');set('#brandSub','site_subtitle');set('#heroH','hero_title');set('#heroP','hero_text');set('#gameN','game_notice');set('#footTxt','footer_text');
  if(CFG.site_title)document.title=CFG.site_title.replace(/^[^\wÇĞİÖŞÜçğıöşü]+/,'');
  const it=cb('items_enabled'),yg=cb('yang_enabled');
  $('#tabItems').classList.toggle('hide',!it);$('#tabYang').classList.toggle('hide',!yg);
  $('#chItem').classList.toggle('hide',!it);$('#chYang').classList.toggle('hide',!yg);
  ['#fbBtn','#fbLink'].forEach(id=>$(id).classList.toggle('hide',!cb('feedback_enabled')));
  const up=document.querySelector('#authModes [data-mode="up"]');if(up)up.classList.toggle('hide',!cb('signups_open'));
  const m=cb('maintenance',false);
  $('#maint').classList.toggle('hide',!(m&&!isAdmin));$('#maintAdmin').classList.toggle('hide',!(m&&isAdmin));
  if(CFG.maintenance_msg)$('#maintTxt').textContent=CFG.maintenance_msg;
  $('#tabFeat').classList.toggle('hide',!cb('featured_enabled'));$('#tabPrem').classList.toggle('hide',!cb('premium_enabled'));
  $('#goGoogle').classList.toggle('hide',!cb('oauth_google',false));$('#goDiscord').classList.toggle('hide',!cb('oauth_discord',false));
  if((view==='feat'&&!cb('featured_enabled'))||(view==='prem'&&!cb('premium_enabled')))setView(it?'items':'yang');
  if(view==='items'&&!it&&yg)setView('yang');else if(view==='yang'&&!yg&&it)setView('items');
}
$('#maintLogin').onclick=()=>openAuth('in');

/* ---------- İlan hakkı ve paketler ---------- */
async function openLimit(){
  $('#limTxt').textContent=`Şu an aynı anda ${FREE_LIMIT} aktif ilan verebilir ve ${FEAT_LIMIT} ilanını öne çıkarabilirsin. Bir ilanı "Satıldı" yapabilir, silebilir ya da süresinin bitmesini bekleyebilirsin.`;
  $('#planList').innerHTML='<div class="skel" style="height:70px"></div>';
  if(!$('#limitDlg').open)$('#limitDlg').showModal();
  const [pl,mine]=await Promise.all([
    sb.from('plans').select('*').eq('active',true).order('sort').order('listing_limit'),
    user?sb.from('user_plans').select('expires_at,plans(name,listing_limit)').eq('user_id',user.id).gt('expires_at',nowIso()):Promise.resolve({data:[]})]);
  PLAN_CACHE={};(pl.data||[]).forEach(p=>PLAN_CACHE[p.id]=p);
  const have=(mine.data||[]).map(m=>`<div class="notice">✅ <span>Aktif paketin: <b>${esc(m.plans?m.plans.name:'')}</b> · ${new Date(m.expires_at).toLocaleDateString('tr-TR')} tarihine kadar</span></div>`).join('');
  const list=(pl.data||[]).map(p=>`<div class="card" style="margin-top:8px"><div class="head"><h3>${esc(p.name)}</h3><span class="price">${esc(p.price_text||'')}</span></div><div class="seller">Aynı anda <b>${p.listing_limit}</b> aktif ilan${p.featured_slots?` · <b>${p.featured_slots}</b> öne çıkarma`:''} · ${p.duration_days} gün</div>${p.description?`<div class="seller">${esc(p.description)}</div>`:''}<button class="btn sm gold" data-plan="${p.id}" style="align-self:flex-start">Bu paketi istiyorum</button></div>`).join('');
  $('#planList').innerHTML=have+(list||'<div class="notice">⭐ <span>Ücretli paketler çok yakında geliyor.</span></div>')+(list&&CFG.packages_text?`<p class="hint">${esc(CFG.packages_text)}</p>`:'');
}
$('#planList').addEventListener('click',e=>{
  const b=e.target.closest('[data-plan]');if(!b)return;
  const p=PLAN_CACHE[b.dataset.plan];if(!p)return;
  $('#limitDlg').close();
  if(!user){toast('Paket istemek için önce giriş yap.');openAuth('in');return}
  openFeedback('diger','plan:'+p.id,`Paket talebi: ${p.name} (${p.price_text||'-'}). Ödeme ve aktifleştirme için benimle iletişime geçin.`);
});


/* ---------- Öne çıkanlar ve Premium pazar ---------- */
const listErr=m=>{$('#list').innerHTML=`<div class="empty" style="grid-column:1/-1">Yüklenemedi: ${esc(m)}</div>`};
async function loadFeat(tok){
  $('#moreBtn').classList.add('hide');
  const now=nowIso(),mk=t=>sb.from(t).select('*').eq('featured',true).eq('status','active').gt('expires_at',now).order('created_at',{ascending:false}).limit(60);
  const [a,b]=await Promise.all([mk('items'),mk('yang_listings')]);
  if(tok!==loadTok)return;
  if(a.error||b.error)return listErr((a.error||b.error).message);
  const n=a.data.length+b.data.length;total=n;
  $('#count').textContent=n?`${n} öne çıkan ilan`:'';
  $('#list').innerHTML=n?(a.data.length?'<h4 class="sec">İtemler</h4>'+a.data.map(card).join(''):'')+(b.data.length?'<h4 class="sec">Yang</h4>'+b.data.map(yangCard).join(''):'')
    :'<div class="empty" style="grid-column:1/-1">Şu an öne çıkan ilan yok.<br><button class="btn sm gold" style="margin-top:10px" data-open="plans">İlanını öne çıkar</button></div>';
  refreshQuota();paintAds();
}
async function loadPrem(tok){
  $('#moreBtn').classList.add('hide');
  const N=Math.max(1,Math.min(100,+CFG.premium_slot_count||20));
  const [bd,of]=await Promise.all([sb.rpc('premium_board'),sb.from('premium_offers').select('*').eq('active',true).order('sort').order('days')]);
  if(tok!==loadTok)return;
  if(bd.error)return listErr(bd.error.message);
  OFFERS=of.data||[];
  const map={};(bd.data||[]).forEach(r=>map[r.pos]=r);
  let html='',used=0;
  for(let p=1;p<=N;p++){
    const r=map[p];
    if(r){used++;
      html+=r.listing?(r.kind==='yang'?yangCard(r.listing,{prem:true}):card(r.listing,{prem:true}))
        :`<div class="slot rsv"><span class="badge prem">💎 Alan ${p}</span><b>Rezerve</b><span>Bu alan kiralanmış, ilan yakında burada olacak.</span></div>`;
    }else html+=`<div class="slot"><span class="badge prem">💎 Alan ${p}</span><b>Boş alan</b><span>İlanın en çok gören yerde dursun.</span><button class="btn sm gold" data-rent="${p}" type="button">Bu alanı kirala</button></div>`;
  }
  $('#count').textContent=`${N-used} boş / ${N} alan`;
  $('#list').innerHTML=html;
  refreshQuota();paintAds();
}
function openRent(pos){
  if(!user){toast('Premium alan için önce giriş yap.');openAuth('in');return}
  $('#rentTxt').textContent=`Alan #${pos}. Süreyi seç, talebini gönder; ödemeyi aldıktan sonra alanı aktifleştiririz.`+(CFG.packages_text?' '+CFG.packages_text:'');
  $('#rentList').innerHTML=OFFERS.length?OFFERS.map(o=>`<div class="card" style="margin-top:8px"><div class="head"><h3>${esc(o.name)}</h3><span class="price">${esc(o.price_text||'')}</span></div><div class="seller">${o.days} gün</div><button class="btn sm gold" data-offer="${o.id}" data-pos="${pos}" type="button" style="align-self:flex-start">Bu süreyi istiyorum</button></div>`).join('')
    :`<div class="notice">Fiyat ve süre için talep gönder.</div><button class="btn gold" data-offer="0" data-pos="${pos}" type="button" style="width:100%">Talep gönder</button>`;
  $('#rentDlg').showModal();
}
function ownerExtra(i,d,sold,expired){
  if(sold||expired)return '';
  return (i.featured?`<button class="btn sm" data-act="unfeat" ${d}>⭐ Kaldır</button>`:(cb('featured_enabled')?`<button class="btn sm" data-act="feat" ${d}>⭐ Öne çıkar</button>`:''))
    +((MYRENT.length&&cb('premium_enabled'))?`<button class="btn sm" data-act="prem" ${d} aria-label="Premium alana yerleştir">💎</button>`:'');
}

/* ---------- Reklam alanları ---------- */
async function loadAds(){
  ADS={top:[],feed:[],bottom:[]};
  if(cb('ads_enabled')){
    const now=nowIso(),{data}=await sb.from('ads').select('*').eq('active',true).lte('starts_at',now).gt('ends_at',now);
    (data||[]).forEach(a=>{if(ADS[a.slot])ADS[a.slot].push(a)});
  }
  paintAds();
}
function adHtml(slot,inl){
  if(!cb('ads_enabled'))return '';
  const list=ADS[slot]||[];
  if(!list.length){
    return cb('ads_show_empty')?`<button class="adbox empty ${inl?'inl':''}" data-adreq="${slot}" type="button"><b>📢 Reklam alanı</b><br><small>Burada reklam yayınlayabilirsin · talep gönder</small></button>`:'';
  }
  const a=list[Math.floor(Math.random()*list.length)];
  if(!adSeen.has(a.id)){adSeen.add(a.id);sb.rpc('ad_view',{p_id:a.id}).then(()=>{},()=>{})}
  const body=a.kind==='image'?`<img src="${esc(a.image_url)}" alt="${esc(a.title||a.advertiser||'Reklam')}" loading="lazy">`
    :`<div class="adt"><b>${esc(a.title)}</b><span>${esc(a.body||'')}</span></div>`;
  return `<a class="adbox ${inl?'inl':''}" href="${esc(a.link_url)}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-ad="${a.id}"><span class="adtag">Reklam</span>${body}</a>`;
}
function paintAds(){
  const show=view!=='mine';
  $('#adTop').innerHTML=show?adHtml('top'):'';$('#adBottom').innerHTML=show?adHtml('bottom'):'';
}
function withAds(arr,fn,off){
  const every=Math.max(3,+CFG.ads_feed_every||8);
  return arr.map((r,i)=>fn(r)+(((off+i+1)%every===0)?adHtml('feed',true):'')).join('');
}
document.addEventListener('click',e=>{
  const r=e.target.closest('[data-rent]');if(r)return openRent(r.dataset.rent);
  const q=e.target.closest('[data-adreq]');
  if(q){const n={top:'Üst banner',feed:'Liste arası',bottom:'Alt banner'}[q.dataset.adreq];
    return openFeedback('diger','ad:'+q.dataset.adreq,`Reklam talebi: ${n} alanı. Fiyat ve ölçüler hakkında bilgi almak istiyorum. ${CFG.ads_contact_text||''}`.slice(0,300))}
  if(e.target.closest('[data-open="plans"]'))return openLimit();
  const a=e.target.closest('a[data-ad]');if(a)sb.rpc('ad_click',{p_id:+a.dataset.ad}).then(()=>{},()=>{});
});
$('#rentList').addEventListener('click',e=>{
  const b=e.target.closest('[data-offer]');if(!b)return;
  const pos=b.dataset.pos,o=OFFERS.find(x=>String(x.id)===b.dataset.offer);
  $('#rentDlg').close();
  openFeedback('diger',`slot:${pos}:${b.dataset.offer}`,`Premium alan talebi: Alan #${pos}${o?` · ${o.name} (${o.days} gün, ${o.price_text||'-'})`:''}. Aktifleştirme için benimle iletişime geçin.`);
});
$('#rentClose').onclick=()=>$('#rentDlg').close();

/* ---------- Paylaşım ve paylaşılan link ---------- */
const siteUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
function openShare(k,id){
  const r=cache.get(k+id);if(!r)return;
  const url=`${siteUrl()}?${k==='y'?'y':'i'}=${id}`;
  const title=k==='y'?`${fmt(r.amount)} ${r.unit} Yang`:r.item_name;
  const txt=`${title}${r.server?' · '+r.server:''} | Mobile2 Pazar`,e=encodeURIComponent;
  SHARE={url,title,txt};
  $('#shTitle').textContent=title;$('#shUrl').value=url;
  $('#shWa').href=`https://wa.me/?text=${e(txt+'\n'+url)}`;
  $('#shTg').href=`https://t.me/share/url?url=${e(url)}&text=${e(txt)}`;
  $('#shNative').classList.toggle('hide',!navigator.share);
  $('#shareDlg').showModal();
}
const copyLink=async m=>{try{await navigator.clipboard.writeText(SHARE.url);toast(m||'Link kopyalandı.')}catch{$('#shUrl').select();toast('Linki seçip kopyala.')}};
$('#shCp').onclick=()=>copyLink();
$('#shDc').onclick=()=>copyLink("Link kopyalandı. Discord'da sohbete yapıştır.");
$('#shIg').onclick=()=>copyLink("Link kopyalandı. Instagram'da mesaja ya da hikâyedeki bağlantı çıkartmasına yapıştır.");
$('#shNative').onclick=async()=>{try{await navigator.share({title:SHARE.title,text:SHARE.txt,url:SHARE.url})}catch{}};
$('#shClose').onclick=()=>$('#shareDlg').close();$('#viewClose').onclick=()=>$('#viewDlg').close();
$('#viewDlg').addEventListener('close',()=>{if(location.search)history.replaceState(null,'',location.pathname)});
async function openShared(k,id){
  if(!/^\d+$/.test(id))return;
  const {data}=await sb.from(k==='y'?'yang_listings':'items').select('*').eq('id',id).maybeSingle();
  $('#viewBody').innerHTML=!data?'<div class="empty">Bu ilan bulunamadı ya da silinmiş.</div>'
    :((new Date(data.expires_at)<new Date()||data.status!=='active')?'<div class="notice">⏳ Bu ilanın süresi dolmuş veya kapanmış.</div>':'')+(k==='y'?yangCard(data):card(data));
  $('#viewDlg').showModal();
}
{const q=new URLSearchParams(location.search);if(q.get('i'))openShared('i',q.get('i'));else if(q.get('y'))openShared('y',q.get('y'))}

/* ---------- OAuth ve tema ---------- */
async function oauth(p){const {error}=await sb.auth.signInWithOAuth({provider:p,options:{redirectTo:location.origin+location.pathname}});if(error)$('#authErr').textContent=error.message}
$('#goGoogle').onclick=()=>oauth('google');$('#goDiscord').onclick=()=>oauth('discord');
{const tb=$('#themeBtn'),th=()=>{const p=themeLabel().split(' ');return p[0]+'<span class="hide-sm"> '+p.slice(1).join(' ')+'</span>'};tb.innerHTML=th();tb.onclick=()=>{cycleTheme();tb.innerHTML=th()}}

initCatalog();
loadCfg();
