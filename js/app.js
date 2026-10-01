const PRODUCTS = [
  {id:1,name:"Noura Tote",category:"bags",price:4800,desc:"حقيبة يومية مصنوعة يدويًا بتفاصيل ناعمة."},
  {id:2,name:"Lina Mini",category:"bags",price:3600,desc:"حقيبة صغيرة وخفيفة للمشاوير اليومية."},
  {id:3,name:"Sahara Skirt",category:"skirts",price:6200,desc:"تنورة بقصة هادئة ولمسة أنيقة."},
  {id:4,name:"Noura Scarf",category:"accessories",price:2200,desc:"إكسسوار بسيط لإكمال الإطلالة."},
  {id:5,name:"Atelier Pouch",category:"accessories",price:2800,desc:"حافظة متعددة الاستخدامات."},
  {id:6,name:"Dune Skirt",category:"skirts",price:5900,desc:"تصميم مريح مستوحى من الألوان الترابية."}
];

const WILAYAS=["أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة","سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غليزان","تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"];

const money=n=>new Intl.NumberFormat("fr-DZ").format(n)+" DA";
const getCart=()=>JSON.parse(localStorage.getItem("cart")||"[]");
const saveCart=c=>{localStorage.setItem("cart",JSON.stringify(c));updateCartCount()};
const getProductImages=()=>JSON.parse(localStorage.getItem("productImages")||"{}");
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
    ? `<div class="product-image ${extraClass}"><img src="${src}" alt="${p.name}" loading="lazy"><span class="product-number">0${p.id}</span></div>`
    : `<div class="product-image ${extraClass} product-placeholder"><span class="product-number">0${p.id}</span><div><small>ATELIER NOURA</small><strong>${p.name}</strong></div></div>`;
}

function productCard(p){
  return `<article class="product-card"><a href="product.html?id=${p.id}">${productVisual(p)}</a><button class="add" data-add="${p.id}" onclick="addToCart(${p.id})">+</button><div class="product-info"><h3>${p.name}</h3><p>${p.desc}</p><div class="price">${money(p.price)}</div></div></article>`;
}

function renderProducts(list=PRODUCTS,target="productsGrid"){
  const el=document.getElementById(target); if(el)el.innerHTML=list.map(productCard).join("");
}

function renderNewArrivals(){
  const grid=document.getElementById("newArrivalsGrid"); if(!grid)return;
  const images=getProductImages();
  const items=PRODUCTS.slice(0,3);
  grid.innerHTML=items.map((p,i)=>`<a class="floating-product fp-${i+1}" href="product.html?id=${p.id}">
    <div class="floating-product-image">${images[p.id]?`<img src="${images[p.id]}" alt="${p.name}" loading="eager">`:`<div class="floating-placeholder"><span>0${p.id}</span><b>${p.name}</b></div>`}</div>
    <div class="floating-product-meta"><span>${i===0?"NEW ARRIVAL":i===1?"JUST IN":"HANDMADE"}</span><strong>${p.name}</strong><small>${money(p.price)}</small></div>
  </a>`).join("");
}

function initProductsPage(){
  let current=new URLSearchParams(location.search).get("category")||"all";
  const grid=document.getElementById("productsGrid"); if(!grid)return;
  function refresh(){
    let a=current==="all"?PRODUCTS:[...PRODUCTS.filter(p=>p.category===current)];
    const s=document.getElementById("sort")?.value;
    if(s==="low")a.sort((x,y)=>x.price-y.price);
    if(s==="high")a.sort((x,y)=>y.price-x.price);
    renderProducts(a);
  }
  document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{
    current=b.dataset.cat;
    document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); refresh();
  }));
  document.getElementById("sort")?.addEventListener("change",refresh);
  const f=document.querySelector(`[data-cat="${current}"]`); if(f)f.classList.add("active");
  refresh();
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
      if(window.supabase?.auth){
        const {data}=await window.__ATELIER_NOURA_SUPABASE__?.auth.getSession?.() || {data:null};
        const user=data?.session?.user;
        if(user?.email && accountName){
          accountName.textContent=user.email.split("@")[0];
        }
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
    if(!email || !password)return;

    if(message)message.textContent="جاري التحقق من بيانات المالك...";
    if(submit){submit.disabled=true;submit.textContent="جاري الدخول...";}

    try{
      if(typeof loadScript!=="function")throw new Error("تعذر تحميل Supabase.");
      if(!window.supabase?.createClient)await loadScript(SUPABASE_CDN);
      if(typeof initSupabase!=="function")await loadScript("js/supabase.js");
      const db=await initSupabase();

      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error("تعذر إنشاء جلسة الدخول.");

      const {data:profile,error:profileError}=await db
        .from("profiles")
        .select("role")
        .eq("id",data.user.id)
        .maybeSingle();

      if(profileError)throw profileError;

      if(profile?.role!=="owner"){
        await db.auth.signOut();
        throw new Error("هذا الحساب ليس حساب مالك Atelier Noura.");
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
  const visual=images[p.id]?`<div class="detail-image has-image"><img src="${images[p.id]}" alt="${p.name}"></div>`:`<div class="detail-image product-placeholder"><div><small>ATELIER NOURA</small><strong>NO.0${p.id}</strong></div></div>`;
  el.innerHTML=`<div class="product-detail"><div>${visual}</div><div class="detail-info"><p class="eyebrow">${p.category.toUpperCase()}</p><h1>${p.name}</h1><div class="price">${money(p.price)}</div><p class="description">${p.desc}<br><br>قطعة مصنوعة بعناية، وقد تختلف التفاصيل قليلًا لأن كل قطعة لها طابعها الخاص.</p><div class="qty"><button id="minus">−</button><b id="qty">1</b><button id="plus">+</button></div><button class="btn btn-dark" id="buy">أضيفي إلى الحقيبة</button></div></div>`;
  let q=1;const qel=document.getElementById("qty");
  document.getElementById("plus").onclick=()=>{q++;qel.textContent=q};
  document.getElementById("minus").onclick=()=>{q=Math.max(1,q-1);qel.textContent=q};
  document.getElementById("buy").onclick=()=>{addToCart(p.id,q);location.href="cart.html"};
}

function initCart(){
  const el=document.getElementById("cartView");if(!el)return;
  const c=getCart();
  if(!c.length){el.innerHTML='<div class="empty"><h2>حقيبتك فارغة</h2><p>اكتشفي قطع Atelier Noura.</p><a class="btn btn-dark" href="products.html">المتجر</a></div>';return}
  let total=0;
  const rows=c.map(x=>{const p=PRODUCTS.find(z=>z.id==x.id);total+=p.price*x.qty;return `<div class="cart-item"><div class="cart-thumb">${getProductImages()[p.id]?`<img src="${getProductImages()[p.id]}" alt="${p.name}">`:""}</div><div><h3>${p.name}</h3><p>${x.qty} × ${money(p.price)}</p></div><div><b>${money(p.price*x.qty)}</b><button class="remove" onclick="removeCart(${p.id})">حذف</button></div></div>`}).join("");
  el.innerHTML=`<div class="cart-layout"><div>${rows}</div><aside class="summary-card"><h2>ملخص الطلب</h2><div class="summary-row"><span>المنتجات</span><b>${money(total)}</b></div><div class="summary-row"><span>التوصيل</span><span>يحسب حسب الولاية</span></div><div class="summary-row summary-total"><span>الإجمالي</span><b>${money(total)}</b></div><a class="btn btn-dark full" href="checkout.html">متابعة الطلب</a></aside></div>`;
}
function removeCart(id){saveCart(getCart().filter(x=>x.id!=id));initCart()}

function initCheckout(){
  const f=document.getElementById("checkoutForm");if(!f)return;
  const w=document.getElementById("wilaya");WILAYAS.forEach(x=>w.add(new Option(x,x)));
  const c=getCart();let total=c.reduce((s,x)=>{const p=PRODUCTS.find(z=>z.id==x.id);return s+p.price*x.qty},0);
  document.getElementById("checkoutSummary").innerHTML=`<h2>طلبك</h2>${c.map(x=>{const p=PRODUCTS.find(z=>z.id==x.id);return `<div class="summary-row"><span>${p.name} × ${x.qty}</span><b>${money(p.price*x.qty)}</b></div>`}).join("")}<div class="summary-row summary-total"><span>Subtotal</span><b>${money(total)}</b></div><p class="form-note">سيتم تحديد Delivery Fee حسب الولاية عند تفعيل Supabase.</p>`;
  f.onsubmit=e=>{e.preventDefault();if(!c.length){alert("السلة فارغة");return}const data=Object.fromEntries(new FormData(f));const no="AN-"+Date.now().toString().slice(-6);localStorage.setItem("lastOrder",no);localStorage.setItem("demoOrder",JSON.stringify({no,data,items:c,total}));localStorage.removeItem("cart");location.href="order-success.html"};
}

document.addEventListener("DOMContentLoaded",()=>{
  updateCartCount();initHome();initProductsPage();initDetail();initCart();initCheckout();initAccount();
  document.getElementById("menuBtn")?.addEventListener("click",()=>document.querySelector(".nav")?.classList.toggle("show"));
});
