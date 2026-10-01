/* Atelier Noura — Owner Studio (Supabase: products, product_images, categories, orders, delivery_zones) */
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const STATUS={new:"جديد",confirmed:"مؤكد",preparing:"قيد التحضير",shipped:"تم الشحن",delivered:"تم التسليم",cancelled:"ملغى"};
const NEXT={new:["confirmed","تأكيد الطلب"],confirmed:["preparing","بدء التحضير"],preparing:["shipped","تم الشحن"],shipped:["delivered","تم التسليم"]};
const ST={ordFilter:"all",ordQ:"",prodCat:"all",dzF:"all",dzQ:""};
const head=(k,t,sub,extra="")=>`<div class="dash-head"><div><div class="dash-kicker">${k}</div><h1 class="dash-title">${t}</h1><p class="dash-subtitle">${sub}</p></div>${extra}</div>`;
const pubUrl=p=>OWNER_DB.storage.from("product-media").getPublicUrl(p).data.publicUrl;
const chip=(k,label,n,cur)=>`<button type="button" class="chip${cur===k?" on":""}" data-k="${k}">${label}<b>${n}</b></button>`;

const SC={new:"#C6A15B",confirmed:"#5B86B5",preparing:"#8B69B0",shipped:"#3F9A95",delivered:"#4F9A58",cancelled:"#B3454F"};
const IC=d=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS={sales:'<path d="M3 17l5-5 4 4 8-9M15 7h5v5"/>',orders:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',avg:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',prod:'<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'};

async function adminRender(tab="overview"){
  const root=$("adminApp");if(!root)return;
  root.innerHTML='<div class="empty-state">...</div>';
  updateNotif();
  try{
    if(tab==="overview")return await tabOverview(root);
    if(tab==="products")return await tabProducts(root);
    if(tab==="categories")return await tabCategories(root);
    if(tab==="orders")return await tabOrders(root);
    if(tab==="delivery")return await tabDelivery(root);
    if(tab==="media")return await tabMedia(root);
    return await tabSettings(root);
  }catch(e){console.error(e);root.innerHTML=`<div class="empty-state">تعذر تحميل البيانات: ${esc(e.message)}</div>`}
}
async function updateNotif(){
  try{const {count}=await OWNER_DB.from("orders").select("id",{count:"exact",head:true}).eq("status","new");const b=$("notifBadge");if(b){b.textContent=count||0;b.hidden=!count}}catch(e){}
}
document.addEventListener("DOMContentLoaded",()=>$("notifBtn")?.addEventListener("click",()=>{ST.ordFilter="new";document.querySelector('.admin-tab[data-tab="orders"]')?.click()}));

/* ================= OVERVIEW ================= */
function smooth(pts){
  let d=`M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`}
  return d;
}
function dailySeries(orders,field){
  const out=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const key=d.toLocaleDateString("en-CA");
    const day=orders.filter(o=>o.status!=="cancelled"&&new Date(o.created_at).toLocaleDateString("en-CA")===key);
    out.push({label:d.toLocaleDateString("ar-DZ",{weekday:"short"}),v:field==="count"?day.length:day.reduce((a,o)=>a+Number(o.total),0)});}
  return out;
}
function sparkline(series){
  if(!series.some(x=>x.v>0))return "";
  const m=Math.max(...series.map(x=>x.v)),pts=series.map((x,i)=>[i*(90/6),32-(x.v/m)*28]);
  return `<svg class="spark" viewBox="0 0 90 34"><path d="${smooth(pts)}" fill="none" stroke="#C6A15B" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
function salesChart(series){
  const W=640,H=250,L=56,R=16,T=18,B=34,base=H-B;
  if(!series.some(x=>x.v>0))return '<div class="empty-state">لا توجد مبيعات خلال آخر 7 أيام.<br>ستظهر هنا المنحنيات عند وصول أول طلب.</div>';
  const raw=Math.max(...series.map(x=>x.v)),step=Math.pow(10,Math.floor(Math.log10(raw)))/2,max=Math.ceil(raw/step)*step;
  const X=i=>L+i*((W-L-R)/6),Y=v=>base-(v/max)*(base-T);
  const pts=series.map((x,i)=>[X(i),Y(x.v)]),line=smooth(pts);
  const grid=[0,1,2,3,4].map(i=>{const y=T+i*(base-T)/4,val=max*(1-i/4);return `<line class="c-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="c-lbl" x="${L-10}" y="${y+4}" text-anchor="end">${val>=1000?Math.round(val/1000)+"k":Math.round(val)}</text>`}).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C6A15B" stop-opacity=".34"/><stop offset="1" stop-color="#C6A15B" stop-opacity="0"/></linearGradient></defs>${grid}<path class="c-area" d="${line} L${X(6)},${base} L${X(0)},${base} Z" fill="url(#ga)"/><path class="c-line" d="${line}"/>${pts.map((p,i)=>`<circle class="c-dot" cx="${p[0]}" cy="${p[1]}" r="4.5" style="animation-delay:${1+i*.18}s"/>`).join("")}${series.map((x,i)=>`<text class="c-lbl" x="${X(i)}" y="${H-10}" text-anchor="middle">${x.label}</text>`).join("")}</svg></div>`;
}
function donut(orders){
  const total=orders.length;if(!total)return '<div class="empty-state">لا توجد طلبات بعد.</div>';
  const C=2*Math.PI*54;let acc=0;
  const segs=Object.keys(STATUS).map(k=>({k,n:orders.filter(o=>o.status===k).length})).filter(x=>x.n);
  const circles=segs.map(x=>{const len=Math.max(x.n/total*C-3,1);const c=`<circle class="seg" cx="70" cy="70" r="54" stroke="${SC[x.k]}" data-len="${len}" stroke-dasharray="0 ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`;acc+=x.n/total*C;return c}).join("");
  setTimeout(()=>document.querySelectorAll(".donut .seg").forEach(c=>c.style.strokeDasharray=`${c.dataset.len} ${C}`),150);
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" width="150" height="150"><circle cx="70" cy="70" r="54" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="16"/>${circles}<text class="n" x="70" y="73">${total}</text><text class="s" x="70" y="90">طلب</text></svg><div class="legend">${Object.keys(STATUS).map(k=>`<div style="--c:${SC[k]}"><i></i>${STATUS[k]}<b>${orders.filter(o=>o.status===k).length}</b></div>`).join("")}</div></div>`;
}
async function tabOverview(root){
  const {data:o,error}=await OWNER_DB.from("orders").select("order_number,customer_name,wilaya_name,total,status,created_at").order("created_at",{ascending:false});
  if(error)throw error;
  const valid=o.filter(x=>x.status!=="cancelled"),sum=valid.reduce((a,x)=>a+Number(x.total),0),n=o.filter(x=>x.status==="new").length;
  const {count}=await OWNER_DB.from("products").select("id",{count:"exact",head:true}).eq("is_active",true);
  const sales=dailySeries(o,"sum"),cnt=dailySeries(o,"count");
  const kpi=(ic,l,v,sub,sp="")=>`<div class="kpi"><div class="k-top"><span>${l}</span>${IC(ICONS[ic])}</div><b>${v}</b><small>${sub}</small>${sp}</div>`;
  root.innerHTML=head("ATELIER NOURA · OWNER STUDIO","مرحبًا بك، مالك المتجر","نظرة على أداء متجرك. كل الأرقام حقيقية من الطلبات المسجلة.")
  +`<div class="kpis">${kpi("sales","إجمالي المبيعات",money(sum),valid.length+" طلب",sparkline(sales))}${kpi("orders","عدد الطلبات",o.length,n+" طلب جديد",sparkline(cnt))}${kpi("avg","متوسط قيمة الطلب",money(valid.length?sum/valid.length:0),"من الطلبات غير الملغاة")}${kpi("prod","المنتجات النشطة",count||0,"ظاهرة في المتجر")}</div>`
  +`<div class="grid2"><section class="panel"><h3>المبيعات خلال آخر 7 أيام</h3>${salesChart(sales)}</section><section class="panel"><h3>حالة الطلبات</h3>${donut(o)}</section></div>`
  +`<section class="panel"><h3>آخر الطلبات</h3>${o.length?`<div class="table-scroll"><table class="dtable"><thead><tr><th>الطلب</th><th>الزبون</th><th>الولاية</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${o.slice(0,6).map(x=>`<tr><td><span class="order-pill">${x.order_number}</span></td><td>${esc(x.customer_name)}</td><td>${esc(x.wilaya_name)}</td><td>${money(x.total)}</td><td><span class="badge b-${x.status}">${STATUS[x.status]||x.status}</span></td><td>${new Date(x.created_at).toLocaleDateString("fr-DZ")}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state">لا توجد طلبات بعد.</div>'}</section>`;
}

/* ================= CATEGORIES ================= */
async function tabCategories(root){
  const [{data:cats,error},{data:ps}]=await Promise.all([OWNER_DB.from("categories").select("*").order("sort_order"),OWNER_DB.from("products").select("category_id")]);
  if(error)throw error;
  root.innerHTML=head("CATEGORIES","التصنيفات","أسماء التصنيفات كما تظهر للزبائن. المعرّف الداخلي ثابت حتى لا ينكسر المتجر.")
  +`<section class="panel"><div class="table-scroll"><table class="dtable"><thead><tr><th>المعرّف</th><th>الاسم بالعربية</th><th>Français</th><th>English</th><th>المنتجات</th></tr></thead><tbody>${cats.map(c=>`<tr data-id="${c.id}"><td><span class="order-pill">${esc(c.slug)}</span></td><td><input data-f="name_ar" value="${esc(c.name_ar)}"></td><td><input data-f="name_fr" value="${esc(c.name_fr)}"></td><td><input data-f="name_en" value="${esc(c.name_en)}"></td><td>${(ps||[]).filter(p=>p.category_id===c.id).length}</td></tr>`).join("")}</tbody></table></div><span class="saved" id="catSaved">✓ تم الحفظ</span></section>`;
  root.querySelector(".panel").addEventListener("change",async e=>{
    const i=e.target.closest("[data-f]"),tr=e.target.closest("tr[data-id]");if(!i||!tr||!i.value.trim())return;
    const {error}=await OWNER_DB.from("categories").update({[i.dataset.f]:i.value.trim()}).eq("id",tr.dataset.id);
    if(error)return alert(error.message);const s=$("catSaved");s.classList.add("show");setTimeout(()=>s.classList.remove("show"),1500);
  });
}

/* ================= MEDIA ================= */
async function tabMedia(root){
  const {data,error}=await OWNER_DB.from("product_images").select("*,products(name_ar)").order("product_id").order("sort_order");
  if(error)throw error;
  window.__media=data;
  const prods=[...new Map(data.map(m=>[m.product_id,m.products?.name_ar||"—"])).entries()];
  root.innerHTML=head("MEDIA","أرشيف الوسائط","كل صور وفيديوهات المنتجات. مرّري على الصورة لإظهار الأدوات.")
  +`<div class="toolbar-a"><select id="mediaProd"><option value="all">كل المنتجات (${data.length})</option>${prods.map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join("")}</select><span class="dash-subtitle">لرفع وسائط جديدة استعملي زر «صور/فيديو» في صفحة المنتجات.</span></div><div class="mgrid" id="mgrid"></div>`;
  const draw=()=>{
    const f=$("mediaProd").value,list=data.filter(m=>f==="all"||m.product_id===f);
    $("mgrid").innerHTML=list.length?list.map(m=>{const url=pubUrl(m.storage_path),name=m.storage_path.split("/").pop().replace(/^\d+-\d+-/,"");
      return `<div class="mitem" tabindex="0">${m.media_type==="video"?`<video src="${url}" muted playsinline></video>`:`<img src="${url}" alt="" loading="lazy">`}<div class="mmeta">${m.is_cover?'<span class="badge b-feat">الغلاف</span>':""}<span class="badge b-off">${m.media_type==="video"?"فيديو":"صورة"}</span></div><div class="mover"><strong>${esc(m.products?.name_ar||"")}</strong><small>${esc(name.slice(0,28))}</small><div class="row">${m.media_type==="video"||m.is_cover?"":`<button data-cover="${m.id}">تعيين كغلاف</button>`}<button data-mv="${m.id}" data-d="-1">◂</button><button data-mv="${m.id}" data-d="1">▸</button><button data-rm="${m.id}">حذف</button></div></div></div>`}).join(""):'<div class="empty-state">لا توجد وسائط بعد.</div>';
  };
  $("mediaProd").onchange=draw;draw();
  $("mgrid").onclick=async e=>{
    const b=e.target.closest("button");if(!b)return;
    const id=b.dataset.cover||b.dataset.mv||b.dataset.rm,m=data.find(x=>x.id===id);
    if(b.dataset.cover){await OWNER_DB.from("product_images").update({is_cover:false}).eq("product_id",m.product_id);const {error}=await OWNER_DB.from("product_images").update({is_cover:true,sort_order:-1}).eq("id",id);if(error)return alert(error.message);await OWNER_DB.from("products").update({cover_image:m.storage_path}).eq("id",m.product_id)}
    else if(b.dataset.mv){const sib=data.filter(x=>x.product_id===m.product_id).sort((x,y)=>x.sort_order-y.sort_order),i=sib.indexOf(m),j=i+Number(b.dataset.d);if(j<0||j>=sib.length)return;sib.splice(j,0,sib.splice(i,1)[0]);await Promise.all(sib.map((x,k)=>OWNER_DB.from("product_images").update({sort_order:k}).eq("id",x.id)))}
    else if(b.dataset.rm){if(!confirm("حذف هذه الوسيطة نهائيًا؟"))return;await OWNER_DB.storage.from("product-media").remove([m.storage_path]);const {error}=await OWNER_DB.from("product_images").delete().eq("id",id);if(error)return alert(error.message)}
    adminRender("media");
  };
}

/* ================= SETTINGS ================= */
async function tabSettings(root){
  const {data:{user}}=await OWNER_DB.auth.getUser();
  root.innerHTML=head("SETTINGS","الإعدادات","معلومات الجلسة الحالية.")+`<section class="panel"><div class="legend" style="font-size:15px;gap:16px"><div>البريد<b>${esc(user?.email||"")}</b></div><div>الدور<b>مالك (owner)</b></div><div>الاتصال<b>Supabase Auth ✓</b></div><div>المتجر<b><a href="index.html" style="color:var(--gold2)">فتح المتجر ↗</a></b></div></div></section>`;
}

/* ================= ORDERS ================= */
const waLink=ph=>{let d=String(ph||"").replace(/\D/g,"");if(d.startsWith("00"))d=d.slice(2);else if(d.startsWith("0"))d="213"+d.slice(1);return "https://wa.me/"+d};

async function tabOrders(root){
  const {data,error}=await OWNER_DB.from("orders").select("*,order_items(*)").order("created_at",{ascending:false});
  if(error)throw error;
  window.__orders=data;
  root.innerHTML=head("ORDERS","الطلبات","تابعي كل طلب من الاستلام حتى التسليم.")+`<div class="toolbar-a"><div class="chips" id="ordChips"></div><input type="search" id="ordQ" placeholder="بحث: اسم، هاتف، رقم الطلب" value="${esc(ST.ordQ)}"></div><div class="ord-list" id="ordList"></div>`;
  $("ordQ").oninput=e=>{ST.ordQ=e.target.value;fillOrders()};
  $("ordChips").onclick=e=>{const b=e.target.closest("[data-k]");if(b){ST.ordFilter=b.dataset.k;fillOrders()}};
  $("ordList").addEventListener("click",async e=>{
    const b=e.target.closest("[data-next]");if(!b)return;b.disabled=true;await setOrderStatus(b.dataset.id,b.dataset.next);
  });
  $("ordList").addEventListener("change",async e=>{const s=e.target.closest("[data-st]");if(s)await setOrderStatus(s.dataset.st,s.value)});
  fillOrders();
}
async function setOrderStatus(id,status){
  const {error}=await OWNER_DB.from("orders").update({status}).eq("id",id);
  if(error){alert(error.message);return}
  window.__orders.find(o=>o.id===id).status=status;fillOrders();
}
function fillOrders(){
  const all=window.__orders,q=ST.ordQ.trim().toLowerCase();
  const cnt=k=>k==="all"?all.length:all.filter(o=>o.status===k).length;
  $("ordChips").innerHTML=chip("all","الكل",cnt("all"),ST.ordFilter)+Object.entries(STATUS).map(([k,v])=>chip(k,v,cnt(k),ST.ordFilter)).join("");
  const list=all.filter(o=>(ST.ordFilter==="all"||o.status===ST.ordFilter)&&(!q||[o.order_number,o.customer_name,o.customer_phone,o.wilaya_name].join(" ").toLowerCase().includes(q)));
  $("ordList").innerHTML=list.length?list.map(o=>{
    const nx=NEXT[o.status];
    return `<article class="ord s-${o.status}">
<div class="ord-h"><span class="order-pill">${o.order_number}</span><span class="badge b-${o.status}">${STATUS[o.status]}</span><time>${new Date(o.created_at).toLocaleString("fr-DZ",{dateStyle:"medium",timeStyle:"short"})}</time></div>
<div class="ord-body">
<div class="ord-cust"><b>${esc(o.customer_name)}</b><div class="ord-contact"><a class="mini" href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a><a class="mini wa" target="_blank" rel="noopener" href="${waLink(o.customer_phone)}">WhatsApp</a></div>
<p class="ord-meta">${esc(o.wilaya_name)} · ${o.delivery_method==="office"?"مكتب التوصيل":"توصيل إلى المنزل"}${o.address?`<br>${esc(o.address)}`:""}${o.customer_email?`<br>${esc(o.customer_email)}`:""}</p>${o.notes?`<div class="ord-note">${esc(o.notes)}</div>`:""}</div>
<ul class="ord-items">${o.order_items.map(i=>`<li><span>${esc(i.product_name)}</span><em>× ${i.quantity}</em><b>${money(i.line_total)}</b></li>`).join("")}</ul>
<div class="ord-sum"><div><span>المجموع الفرعي</span><b>${money(o.subtotal)}</b></div><div><span>التوصيل</span><b>${money(o.delivery_fee)}</b></div><div class="t"><span>الإجمالي</span><b>${money(o.total)}</b></div></div>
</div>
<div class="ord-f">${nx?`<button type="button" class="admin-primary" data-next="${nx[0]}" data-id="${o.id}">${nx[1]}</button>`:"<span></span>"}<select data-st="${o.id}">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select></div>
</article>`}).join(""):'<div class="pempty">لا توجد طلبات في هذا التصنيف.</div>';
}

/* ================= PRODUCTS (grouped by category) ================= */
async function tabProducts(root){
  const [{data:ps,error},{data:cats,error:e2}]=await Promise.all([OWNER_DB.from("products").select("*,product_images(id,storage_path,media_type,sort_order)").order("created_at",{ascending:false}),OWNER_DB.from("categories").select("*").order("sort_order")]);
  if(error)throw error;if(e2)throw e2;
  window.__cats=cats;window.__ps=ps;
  root.innerHTML=head("CATALOG","المنتجات","المنتجات مرتبة حسب التصنيف، ما تنشرينه يظهر مباشرة للزبائن.",'<button class="admin-primary" id="addProd" type="button">+ منتج جديد</button>')+`<div class="chips" id="prodChips" style="margin-bottom:22px"></div><div id="prodList"></div>`;
  $("addProd").onclick=()=>openProd();
  $("prodChips").onclick=e=>{const b=e.target.closest("[data-k]");if(b){ST.prodCat=b.dataset.k;fillProducts()}};
  const L=$("prodList");
  L.addEventListener("click",async e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.addCat!==undefined)return openProd(null,t.dataset.addCat);
    if(t.dataset.edit)return openProd(window.__ps.find(p=>p.id===t.dataset.edit));
    if(t.dataset.vis){const p=window.__ps.find(p=>p.id===t.dataset.vis);const {error}=await OWNER_DB.from("products").update({is_active:!p.is_active}).eq("id",p.id);if(error)return alert(error.message);p.is_active=!p.is_active;return fillProducts()}
    if(t.dataset.del){if(!confirm("حذف المنتج نهائيًا؟"))return;const {error}=await OWNER_DB.from("products").delete().eq("id",t.dataset.del);if(error)alert(error.message);adminRender("products")}
  });
  L.addEventListener("change",async e=>{
    const i=e.target.closest("[data-up]");if(!i)return;
    const id=i.dataset.up,prod=window.__ps.find(p=>p.id===id);let k=prod.product_images.length;
    for(const f of i.files){
      const path=`${id}/${Date.now()}-${k}-${f.name.replace(/[^\w.]/g,"_")}`;
      const {error}=await OWNER_DB.storage.from("product-media").upload(path,f);
      if(error){alert(error.message);continue}
      const first=k===0&&!f.type.startsWith("video");
      const {error:e2}=await OWNER_DB.from("product_images").insert({product_id:id,storage_path:path,media_type:f.type.startsWith("video")?"video":"image",sort_order:k,is_cover:first});
      if(e2){alert(e2.message);continue}
      if(first)await OWNER_DB.from("products").update({cover_image:path}).eq("id",id);
      k++;
    }
    adminRender("products");
  });
  fillProducts();
}
function fillProducts(){
  const cats=window.__cats,ps=window.__ps;
  const known=new Set(cats.map(c=>c.id)),orphans=ps.filter(p=>!known.has(p.category_id));
  const groups=cats.map(c=>({k:c.id,name:c.name_ar,items:ps.filter(p=>p.category_id===c.id)}));
  if(orphans.length)groups.push({k:"none",name:"بدون تصنيف",items:orphans});
  if(ST.prodCat!=="all"&&!groups.some(g=>g.k===ST.prodCat))ST.prodCat="all";
  $("prodChips").innerHTML=chip("all","الكل",ps.length,ST.prodCat)+groups.map(g=>chip(g.k,esc(g.name),g.items.length,ST.prodCat)).join("");
  const card=p=>{const im=p.product_images.find(m=>m.media_type!=="video");
    return `<div class="pcard${p.is_active?"":" hid"}"><div class="pimg">${im?`<img src="${pubUrl(im.storage_path)}" alt="">`:"بدون صورة"}${!p.is_active?'<span class="badge b-off">مخفي</span>':p.stock<=0?'<span class="badge b-cancelled">نفدت الكمية</span>':p.is_featured?'<span class="badge b-feat">مميز</span>':""}</div>
<div class="pinfo"><strong>${esc(p.name_ar)}</strong><span class="pr">${money(p.price)}</span><small>مخزون ${p.stock} · ${p.product_images.length} وسائط</small></div>
<div class="pact"><button class="admin-secondary" data-edit="${p.id}">تعديل</button><label class="upload-btn">صور/فيديو<input type="file" accept="image/*,video/*" multiple data-up="${p.id}"></label><button class="admin-secondary" data-vis="${p.id}">${p.is_active?"إخفاء":"إظهار"}</button><button class="danger-btn" data-del="${p.id}">حذف</button></div></div>`};
  $("prodList").innerHTML=groups.filter(g=>ST.prodCat==="all"||g.k===ST.prodCat).map(g=>`<section class="cat-group"><div class="cat-head"><h3>${esc(g.name)}<small>${g.items.length} منتج</small></h3>${g.k!=="none"?`<button class="admin-secondary" data-add-cat="${g.k}">+ إضافة إلى ${esc(g.name)}</button>`:""}</div>${g.items.length?`<div class="pgrid">${g.items.map(card).join("")}</div>`:'<div class="pempty">لا توجد منتجات في هذا التصنيف بعد.</div>'}</section>`).join("");
}
function openProd(p,catId){
  $("productModalTitle").textContent=p?"تعديل منتج":"إضافة منتج";
  $("categoryId").innerHTML=window.__cats.map(c=>`<option value="${c.id}">${esc(c.name_ar)}</option>`).join("");
  const set=(i,v)=>$(i).value=v??"";
  set("productId",p?.id);set("nameAr",p?.name_ar);set("nameFr",p?.name_fr);set("nameEn",p?.name_en);set("price",p?.price);set("stock",p?.stock??0);set("categoryId",p?.category_id||catId||(ST.prodCat!=="all"&&ST.prodCat!=="none"?ST.prodCat:window.__cats[0]?.id));set("descAr",p?.description_ar);set("descFr",p?.description_fr);set("descEn",p?.description_en);
  $("featured").checked=!!p?.is_featured;$("active").checked=p?p.is_active:true;$("productMessage").textContent="";
  $("productModal").setAttribute("aria-hidden","false");
}
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=()=>$("productModal").setAttribute("aria-hidden","true"));
  $("productForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const ar=$("nameAr").value.trim();
    const row={name_ar:ar,name_fr:$("nameFr").value.trim()||ar,name_en:$("nameEn").value.trim()||ar,price:$("price").value,stock:$("stock").value,category_id:$("categoryId").value||null,description_ar:$("descAr").value||null,description_fr:$("descFr").value||null,description_en:$("descEn").value||null,is_featured:$("featured").checked,is_active:$("active").checked};
    const id=$("productId").value;
    if(!id)row.slug="p-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const {error}=id?await OWNER_DB.from("products").update(row).eq("id",id):await OWNER_DB.from("products").insert(row);
    if(error){$("productMessage").textContent=error.message;return}
    $("productModal").setAttribute("aria-hidden","true");adminRender("products");
  });
});

/* ================= DELIVERY ================= */
async function tabDelivery(root){
  const {data,error}=await OWNER_DB.from("delivery_zones").select("*").order("wilaya_code");
  if(error)throw error;
  window.__dz=data;
  root.innerHTML=head("DELIVERY","أسعار التوصيل","هذه الأسعار هي التي تُحسب تلقائيًا في صفحة الدفع حسب ولاية الزبون وطريقة التوصيل. الولاية المعطّلة لا تظهر للزبون.")
  +`<div id="dzWarn"></div><div class="card-a"><div class="dz-bulk"><label>سعر المنزل (DA)<input type="number" min="0" id="bkHome" placeholder="مثال 600"></label><label>سعر المكتب (DA)<input type="number" min="0" id="bkOffice" placeholder="مثال 400"></label><button class="admin-primary" id="bkApply" type="button">تطبيق على الولايات المعروضة</button><span class="saved" id="dzSaved">✓ تم الحفظ</span></div><p class="dash-subtitle" style="margin:10px 0 0">حدّدي سعرًا واحدًا لكل الولايات ثم عدّلي الاستثناءات، أو صفّي القائمة أولًا ليُطبَّق السعر على جزء منها.</p></div>
<div class="toolbar-a"><div class="chips" id="dzChips"></div><input type="search" id="dzQ" placeholder="ابحثي عن ولاية" value="${esc(ST.dzQ)}"></div><div class="dashboard-card" id="dzList"></div>`;
  $("dzQ").oninput=e=>{ST.dzQ=e.target.value;fillDz()};
  $("dzChips").onclick=e=>{const b=e.target.closest("[data-k]");if(b){ST.dzF=b.dataset.k;fillDz()}};
  const flash=()=>{const s=$("dzSaved");s.classList.add("show");setTimeout(()=>s.classList.remove("show"),1600)};
  $("dzList").addEventListener("change",async e=>{
    const row=e.target.closest("[data-id]");if(!row)return;const z=window.__dz.find(x=>x.id===row.dataset.id);
    const patch={home_fee:Number(row.querySelector('[data-f="home_fee"]').value||0),office_fee:Number(row.querySelector('[data-f="office_fee"]').value||0),is_active:row.querySelector('[data-f="is_active"]').checked};
    const {error}=await OWNER_DB.from("delivery_zones").update(patch).eq("id",z.id);
    if(error)return alert(error.message);Object.assign(z,patch);flash();fillDz(true);
  });
  $("bkApply").onclick=async()=>{
    const h=$("bkHome").value,o=$("bkOffice").value;if(h===""&&o==="")return alert("اكتبي سعرًا واحدًا على الأقل.");
    const ids=dzVisible().map(z=>z.id);if(!ids.length)return;
    if(!confirm(`تطبيق السعر على ${ids.length} ولاية؟`))return;
    const patch={};if(h!=="")patch.home_fee=Number(h);if(o!=="")patch.office_fee=Number(o);
    const {error}=await OWNER_DB.from("delivery_zones").update(patch).in("id",ids);
    if(error)return alert(error.message);window.__dz.filter(z=>ids.includes(z.id)).forEach(z=>Object.assign(z,patch));flash();fillDz();
  };
  fillDz();
}
function dzVisible(){
  const q=ST.dzQ.trim().toLowerCase();
  return window.__dz.filter(z=>(ST.dzF==="all"||(ST.dzF==="zero"&&z.is_active&&!Number(z.home_fee)&&!Number(z.office_fee))||(ST.dzF==="off"&&!z.is_active))&&(!q||[z.wilaya_code,z.wilaya_name_ar,z.wilaya_name_fr].join(" ").toLowerCase().includes(q)));
}
function fillDz(keepFocus){
  const all=window.__dz,zero=all.filter(z=>z.is_active&&!Number(z.home_fee)&&!Number(z.office_fee)).length;
  $("dzWarn").innerHTML=zero?`<div class="dz-warn">${zero} ولاية بدون سعر توصيل (0 DA)، ستظهر مجانية للزبون. استعملي الأداة بالأسفل لتحديد الأسعار.</div>`:"";
  $("dzChips").innerHTML=chip("all","كل الولايات",all.length,ST.dzF)+chip("zero","بدون سعر",zero,ST.dzF)+chip("off","معطّلة",all.filter(z=>!z.is_active).length,ST.dzF);
  if(keepFocus&&document.activeElement?.closest?.("#dzList"))return;
  $("dzList").innerHTML=`<div class="dz-grid h"><span>الولاية</span><span>المنزل (DA)</span><span>المكتب (DA)</span><span>متاحة</span></div>`+dzVisible().map(z=>`<div class="dz-grid${z.is_active?"":" off"}" data-id="${z.id}"><span>${z.wilaya_code} - ${esc(z.wilaya_name_ar)}</span><input type="number" min="0" data-f="home_fee" value="${z.home_fee}"><input type="number" min="0" data-f="office_fee" value="${z.office_fee}"><label class="sw"><input type="checkbox" data-f="is_active" ${z.is_active?"checked":""}> متاحة</label></div>`).join("");
}
