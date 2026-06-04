/**
 * Lightweight storefront HTML renderer.
 * Serves a ~15KB pure HTML/CSS/JS page — NO React bundle needed.
 * Designed for customers on slow internet connections.
 * 
 * All user-supplied values are properly escaped to prevent HTML/JS injection
 * and embedded data corruption.
 */

const cache = require('../utils/cache');

const INLINE_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background:#0a0a0f;color:#f1f5f9;min-height:100vh}
nav{position:sticky;top:0;z-index:50;background:rgba(10,10,15,.85);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid rgba(39,39,42,.8)}
.nav-inner{max-width:1280px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:64px}
.nav-brand{display:flex;align-items:center;gap:12px}
.nav-icon{width:44px;height:44px;background:linear-gradient(135deg,#06b6d4,#10b981);border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:900;box-shadow:0 4px 16px rgba(6,182,212,.2)}
.nav-name{font-size:20px;font-weight:700;color:#fff}
.nav-badge{display:inline-block;width:16px;height:16px;background:#10b981;border-radius:50%;margin-left:6px;vertical-align:middle}
.btn-sm{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:linear-gradient(135deg,#06b6d4,#10b981);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;box-shadow:0 4px 12px rgba(16,185,129,.25);transition:transform .15s,box-shadow .15s}
.btn-sm:hover{transform:scale(1.02);box-shadow:0 6px 20px rgba(16,185,129,.35)}
.btn-sm:active{transform:scale(.95)}
main{max-width:1280px;margin:0 auto;padding:0 16px 48px}
.filter-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:32px 0 24px;padding:20px 24px;background:rgba(20,20,26,.7);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:16px;border:1px solid rgba(39,39,42,.8)}
.filter-label{display:flex;align-items:center;gap:8px;color:#94a3b8;font-weight:600}
.filter-label svg{width:20px;height:20px;color:#06b6d4;flex-shrink:0}
.filter-group{display:flex;flex-wrap:wrap;gap:8px}
.filter-btn{padding:10px 20px;border-radius:12px;font-size:14px;font-weight:500;border:1px solid rgba(39,39,42,.8);background:#1e1e24;color:#a1a1aa;cursor:pointer;transition:all .15s}
.filter-btn:hover{background:#27272a}
.filter-btn.active{background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(16,185,129,.25)}
.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:640px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{background:rgba(20,20,26,.7);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:16px;border:1px solid rgba(39,39,42,.8);overflow:hidden;transition:transform .2s,border-color .2s,box-shadow .2s;contain:content}
.card:hover{transform:translateY(-4px);border-color:rgba(52,211,153,.4);box-shadow:0 12px 32px rgba(16,185,129,.1)}
.card-header{position:relative;padding:20px 24px;color:#fff}
.card-header-overlay{position:absolute;inset:0;background:rgba(0,0,0,.25)}
.card-header-content{position:relative;display:flex;justify-content:space-between;align-items:flex-start}
.card-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.25);color:#fff}
.card-category{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.8);margin-bottom:8px}
.card-category svg{width:16px;height:16px}
.card-title{font-size:18px;font-weight:700}
@media(min-width:640px){.card-title{font-size:20px}}
.card-body{padding:20px 24px}
.card-desc{font-size:20px;font-weight:700;color:#fff;margin-bottom:12px}
.card-price{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}
.price-amount{font-size:28px;font-weight:900;color:#fff}
.price-label{font-size:13px;color:#52525b}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.tag{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid}
.tag-1{background:rgba(16,185,129,.1);color:#6ee7b7;border-color:rgba(16,185,129,.25)}
.tag-2{background:rgba(6,182,212,.1);color:#67e8f9;border-color:rgba(6,182,212,.25)}
.tag-3{background:rgba(245,158,11,.1);color:#fcd34d;border-color:rgba(245,158,11,.25)}
.btn-buy{width:100%;padding:14px 24px;border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,box-shadow .15s}
.btn-buy:hover{transform:scale(1.02)}
.btn-buy:active{transform:scale(.98)}
.empty{text-align:center;padding:80px 0}
.empty-icon{display:inline-flex;padding:24px;background:#1e1e24;border-radius:50%;margin-bottom:24px;color:#52525b}
.empty-icon svg{width:48px;height:48px}
.empty h2{font-size:24px;font-weight:700;color:#fff;margin-bottom:8px}
.empty p{color:#52525b}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.modal{background:#1e1e24;border:1px solid rgba(39,39,42,.8);border-radius:16px;width:100%;max-width:448px;max-height:85vh;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,.4)}
.modal-header{position:relative;padding:16px 20px;color:#fff}
.modal-close{position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.15);border:none;border-radius:8px;color:#fff;cursor:pointer;transition:background .15s}
.modal-close:hover{background:rgba(255,255,255,.25)}
.modal-body{padding:20px}
.amount-box{background:rgba(10,10,15,.5);border:1px solid rgba(39,39,42,.8);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.amount-label{color:#52525b;font-size:14px}
.amount-value{font-size:20px;font-weight:700;color:#fff}
.field{margin-bottom:16px}
.field-label{display:flex;align-items:center;gap:8px;font-size:14px;color:#a1a1aa;margin-bottom:8px}
.field-label svg{width:16px;height:16px;color:#06b6d4}
.field-input{width:100%;background:rgba(10,10,15,.5);border:1px solid rgba(39,39,42,.8);border-radius:12px;padding:12px 16px;color:#fff;font-size:16px;outline:none;transition:border-color .15s}
.field-input:focus{border-color:#06b6d4}
.field-input::placeholder{color:#52525b}
.modal-actions{display:flex;flex-direction:column;gap:10px}
.btn-submit{width:100%;padding:14px;border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
.btn-submit:disabled{opacity:.5;cursor:not-allowed}
.btn-cancel{width:100%;padding:14px;border:none;border-radius:12px;background:#27272a;color:#a1a1aa;font-size:16px;font-weight:600;cursor:pointer;transition:background .15s}
.btn-cancel:hover{background:#3f3f46}
.modal-footer{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(39,39,42,.8)}
.modal-footer svg{width:16px;height:16px;color:#52525b}
.modal-footer span{font-size:12px;color:#52525b}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.toast{position:fixed;top:20px;right:20px;z-index:200;padding:16px 20px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.3);transform:translateX(120%);transition:transform .3s ease}
.toast.show{transform:translateX(0)}
.toast-success{background:#059669}
.toast-error{background:#dc2626}
.toast-info{background:#2563eb}
.spinner-btn{display:inline-block;width:20px;height:20px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:8px}

/* Filter state */
.product-card.hidden{display:none}

/* Tracking Modal */
.track-select{background:rgba(10,10,15,.7);border:2px solid rgba(39,39,42,.8);border-radius:12px;padding:10px 16px;color:#fff;font-size:14px;outline:none}
.track-select:focus{border-color:#06b6d4}
.track-group{display:flex;gap:8px;flex:1}
.track-input{flex:1;background:rgba(10,10,15,.5);border:2px solid rgba(39,39,42,.8);border-radius:12px;padding:10px 16px;color:#fff;font-size:14px;outline:none}
.track-input:focus{border-color:#06b6d4}
.track-input::placeholder{color:#52525b}
.track-result{border:1px solid rgba(39,39,42,.8);border-radius:12px;padding:16px;margin-top:12px;background:rgba(10,10,15,.5)}
.track-result h4{color:#fff;font-size:14px;font-weight:600;margin-bottom:4px}
.track-result .date{color:#52525b;font-size:12px}
.track-status{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid;margin-top:4px}
.modal-scroll{overflow-y:auto;flex:1}
`;

const INLINE_JS = `
(function(){var sf,slug,api;
function init(){sf=window.__STOREFRONT_DATA__;if(!sf)return;slug=sf.slug;api=(window.location.origin==='http://localhost:3000'?'http://localhost:5000':'');}
function toast(m,t){var e=document.getElementById('toast');if(!e)return;e.textContent=m;e.className='toast toast-'+t+' show';clearTimeout(e._h);e._h=setTimeout(function(){e.className='toast toast-'+t},3000);}
init();
// Filter - event delegation on .filter-bar
document.querySelector('.filter-bar')&&document.querySelector('.filter-bar').addEventListener('click',function(e){
  var b=e.target.closest('.filter-btn');if(!b)return;
  var f=b.getAttribute('data-filter');
  document.querySelectorAll('.filter-btn').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-filter')===f);});
  document.querySelectorAll('.product-card').forEach(function(c){
    if(f==='all'){c.classList.remove('hidden');return;}
    var n=(c.getAttribute('data-network')||'').toUpperCase();
    if(f==='mtn')c.classList.toggle('hidden',n.indexOf('MTN')===-1);
    else if(f==='airtel')c.classList.toggle('hidden',n.indexOf('AIRTEL')===-1&&n.indexOf('TIGO')===-1);
    else if(f==='telecel')c.classList.toggle('hidden',n.indexOf('TELECEL')===-1&&n.indexOf('VODAFONE')===-1);
    else c.classList.remove('hidden');
  });
});
// Buy button clicks - event delegation on main
document.querySelector('main').addEventListener('click',function(e){
  var b=e.target.closest('.btn-buy');if(!b)return;
  var pid=parseInt(b.getAttribute('data-pid'));if(!pid)return;
  if(!sf||!sf.products){toast('Store not ready','error');return;}
  var p=null;for(var i=0;i<sf.products.length;i++){if(sf.products[i].id===pid){p=sf.products[i];break;}}
  if(!p){toast('Product not found','error');return;}
  document.getElementById('modal-product-name').textContent=p.name||'';
  document.getElementById('modal-product-desc').textContent=p.description||'';
  document.getElementById('modal-price').textContent='GHS '+(p.price||0).toFixed(2);
  document.getElementById('buy-btn').setAttribute('data-pid',pid);
  document.getElementById('phone-input').value='';
  document.getElementById('modal').style.display='flex';
  document.getElementById('buy-btn').disabled=false;
  document.getElementById('buy-btn').innerHTML='Pay with Mobile Money \\u2192';
  var u=(p.name||'').toUpperCase();
  var g=(u.indexOf('MTN')!==-1)?'#eab308, #d97706':(u.indexOf('TELECEL')!==-1||u.indexOf('VODAFONE')!==-1)?'#ef4444, #e11d48':(u.indexOf('AIRTEL')!==-1||u.indexOf('TIGO')!==-1)?'#3b82f6, #4f46e5':'#1e1e24, #27272a';
  document.getElementById('modal-header').style.background='linear-gradient(135deg, '+g+')';
  document.getElementById('buy-btn').style.background='linear-gradient(135deg, '+g+')';
});
// Buy payment
document.getElementById('buy-btn').addEventListener('click',function(){
  var btn=this;var pid=parseInt(btn.getAttribute('data-pid'));
  if(!pid){toast('Select a product first','error');return;}
  var phone=document.getElementById('phone-input').value.replace(/\\D/g,'');
  if(phone.length!==10){toast('Enter a valid 10-digit number','error');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner-btn"></span>Processing...';
  var x=new XMLHttpRequest();
  x.open('POST',(api||'')+'/api/storefront/public/'+slug+'/pay',true);
  x.setRequestHeader('Content-Type','application/json');x.timeout=30000;
  x.onload=function(){
    if(x.status>=200&&x.status<300){try{var r=JSON.parse(x.responseText);if(r.success&&r.paymentUrl){window.location.href=r.paymentUrl;return;}toast(r.message||'Payment failed','error');}catch(e){toast('Invalid response','error');}
    }else{try{toast(JSON.parse(x.responseText).message||'Order failed','error');}catch(e){toast('Network error','error');}}
    btn.disabled=false;btn.innerHTML='Pay with Mobile Money \\u2192';
  };
  x.onerror=function(){toast('Network error. Check connection.','error');btn.disabled=false;btn.innerHTML='Pay with Mobile Money \\u2192';};
  x.ontimeout=function(){toast('Request timed out','error');btn.disabled=false;btn.innerHTML='Pay with Mobile Money \\u2192';};
  x.send(JSON.stringify({storefrontProductId:pid,customerName:(sf&&sf.agent&&sf.agent.name)||'Customer',customerPhone:phone}));
});
// Open tracking modal
document.getElementById('open-track')&&document.getElementById('open-track').addEventListener('click',function(){document.getElementById('track-modal').style.display='flex';});
// Track search
document.getElementById('track-btn').addEventListener('click',function(){
  var mode=document.getElementById('track-mode').value;
  var val=document.getElementById('track-input').value.trim().replace(/\\s+/g,'');
  var res=document.getElementById('track-results');
  if(!val){toast('Please enter a value to search','error');return;}
  if(mode==='phone'){var d=val.replace(/\\D/g,'');if(d.length<9){toast('Enter valid mobile number','error');return;}val=d;}
  else{if(val.length<5){toast('Enter valid order number','error');return;}val=val.toUpperCase();}
  this.disabled=true;this.innerHTML='<span class="spinner-btn"></span>';
  var p=(mode==='phone'?'mobileNumber=':'orderNumber=')+encodeURIComponent(val);
  var x=new XMLHttpRequest();
  x.open('GET',(api||'')+'/api/shop/track?'+p,true);x.timeout=15000;
  x.onload=function(){
    var btn=document.getElementById('track-btn');btn.disabled=false;btn.innerHTML='\\uD83D\\uDD0D';
    if(x.status>=200&&x.status<300){try{var r=JSON.parse(x.responseText);var o=r.orders||[];if(!o.length){res.innerHTML='<div style="text-align:center;padding:24px;color:#52525b">No orders found</div>';return;}
    var h='';for(var i=0;i<o.length;i++){var od=o[i];
      h+='<div class="track-result"><div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px"><div><h4>Order '+(od.orderNumber?'#'+od.orderNumber:'#'+od.orderId)+'</h4><div class="date">'+new Date(od.createdAt).toLocaleDateString()+'</div></div>';
      var s=(od.items&&od.items[0])?od.items[0].status||'Pending':'Pending';
      var sc=s.toLowerCase()==='completed'?'background:rgba(16,185,129,.1);color:#6ee7b7;border-color:rgba(16,185,129,.25)':s.toLowerCase()==='processing'?'background:rgba(6,182,212,.1);color:#67e8f9;border-color:rgba(6,182,212,.25)':s.toLowerCase()==='pending'?'background:rgba(245,158,11,.1);color:#fcd34d;border-color:rgba(245,158,11,.25)':'background:rgba(239,68,68,.1);color:#fca5a5;border-color:rgba(239,68,68,.25)';
      h+='<span class="track-status" style="'+sc+'">'+s+'</span></div>';
      if(od.items){for(var j=0;j<od.items.length;j++){var im=od.items[j];h+='<div style="font-size:13px;color:#a1a1aa;padding:4px 0"><span style="color:#fff;font-weight:500">'+(im.productName||'')+'</span>'+(im.productDescription?' - '+im.productDescription:'')+'</div>';}}
      h+='</div>';}
      res.innerHTML=h;}catch(e){toast('Invalid response','error');}
    }else{toast('Failed to track order','error');}
  };
  x.onerror=function(){document.getElementById('track-btn').disabled=false;document.getElementById('track-btn').innerHTML='\\uD83D\\uDD0D';toast('Network error','error');};
  x.send();
});
// Track mode switch - clear input/results
document.getElementById('track-mode')&&document.getElementById('track-mode').addEventListener('change',function(){document.getElementById('track-input').value='';document.getElementById('track-results').innerHTML='';});
// Modal: close on overlay click
document.getElementById('modal')&&document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
document.querySelectorAll('#modal .modal-close').forEach(function(el){el.addEventListener('click',function(){document.getElementById('modal').style.display='none';});});
document.querySelector('#modal .btn-cancel')&&document.querySelector('#modal .btn-cancel').addEventListener('click',function(){document.getElementById('modal').style.display='none';});
document.getElementById('track-modal')&&document.getElementById('track-modal').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
document.querySelectorAll('#track-modal .modal-close').forEach(function(el){el.addEventListener('click',function(){document.getElementById('track-modal').style.display='none';});});
})();
`;

/**
 * Escape a string for safe use in HTML content.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str || '');
  return str.replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&' + 'amp;';
    if (m === '<') return '&' + 'lt;';
    if (m === '>') return '&' + 'gt;';
    if (m === '"') return '&' + 'quot;';
    return '&' + '#39;';
  });
}

// Determine carrier info from product name
const getNetwork = (name) => {
  const u = (name || '').toUpperCase();
  if (u.includes('MTN')) return 'mtn';
  if (u.includes('TELECEL') || u.includes('VODAFONE')) return 'telecel';
  if (u.includes('AIRTEL') || u.includes('TIGO')) return 'airtel';
  return 'other';
};

const cardGradient = (name) => {
  const u = (name || '').toUpperCase();
  if (u.includes('MTN')) return 'linear-gradient(135deg, #eab308, #d97706)';
  if (u.includes('TELECEL') || u.includes('VODAFONE')) return 'linear-gradient(135deg, #ef4444, #e11d48)';
  if (u.includes('AIRTEL') || u.includes('TIGO')) return 'linear-gradient(135deg, #3b82f6, #4f46e5)';
  return 'linear-gradient(135deg, #1e1e24, #27272a)';
};

/**
 * Generate the full HTML page for a lightweight storefront.
 * @param {object} storefrontData - The storefront data from getPublicStorefront()
 * @param {string} slug - The storefront slug
 * @returns {string} Complete HTML document
 */
function renderStorefrontHtml(storefrontData, slug) {
  const agentName = storefrontData.agent ? storefrontData.agent.name || '' : '';
  const agentWhatsapp = storefrontData.agent ? storefrontData.agent.whatsapp || '' : '';
  const products = storefrontData.products || [];

  // Build embedded data using JSON.stringify for perfect escaping
  const embeddedData = JSON.stringify({
    agent: { name: agentName, whatsapp: agentWhatsapp },
    slug: slug,
    products: products.map(p => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      price: typeof p.price === 'number' ? p.price : 0
    }))
  });

  // Product cards use escaped HTML values
  const productCards = products.map(p => {
    const grad = cardGradient(p.name);
    const network = getNetwork(p.name);
    const safeName = escapeHtml(p.name);
    const safeDesc = escapeHtml(p.description);
    const price = typeof p.price === 'number' ? p.price.toFixed(2) : '0.00';
    return `
      <div class="card product-card" data-network="${network}" style="content-visibility:auto">
        <div class="card-header" style="background:${grad}">
          <div class="card-header-overlay"></div>
          <div class="card-header-content">
            <div>
              <div class="card-category">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071A9.5 9.5 0 0112 4a9.5 9.5 0 017.071 2.929M12 7v.01m-4.95 3.96A5.5 5.5 0 0112 9a5.5 5.5 0 014.95 2.96"/></svg>
                Data Bundle
              </div>
              <div class="card-title">${safeName}</div>
            </div>
            <span class="card-badge">Available</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-desc">${safeDesc}</div>
          <div class="card-price">
            <span class="price-amount">GHS ${price}</span>
            <span class="price-label">/ bundle</span>
          </div>
          <div class="tags">
            <span class="tag tag-1"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Instant</span>
            <span class="tag tag-2"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> Secure</span>
            <span class="tag tag-3"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg> Trusted</span>
          </div>
          <button class="btn-buy" style="background:${grad}" data-pid="${p.id}">
            Purchase Now <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>`;
  }).join('\n');

  const safeAgentName = escapeHtml(agentName);
  const safeTitle = safeAgentName + "'s Store - Data Bundles";
  const safeMetaDesc = safeAgentName + "'s Store - Data Bundles";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="description" content="${safeMetaDesc}"/>
<title>${safeTitle}</title>
<style>${INLINE_CSS}</style>
</head>
<body>
<script>window.__STOREFRONT_DATA__=${embeddedData};</script>

<nav>
  <div class="nav-inner">
    <div class="nav-brand">
      <div class="nav-icon">&#9889;</div>
      <div>
        <span class="nav-name">${safeAgentName}'s Store</span>
        <span class="nav-badge"></span>
      </div>
    </div>
    <button id="open-track" class="btn-sm">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      Track Order
    </button>
  </div>
</nav>

<main>
  <div class="filter-bar">
    <div class="filter-label">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
      Filter by Network
    </div>
    <div class="filter-group">
      <button class="filter-btn active" data-filter="all">All Networks</button>
      <button class="filter-btn" data-filter="mtn">MTN</button>
      <button class="filter-btn" data-filter="airtel">AirtelTigo</button>
      <button class="filter-btn" data-filter="telecel">Telecel</button>
    </div>
  </div>

  ${products.length === 0 ? `
  <div class="empty">
    <div class="empty-icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
    </div>
    <h2>No Products Available</h2>
    <p>Check back later for new data bundles.</p>
  </div>` : `
  <div class="grid">
    ${productCards}
  </div>`}

  <!-- WhatsApp Bubble -->
  ${agentWhatsapp ? `
  <a href="${escapeHtml(agentWhatsapp)}" target="_blank" rel="noopener noreferrer" style="position:fixed;bottom:24px;right:24px;z-index:50;display:flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(37,211,102,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    <span style="display:none" class="wa-label">WhatsApp Support</span>
  </a>` : ''}
</main>

<!-- Purchase Modal -->
<div id="modal" class="modal-overlay" style="display:none">
  <div class="modal">
    <div id="modal-header" class="modal-header">
      <button class="modal-close"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.8)">Data Bundle</div>
      <h2 style="font-size:18px;font-weight:700;padding-right:32px">Complete Your Order</h2>
      <p id="modal-product-name" style="font-size:14px;color:rgba(255,255,255,.9);margin-top:4px"></p>
    </div>
    <div class="modal-body">
      <div id="modal-product-desc" style="font-size:20px;font-weight:700;color:#fff;margin-bottom:12px"></div>
      <div class="amount-box">
        <span class="amount-label">Amount</span>
        <span id="modal-price" class="amount-value"></span>
      </div>
      <div class="field">
        <label class="field-label">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          Data Bundle Number
        </label>
        <input id="phone-input" class="field-input" type="tel" placeholder="0XXXXXXXXX" maxlength="10"/>
      </div>
      <div class="modal-actions">
        <button id="buy-btn" class="btn-submit">Pay with Mobile Money &#8594;</button>
        <button class="btn-cancel">Cancel</button>
      </div>
      <div class="modal-footer">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <span>Secured by Paystack</span>
      </div>
    </div>
  </div>
</div>

<!-- Tracking Modal -->
<div id="track-modal" class="modal-overlay" style="display:none">
  <div class="modal" style="max-width:512px">
    <div class="modal-header">
      <button class="modal-close"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      <h2 style="font-size:18px;font-weight:700;padding-right:32px">Track Your Order</h2>
    </div>
    <div class="modal-body modal-scroll" style="max-height:70vh">
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        <div style="display:flex;gap:8px">
          <select id="track-mode" class="track-select">
            <option value="phone">By Mobile</option>
            <option value="order">By Order #</option>
          </select>
          <input id="track-input" class="track-input" type="text" placeholder="Enter mobile number" maxlength="10"/>
        </div>
        <button id="track-btn" class="btn-sm" style="justify-content:center;width:100%">&#128269; Search</button>
      </div>
      <div id="track-results"></div>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" class="toast"></div>

<script>${INLINE_JS}</script>
</body>
</html>`;
}

module.exports = { renderStorefrontHtml };
