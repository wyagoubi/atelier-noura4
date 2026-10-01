/* Atelier Noura — Owner Studio
   Visual dashboard layer + existing owner authentication.
   No database schema or order RPC is changed here. */

let OWNER_DB = null;

const demoProducts = [
  {id:1,name:"Noura Tote",category:"bags",price:"4,800 DA"},
  {id:2,name:"Lina Mini",category:"bags",price:"3,600 DA"},
  {id:3,name:"Sahara Skirt",category:"skirts",price:"6,200 DA"},
  {id:4,name:"Noura Scarf",category:"accessories",price:"2,200 DA"},
  {id:5,name:"Atelier Pouch",category:"accessories",price:"2,800 DA"},
  {id:6,name:"Dune Skirt",category:"skirts",price:"5,900 DA"}
];

function getImages(){try{return JSON.parse(localStorage.getItem("productImages")||"{}")}catch{return {}}}
function saveImages(x){localStorage.setItem("productImages",JSON.stringify(x))}
function $(id){return document.getElementById(id)}
function setLoginMessage(text,error=false){const el=$("loginMessage");if(!el)return;el.textContent=text||"";el.classList.toggle("error",Boolean(error))}
function money(value){return new Intl.NumberFormat("fr-DZ").format(Number(value||0))+" DA"}
function getStoredOrder(){try{return JSON.parse(localStorage.getItem("demoOrder")||"null")}catch{return null}}

async function ensureOwner(){
  if(!OWNER_DB)OWNER_DB=await initSupabase();
  const {data:{user}}=await OWNER_DB.auth.getUser();
  if(!user)return null;
  const {data:profile,error}=await OWNER_DB.from("profiles").select("id,role,full_name").eq("id",user.id).maybeSingle();
  if(error)throw error;
  if(profile?.role!=="owner")return null;
  return {user,profile};
}

function showLogin(){
  $("loginView").style.display="grid";
  $("dashboardView").style.display="none";
  if($("logoutBtn"))$("logoutBtn").style.display="none";
  document.querySelector(".admin-top")?.style.setProperty("display","none");
}

async function showDashboard(owner){
  $("loginView").style.display="none";
  $("dashboardView").style.display="grid";
  document.querySelector(".admin-top")?.style.setProperty("display","flex");
  if($("logoutBtn"))$("logoutBtn").style.display="inline-flex";
  if($("ownerEmail"))$("ownerEmail").textContent=owner.user.email||"Owner";
  adminRender("overview");
}

async function ownerLogin(event){
  event.preventDefault();
  const email=$("loginEmail")?.value.trim();
  const password=$("loginPassword")?.value||"";
  if(!email||!password)return;
  const button=document.querySelector('#loginForm button[type="submit"]');
  if(button){button.disabled=true;button.textContent="جاري الدخول..."}
  setLoginMessage("جاري التحقق من بيانات المالك...");
  try{
    if(!OWNER_DB)OWNER_DB=await initSupabase();
    const {error}=await OWNER_DB.auth.signInWithPassword({email,password});
    if(error)throw error;
    const owner=await ensureOwner();
    if(!owner){await OWNER_DB.auth.signOut();throw new Error("هذا الحساب ليس حساب مالك Atelier Noura.")}
    setLoginMessage("");
    await showDashboard(owner);
  }catch(error){
    console.error("Owner authentication:",error);
    setLoginMessage(error?.message||"بيانات الدخول غير صحيحة.",true);
    if(button){button.disabled=false;button.textContent="دخول المالك ↗"}
  }
}

async function ownerLogout(){
  try{if(OWNER_DB)await OWNER_DB.auth.signOut()}catch(error){console.error(error)}
  showLogin();
}

function toggleOwnerTheme(){
  const dark=document.body.classList.toggle("owner-light");
  localStorage.setItem("atelierOwnerTheme",dark?"light":"dark");
}
function loadOwnerTheme(){
  if(localStorage.getItem("atelierOwnerTheme")==="light")document.body.classList.add("owner-light");
}

function buildCurve(order){
  const width=820,height=250,padX=35,padY=28;
  const total=Number(order?.total||0);
  if(!total)return {empty:true};
  const values=[0,total*.18,total*.33,total*.27,total*.52,total*.74,total];
  const max=Math.max(...values,1);
  const points=values.map((v,i)=>{
    const x=padX+(i*(width-padX*2)/(values.length-1));
    const y=height-padY-(v/max)*(height-padY*2);
    return [x,y];
  });
  const line=points.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area=line+` L ${points[points.length-1][0]} ${height-padY} L ${points[0][0]} ${height-padY} Z`;
  return {width,height,line,area,last:points[points.length-1],total};
}

function renderOverview(){
  const root=$("adminApp");
  const order=getStoredOrder();
  const images=getImages();
  const total=Number(order?.total||0);
  const curve=buildCurve(order);
  const status=order?1:0;
  const avg=order?total:0;
  const chart=curve.empty?`<div class="chart-empty"><div><strong>منحنى المبيعات</strong><span>سيظهر هنا عند تسجيل أول طلب حقيقي.</span></div></div>`:`<svg class="sales-chart" viewBox="0 0 ${curve.width} ${curve.height}" preserveAspectRatio="none" aria-label="منحنى المبيعات"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d4af6a" stop-opacity=".20"/><stop offset="1" stop-color="#d4af6a" stop-opacity="0"/></linearGradient></defs><line class="chart-grid-line" x1="35" y1="55" x2="785" y2="55"/><line class="chart-grid-line" x1="35" y1="110" x2="785" y2="110"/><line class="chart-grid-line" x1="35" y1="165" x2="785" y2="165"/><path class="chart-area" d="${curve.area}"/><path class="chart-line" d="${curve.line}"/><circle class="chart-dot" cx="${curve.last[0]}" cy="${curve.last[1]}" r="5"/><text class="chart-label" x="35" y="235">الطلب الحالي</text><text class="chart-value" x="785" y="${Math.max(20,curve.last[1]-14)}" text-anchor="end">${money(curve.total)}</text></svg>`;

  root.innerHTML=`
    <div class="dash-head">
      <div><div class="dash-kicker">ATELIER NOURA · OWNER</div><h1 class="dash-title">لوحة التحكم</h1><p class="dash-subtitle">نظرة هادئة على المتجر، الطلبات والمبيعات — بدون أرقام تجريبية.</p></div>
      <div class="dash-date">LIVE STORE · ${new Date().toLocaleDateString("ar-DZ")}</div>
    </div>
    <div class="stats">
      <div class="stat gold"><span>SALES</span><b>${money(total)}</b><em>${order?"من الطلبات المسجلة حاليًا":"لا توجد مبيعات مسجلة بعد"}</em></div>
      <div class="stat"><span>ORDERS</span><b>${status}</b><em>${status?"آخر طلب مسجل":"بانتظار أول طلب"}</em></div>
      <div class="stat"><span>AVERAGE ORDER</span><b>${money(avg)}</b><em>${status?"متوسط الطلب الحالي":"لا توجد بيانات"}</em></div>
      <div class="stat"><span>MEDIA</span><b>${Object.keys(images).length}</b><em>صور محفوظة محليًا في هذه الواجهة</em></div>
    </div>
    <div class="dashboard-grid">
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h3>Sales Performance</h3><small>مخطط بصري مستوحى من لوحة الصورة المرجعية</small></div><span class="order-pill">${order?"DATA AVAILABLE":"NO DATA"}</span></div><div class="chart-wrap">${chart}</div></section>
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h3>Order Status</h3><small>حالة الطلبات المسجلة</small></div></div><div class="status-list"><div class="status-row"><i class="status-dot"></i><span>طلبات جديدة</span><b>${status}</b></div><div class="status-row"><i class="status-dot pending"></i><span>قيد المعالجة</span><b>—</b></div><div class="status-row"><i class="status-dot"></i><span>مكتملة</span><b>—</b></div><div class="status-row"><i class="status-dot cancelled"></i><span>ملغاة</span><b>—</b></div></div><div class="mini-bars"><i class="mini-bar" style="--h:${status?"35%":"8%"}"></i><i class="mini-bar" style="--h:${status?"55%":"10%"}"></i><i class="mini-bar" style="--h:${status?"28%":"7%"}"></i><i class="mini-bar" style="--h:${status?"72%":"12%"}"></i><i class="mini-bar" style="--h:${status?"42%":"9%"}"></i><i class="mini-bar" style="--h:${status?"66%":"8%"}"></i><i class="mini-bar" style="--h:${status?"48%":"10%"}"></i></div></section>
    </div>
    <div class="insight-strip">
      <section class="insight-card"><div class="dash-kicker">PROFIT</div><h3>الأرباح</h3><p>لن نعرض رقمًا وهميًا. الربح الصافي يحتاج تكلفة تصنيع/شراء لكل منتج، وهي غير موجودة في البيانات الحالية.</p><div class="profit-value">غير محسوب</div><p class="profit-note">يمكن إضافة Cost Price لاحقًا ثم حساب Net Profit وMargin من الطلبات الحقيقية.</p></section>
      <section class="insight-card"><div class="dash-kicker">LATEST ORDER</div><h3>آخر طلب</h3>${order?`<table class="recent-orders"><tr><th>ORDER</th><th>CUSTOMER</th><th>TOTAL</th></tr><tr><td><span class="order-pill">${order.no||"AN"}</span></td><td>${order.data?.name||"—"}</td><td>${money(order.total)}</td></tr></table>`:`<div class="chart-empty" style="height:100px"><div><strong>لا توجد طلبات</strong><span>عند وصول أول طلب سيظهر هنا.</span></div></div>`}</section>
    </div>`;
}

function adminRender(tab="overview"){
  const root=$("adminApp");if(!root)return;
  const order=getStoredOrder();const images=getImages();
  if(tab==="overview"){renderOverview();return;}
  if(tab==="products")root.innerHTML=`<div class="dash-head"><div><div class="dash-kicker">CATALOG</div><h1 class="dash-title">المنتجات</h1><p class="dash-subtitle">إدارة صور المنتجات من الواجهة الحالية.</p></div></div><div class="dashboard-card" style="padding:20px"><div class="admin-product-list">${demoProducts.map(p=>`<div class="admin-product-row"><div class="admin-product-preview">${images[p.id]?`<img src="${images[p.id]}" alt="${p.name}">`:`<span>NO IMAGE</span>`}</div><div class="admin-product-main"><strong>${p.name}</strong><small>${p.category} · ${p.price}</small><div class="admin-product-actions"><label class="upload-btn">تغيير الصورة<input type="file" accept="image/*" data-product-upload="${p.id}"></label>${images[p.id]?`<button class="danger-btn" onclick="removeProductImage(${p.id})">حذف الصورة</button>`:""}</div></div></div>`).join("")}</div></div>`;
  if(tab==="orders")root.innerHTML=`<div class="dash-head"><div><div class="dash-kicker">ORDERS</div><h1 class="dash-title">الطلبات</h1><p class="dash-subtitle">الطلبات المسجلة في النسخة الحالية.</p></div></div><div class="dashboard-card" style="padding:20px">${order?`<table class="recent-orders"><tr><th>ORDER</th><th>CUSTOMER</th><th>WILAYA</th><th>TOTAL</th><th>STATUS</th></tr><tr><td><span class="order-pill">${order.no}</span></td><td>${order.data?.name||"—"}</td><td>${order.data?.wilaya||"—"}</td><td>${money(order.total)}</td><td>New</td></tr></table>`:`<div class="empty">لا توجد طلبات مسجلة حاليًا.</div>`}</div>`;
  if(tab==="delivery")root.innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DELIVERY</div><h1 class="dash-title">التوصيل</h1><p class="dash-subtitle">قسم التوصيل يحتفظ بمنطقه الحالي دون تغيير قاعدة البيانات.</p></div></div><div class="dashboard-card" style="padding:25px"><h3>Delivery management</h3><p class="dash-subtitle">أسعار ومناطق التوصيل تبقى مرتبطة ببيانات المتجر عند ربط إدارة Supabase الكاملة.</p></div>`;
  if(tab==="media"){root.innerHTML=`<div class="dash-head"><div><div class="dash-kicker">MEDIA STUDIO</div><h1 class="dash-title">الوسائط</h1><p class="dash-subtitle">مساحة مرئية وهادئة لإدارة الوسائط.</p></div></div><div class="dashboard-card" style="padding:20px"><div class="media-upload"><h3>Upload images & videos</h3><p class="dash-subtitle">صور المنتجات الأفضل إدارتها من قسم Products.</p><input id="mediaInput" type="file" accept="image/*,video/*" multiple></div><div id="mediaList" class="media-list"></div></div>`;renderMedia();}
  if(tab==="settings")root.innerHTML=`<div class="dash-head"><div><div class="dash-kicker">STORE SETTINGS</div><h1 class="dash-title">الإعدادات</h1><p class="dash-subtitle">إعدادات الوصول والمظهر.</p></div></div><div class="dashboard-card" style="padding:25px"><h3>Owner account</h3><p class="dash-subtitle">تم تسجيل الدخول بحساب مالك مصادق عليه عبر Supabase.</p><p class="dash-subtitle">كلمة المرور لا يتم تخزينها داخل الموقع.</p></div>`;
  if(tab==="products")document.querySelectorAll("[data-product-upload]").forEach(input=>input.addEventListener("change",e=>uploadProductImage(Number(e.target.dataset.productUpload),e.target.files[0])));
}

function uploadProductImage(id,file){if(!file)return;if(!file.type.startsWith("image/")){alert("اختاري ملف صورة فقط.");return}const reader=new FileReader();reader.onload=()=>{const images=getImages();images[id]=reader.result;saveImages(images);adminRender("products")};reader.readAsDataURL(file)}
function removeProductImage(id){const images=getImages();delete images[id];saveImages(images);adminRender("products")}
function renderMedia(){const list=JSON.parse(localStorage.getItem("media")||"[]");const el=$("mediaList");if(!el)return;el.innerHTML=list.map((x,i)=>`<div class="media-box">${x.url&&x.type?.startsWith("image/")?`<img src="${x.url}" alt="${x.name}">`:""}<button onclick="deleteMedia(${i})">×</button><span>${x.name}</span></div>`).join("");$("mediaInput")?.addEventListener("change",e=>{const arr=JSON.parse(localStorage.getItem("media")||"[]");[...e.target.files].forEach(f=>{const reader=new FileReader();reader.onload=()=>{arr.push({name:f.name,type:f.type,url:reader.result});localStorage.setItem("media",JSON.stringify(arr));renderMedia()};reader.readAsDataURL(f)});e.target.value=""})}
function deleteMedia(i){const a=JSON.parse(localStorage.getItem("media")||"[]");a.splice(i,1);localStorage.setItem("media",JSON.stringify(a));renderMedia()}

document.addEventListener("DOMContentLoaded",()=>{
  loadOwnerTheme();
  $("loginForm")?.addEventListener("submit",ownerLogin);
  $("logoutBtn")?.addEventListener("click",ownerLogout);
  $("ownerTheme")?.addEventListener("click",toggleOwnerTheme);
  document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");adminRender(b.dataset.tab)}));
  bootOwner();
});

async function bootOwner(){
  try{OWNER_DB=await initSupabase();const owner=await ensureOwner();if(owner)await showDashboard(owner);else showLogin()}catch(error){console.error("Owner Studio boot:",error);showLogin();setLoginMessage(error?.message||"تعذر الاتصال بخدمة تسجيل الدخول.",true)}
}
