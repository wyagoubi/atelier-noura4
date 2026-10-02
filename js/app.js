const PRODUCTS=[];
const MEDIA={};
const CAT_AR={skirts:"التنانير",bags:"الحقائب",accessories:"الإكسسوارات",clothing:"الملابس"};
const SUPABASE_CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
function loadScript(src){return new Promise((ok,no)=>{const t=document.createElement("script");t.src=src;t.onload=ok;t.onerror=no;document.head.appendChild(t)})}

const WILAYAS=["أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة","سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غليزان","تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"];

const money=n=>new Intl.NumberFormat("fr-DZ").format(n)+" DA";
const getCart=()=>JSON.parse(localStorage.getItem("cart")||"[]");
const saveCart=c=>{localStorage.setItem("cart",JSON.stringify(c));updateCartCount()};
const getProductImages=()=>{const o={};for(const k in MEDIA){const m=MEDIA[k].find(x=>x.type!=="video");if(m)o[k]=m.url}return o};
const getAccount=()=>JSON.parse(localStorage.getItem("atelierAccount")||"null");

function updateCartCount(){document.querySelectorAll("#cartCount").forEach(e=>e.textContent=getCart().reduce((a,x)=>a+x.qty,0))}

function addToCart(id,qty=1){
  const p=PRODUCTS.find(x=>x.id==id); if(!p)return;
  let c=getCart(),item=c.find(x=>x.id==id);
  item?item.qty+=qty:c.push({id:p.id,qty});
  saveCart(c);
  const b=document.querySelector(`[data-add="${id}"]`);
  if(b){b.textContent="✓";setTimeout(()=>b.textContent="+",900)}
}

function productVisual(p,extraClass=""){
  const images=getProductImages();
  const src=images[p.id];
  return src
    ? `<div class="product-image ${extraClass}"><img src="${src}" alt="${p.name}" loading="lazy"><span class="product-number"></span></div>`
    : `<div class="product-image ${extraClass} product-placeholder"><span class="product-number"></span><div><small>Anoxara </small><strong>${p.name}</strong></div></div>`;
}

function productCard(p){
  return `<article class="product-card"><a href="product.html?id=${p.id}">${productVisual(p)}</a><button class="add" data-add="${p.id}" onclick="addToCart('${p.id}')">+</button><div class="product-info"><h3>${p.name}</h3><p>${p.desc}</p><div class="price">${money(p.price)}</div></div></article>`;
}

function renderProducts(list=PRODUCTS,target="productsGrid"){
  const el=document.getElementById(target); if(el)el.innerHTML=list.map(productCard).join("");
}

function renderNewArrivals(){
  const grid=document.getElementById("newArrivalsGrid"); if(!grid)return;
  const images=getProductImages();
  const items=PRODUCTS.slice(0,3);
  grid.innerHTML=items.map((p,i)=>`<a class="floating-product fp-${i+1}" href="product.html?id=${p.id}">
    <div class="floating-product-image">${images[p.id]?`<img src="${images[p.id]}" alt="${p.name}" loading="eager">`:`<div class="floating-placeholder"><span></span><b>${p.name}</b></div>`}</div>
    <div class="floating-product-meta"><span>${i===0?"NEW ARRIVAL":i===1?"JUST IN":"HANDMADE"}</span><strong>${p.name}</strong><small>${money(p.price)}</small></div>
  </a>`).join("");
}

function initProductsPage(){
  let current=new URLSearchParams(location.search).get("category")||"all";
  const grid=document.getElementById("productsGrid"); if(!grid)return;
  const range=document.getElementById("priceMax"),out=document.getElementById("priceOut"),stock=document.getElementById("inStock"),count=document.getElementById("resultCount");
  const top=Math.max(1000,Math.ceil(Math.max(0,...PRODUCTS.map(p=>p.price))/100)*100);
  if(range){range.max=top;range.value=top}
  function refresh(){
    let a=PRODUCTS.filter(p=>(current==="all"||p.category===current)&&(!range||p.price<=Number(range.value))&&(!stock?.checked||p.stock>0));
    const s=document.getElementById("sort")?.value;
    if(s==="low")a.sort((x,y)=>x.price-y.price);
    if(s==="high")a.sort((x,y)=>y.price-x.price);
    if(out&&range)out.textContent="حتى "+money(range.value);
    if(count)count.textContent=a.length+" منتج";
    renderProducts(a);
  }
  document.querySelectorAll(".filter").forEach(b=>{b.classList.toggle("active",b.dataset.cat===current);b.addEventListener("click",()=>{
    current=b.dataset.cat;
    document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));refresh();
  })});
  document.getElementById("sort")?.addEventListener("change",refresh);
  range?.addEventListener("input",refresh);stock?.addEventListener("change",refresh);
  refresh();
}

function initFx(){
  const m=document.querySelector(".hero-media");
  if(m){
    const set=u=>{m.style.setProperty("--hero-img",`url("${u}")`);m.classList.add("has-img")};
    const im=new Image();
    im.onload=()=>set("images/hero.jpg");
    im.onerror=()=>{const p=PRODUCTS.find(x=>getProductImages()[x.id]);if(p)set(getProductImages()[p.id])};
    im.src="images/hero.jpg";
    addEventListener("scroll",()=>{if(scrollY<900)m.style.transform=`translateY(${scrollY*.08}px)`},{passive:true});
  }
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.1});
  document.querySelectorAll(".reveal,.section-head,.categories,.category-card,.story,.values").forEach(el=>{el.classList.add("rv");io.observe(el)});
}

function initHome(){renderNewArrivals();const g=document.getElementById("featuredGrid");if(g)renderProducts(PRODUCTS.slice(0,4),"featuredGrid")}

function initAccount(){
  const modal=document.getElementById("accountModal");
  const form=document.getElementById("accountForm");
  const emailInput=document.getElementById("ownerLoginEmail");
  const passwordInput=document.getElementById("ownerLoginPassword");
  const message=document.getElementById("ownerLoginMessage");
  const submit=document.getElementById("ownerLoginSubmit");
  const accountName=document.getElementById("accountName");

  document.querySelectorAll("#accountBtn").forEach(btn=>btn.addEventListener("click",async()=>{
    try{
      const d=await db();
      const {data}=await d.auth.getSession();
      const user=data?.session?.user;
      if(user){
        const {data:pr}=await d.from("profiles").select("role").eq("id",user.id).maybeSingle();
        if(pr?.role==="owner"){location.href="admin.html";return}
      }
    }catch(error){
      console.warn("Owner session check failed:",error);
    }
    openAccountModal();
  }));

  if(!modal || !form)return;

  form.onsubmit=async event=>{
    event.preventDefault();
    const email=(emailInput?.value||"").trim();
    const password=passwordInput?.value||"";
    if(!email)return;

    if(message)message.textContent="جاري التحقق من بيانات المالك...";
    if(submit){submit.disabled=true;submit.textContent="جاري الدخول...";}

    try{
      const d=await db();

      if(!password){
        const {error:otpError}=await d.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:new URL("admin.html",location.href).href}});
        if(otpError)throw otpError;
        if(message)message.textContent="تم إرسال رابط الدخول إلى بريدك. افتحيه من نفس الجهاز لتدخلي إلى لوحة المالك مباشرة.";
        if(submit){submit.disabled=false;submit.textContent="إرسال رابط الدخول";}
        return;
      }

      const {data,error}=await d.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error("تعذر إنشاء جلسة الدخول.");

      const {data:profile,error:profileError}=await d
        .from("profiles")
        .select("role")
        .eq("id",data.user.id)
        .maybeSingle();

      if(profileError)throw profileError;

      if(profile?.role!=="owner"){
        await d.auth.signOut();
        throw new Error("هذا الحساب ليس حساب مالك Anoxara .");
      }

      if(accountName)accountName.textContent=email.split("@")[0];
      if(message)message.textContent="تم تسجيل الدخول. جاري فتح لوحة المالك...";
      window.location.href="admin.html";
    }catch(error){
      console.error("Owner login:",error);
      if(message)message.textContent=error?.message||"بيانات الدخول غير صحيحة.";
      if(submit){submit.disabled=false;submit.textContent="دخول إلى لوحة المالك";}
    }
  };

  modal.querySelectorAll("[data-close-account]").forEach(x=>x.addEventListener("click",()=>{
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    if(message)message.textContent="";
  }));

  document.querySelectorAll("#accountLogout").forEach(btn=>btn.addEventListener("click",async()=>{
    try{
      if(window.__ATELIER_NOURA_SUPABASE__?.auth)await window.__ATELIER_NOURA_SUPABASE__.auth.signOut();
    }catch(error){console.warn(error)}
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    if(accountName)accountName.textContent="";
  }));
}

function openAccountModal(){const modal=document.getElementById("accountModal");if(!modal)return;modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.getElementById("ownerLoginEmail")?.focus()}

function initDetail(){
  const el=document.getElementById("productDetail");if(!el)return;
  const p=PRODUCTS.find(x=>x.id==new URLSearchParams(location.search).get("id"))||PRODUCTS[0];
  const images=getProductImages();
  const visual=images[p.id]?`<div class="detail-image has-image"><img src="${images[p.id]}" alt="${p.name}"></div>`:`<div class="detail-image product-placeholder"><div><small>Anoxara </small><strong>NO.</strong></div></div>`;
  el.innerHTML=`<div class="product-detail"><div>${visual}</div><div class="detail-info"><p class="eyebrow">${CAT_AR[p.category]||p.category}</p><h1>${p.name}</h1><div class="price">${money(p.price)}</div><p class="description">${p.desc}<br><br>قطعة مصنوعة بعناية، وقد تختلف التفاصيل قليلًا لأن كل قطعة لها طابعها الخاص.</p><div class="qty"><button id="minus">−</button><b id="qty">1</b><button id="plus">+</button></div><button class="btn btn-dark" id="buy">أضيفي إلى الحقيبة</button></div></div>`;
  let q=1;const qel=document.getElementById("qty");
  document.getElementById("plus").onclick=()=>{q++;qel.textContent=q};
  document.getElementById("minus").onclick=()=>{q=Math.max(1,q-1);qel.textContent=q};
  document.getElementById("buy").onclick=()=>{addToCart(p.id,q);location.href="cart.html"};
}

function initCart(){
  const el=document.getElementById("cartView");if(!el)return;
  const c=getCart();
  if(!c.length){el.innerHTML='<div class="empty"><h2>حقيبتك فارغة</h2><p>اكتشفي قطع Anoxara .</p><a class="btn btn-dark" href="products.html">المتجر</a></div>';return}
  let total=0;
  const rows=c.map(x=>{const p=PRODUCTS.find(z=>z.id==x.id);total+=p.price*x.qty;return `<div class="cart-item"><div class="cart-thumb">${getProductImages()[p.id]?`<img src="${getProductImages()[p.id]}" alt="${p.name}">`:""}</div><div><h3>${p.name}</h3><p>${x.qty} × ${money(p.price)}</p></div><div><b>${money(p.price*x.qty)}</b><button class="remove" onclick="removeCart('${p.id}')">حذف</button></div></div>`}).join("");
  el.innerHTML=`<div class="cart-layout"><div>${rows}</div><aside class="summary-card"><h2>ملخص الطلب</h2><div class="summary-row"><span>المنتجات</span><b>${money(total)}</b></div><div class="summary-row"><span>التوصيل</span><span>يحسب حسب الولاية</span></div><div class="summary-row summary-total"><span>الإجمالي</span><b>${money(total)}</b></div><a class="btn btn-dark full" href="checkout.html">متابعة الطلب</a></aside></div>`;
}
function removeCart(id){saveCart(getCart().filter(x=>x.id!=id));initCart()}


async function db(){if(!window.supabase?.createClient)await loadScript(SUPABASE_CDN);if(typeof initSupabase!=="function")await loadScript("js/supabase.js");return initSupabase()}

async function loadCatalog(){
  try{
    const d=await db();
    const {data,error}=await d.from("products").select("*,categories(slug),product_images(storage_path,media_type,sort_order)").eq("is_active",true).order("created_at",{ascending:false});
    if(error)throw error;
    const lang=localStorage.getItem("lang")||"ar";
    PRODUCTS.length=0;Object.keys(MEDIA).forEach(k=>delete MEDIA[k]);
    (data||[]).forEach(r=>{
      PRODUCTS.push({id:r.id,name:r["name_"+lang]||r.name_ar,category:r.categories?.slug||"clothing",price:Number(r.price),oldPrice:r.compare_at_price?Number(r.compare_at_price):null,stock:r.stock,featured:r.is_featured,desc:r["description_"+lang]||r.description_ar||""});
      MEDIA[r.id]=(r.product_images||[]).sort((x,y)=>x.sort_order-y.sort_order).map(m=>({url:d.storage.from("product-media").getPublicUrl(m.storage_path).data.publicUrl,type:m.media_type}));
    });
    saveCart(getCart().filter(x=>PRODUCTS.some(p=>p.id==x.id)));
  }catch(e){console.error("Catalog:",e);window.CATALOG_ERROR=e}
}

function productCard(p){
  const out=p.stock<=0;
  return `<article class="product-card${out?" is-out":""}"><a href="product.html?id=${p.id}">${productVisual(p)}</a>${out?"":`<button class="add" data-add="${p.id}" onclick="addToCart('${p.id}')" aria-label="add">+</button>`}<div class="product-info"><small class="cat">${CAT_AR[p.category]||p.category}</small><h3>${p.name}</h3><div class="price">${money(p.price)}${p.oldPrice?` <s>${money(p.oldPrice)}</s>`:""}${out?' <em class="sold">نفدت الكمية</em>':""}</div></div></article>`;
}

function initDetail(){
  const el=document.getElementById("productDetail");if(!el)return;
  const p=PRODUCTS.find(x=>x.id==new URLSearchParams(location.search).get("id"));
  if(!p){el.innerHTML='<div class="empty"><h2>المنتج غير متوفر</h2><a class="btn btn-dark" href="products.html">المتجر</a></div>';return}
  const m=MEDIA[p.id]||[];
  const show=x=>x?(x.type==="video"?`<video src="${x.url}" controls playsinline></video>`:`<img src="${x.url}" alt="${p.name}">`):`<div class="product-placeholder"><div><small>Anoxara </small><strong>${p.name}</strong></div></div>`;
  const out=p.stock<=0;
  el.innerHTML=`<div class="product-detail"><div class="gallery"><div class="detail-image has-image" id="mainMedia">${show(m[0])}</div>${m.length>1?`<div class="thumbs">${m.map((x,i)=>`<button type="button" class="thumb${i?"":" on"}" data-i="${i}">${x.type==="video"?"▶":`<img src="${x.url}" alt="">`}</button>`).join("")}</div>`:""}</div><div class="detail-info"><p class="eyebrow">${CAT_AR[p.category]||p.category}</p><h1>${p.name}</h1><div class="price">${money(p.price)}${p.oldPrice?` <s>${money(p.oldPrice)}</s>`:""}</div><p class="stock ${out?"no":"ok"}">${out?"نفدت الكمية":"متوفر"}</p><p class="description">${p.desc}</p><div class="qty"><button id="minus">−</button><b id="qty">1</b><button id="plus">+</button></div><button class="btn btn-dark" id="buy" ${out?"disabled":""}>أضيفي إلى الحقيبة</button></div></div>`;
  el.querySelectorAll(".thumb").forEach(b=>b.onclick=()=>{document.getElementById("mainMedia").innerHTML=show(m[b.dataset.i]);el.querySelectorAll(".thumb").forEach(x=>x.classList.toggle("on",x===b))});
  let q=1;const qel=document.getElementById("qty");
  document.getElementById("plus").onclick=()=>{q=Math.min(q+1,Math.max(p.stock,1));qel.textContent=q};
  document.getElementById("minus").onclick=()=>{q=Math.max(1,q-1);qel.textContent=q};
  document.getElementById("buy").onclick=()=>{addToCart(p.id,q);location.href="cart.html"};
}

async function initCheckout(){
  const f=document.getElementById("checkoutForm");if(!f)return;
  const w=document.getElementById("wilaya");
  const c=getCart();const sub=c.reduce((s,x)=>{const p=PRODUCTS.find(z=>z.id==x.id);return s+(p?p.price*x.qty:0)},0);
  let zones={};
  try{const d=await db();const {data,error}=await d.from("delivery_zones").select("*").eq("is_active",true).order("wilaya_code");if(error)throw error;
    (data||[]).forEach(z=>{zones[z.wilaya_code]=z;w.add(new Option(z.wilaya_code+" - "+z.wilaya_name_ar,z.wilaya_code))})}catch(e){console.warn(e)}
  const addr=document.getElementById("address-group"),ta=f.querySelector('[name="address"]');
  const method=()=>f.querySelector('[name="delivery_method"]:checked').value;
  function draw(){
    const z=zones[w.value],fee=z?Number(method()==="office"?z.office_fee:z.home_fee):0;
    addr.style.display=method()==="home"?"":"none";ta.required=method()==="home";
    document.querySelectorAll(".delivery-choice").forEach(l=>l.classList.toggle("selected",l.querySelector("input").checked));
    document.getElementById("checkoutSummary").innerHTML=`<h2>طلبك</h2>${c.map(x=>{const p=PRODUCTS.find(z=>z.id==x.id);return p?`<div class="summary-row"><span>${p.name} × ${x.qty}</span><b>${money(p.price*x.qty)}</b></div>`:""}).join("")}<div class="summary-row"><span>المجموع الفرعي</span><b>${money(sub)}</b></div><div class="summary-row"><span>التوصيل</span><b>${w.value?money(fee):"—"}</b></div><div class="summary-row summary-total"><span>الإجمالي</span><b>${money(sub+fee)}</b></div>`;
  }
  f.addEventListener("change",draw);draw();
  f.onsubmit=async e=>{
    e.preventDefault();if(!c.length){alert("السلة فارغة");return}
    const fd=Object.fromEntries(new FormData(f)),btn=f.querySelector('[type="submit"]');btn.disabled=true;
    try{
      const d=await db();
      const {data,error}=await d.rpc("create_order",{p_customer_name:fd.name,p_customer_email:fd.email||null,p_customer_phone:fd.phone,p_wilaya_code:fd.wilaya,p_delivery_method:fd.delivery_method,p_address:fd.delivery_method==="home"?(fd.address||null):null,p_notes:fd.notes||null,p_items:c.map(x=>({product_id:x.id,quantity:x.qty}))});
      if(error)throw error;
      localStorage.setItem("lastOrder",data.order_number);localStorage.removeItem("cart");location.href="order-success.html";
    }catch(err){console.error(err);alert("تعذر إرسال الطلب: "+(err.message||"حاولي مرة أخرى"));btn.disabled=false}
  };
}

document.addEventListener("DOMContentLoaded",async()=>{
  updateCartCount();initAccount();
  document.getElementById("menuBtn")?.addEventListener("click",()=>document.querySelector(".nav")?.classList.toggle("show"));
  await loadCatalog();
  initHome();initProductsPage();initDetail();initCart();initCheckout();initFx();
  document.querySelectorAll(".category-card[data-cat]").forEach(c=>{const p=PRODUCTS.find(x=>x.category===c.dataset.cat&&getProductImages()[x.id]);if(p)c.style.setProperty("--img",`url("${getProductImages()[p.id]}")`)});
  document.body.classList.add("ready");
});

window.addEventListener("scroll",()=>document.querySelector(".site-header")?.classList.toggle("compact",scrollY>40),{passive:true});
