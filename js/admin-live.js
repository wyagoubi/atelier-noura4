/* Atelier Noura — Owner Studio (Supabase: products, product_images, orders, delivery_zones) */
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const STATUS={new:"جديد",confirmed:"مؤكد",preparing:"قيد التحضير",shipped:"تم الشحن",delivered:"تم التسليم",cancelled:"ملغى"};
const head=(k,t,sub,extra="")=>`<div class="dash-head"><div><div class="dash-kicker">${k}</div><h1 class="dash-title">${t}</h1><p class="dash-subtitle">${sub}</p></div>${extra}</div>`;
const pubUrl=p=>OWNER_DB.storage.from("product-media").getPublicUrl(p).data.publicUrl;

async function adminRender(tab="overview"){
  const root=$("adminApp");if(!root)return;
  root.innerHTML='<div class="empty">...</div>';
  try{
    if(tab==="overview")return await tabOverview(root);
    if(tab==="products")return await tabProducts(root);
    if(tab==="orders")return await tabOrders(root);
    if(tab==="delivery")return await tabDelivery(root);
    if(tab==="media")return root.innerHTML=head("MEDIA","الوسائط","الصور والفيديو تُرفع لكل منتج من قسم المنتجات.");
    root.innerHTML=head("SETTINGS","الإعدادات","تم الدخول بحساب مالك موثّق عبر Supabase.");
  }catch(e){console.error(e);root.innerHTML=`<div class="empty">تعذر تحميل البيانات: ${esc(e.message)}</div>`}
}

async function tabOverview(root){
  const {data:o,error}=await OWNER_DB.from("orders").select("order_number,customer_name,total,status,created_at").order("created_at",{ascending:false});
  if(error)throw error;
  const valid=o.filter(x=>x.status!=="cancelled"),sum=valid.reduce((a,x)=>a+Number(x.total),0),n=o.filter(x=>x.status==="new").length;
  const {count}=await OWNER_DB.from("products").select("id",{count:"exact",head:true});
  root.innerHTML=head("ATELIER NOURA · OWNER","لوحة التحكم","أرقام حقيقية من الطلبات المسجلة.")+`<div class="stats"><div class="stat gold"><span>SALES</span><b>${money(sum)}</b><em>${valid.length} طلب</em></div><div class="stat"><span>ORDERS</span><b>${o.length}</b><em>${n} جديد</em></div><div class="stat"><span>AVERAGE</span><b>${money(valid.length?sum/valid.length:0)}</b><em>متوسط الطلب</em></div><div class="stat"><span>PRODUCTS</span><b>${count||0}</b><em>في الكتالوج</em></div></div><section class="dashboard-card" style="padding:20px;margin-top:18px"><h3>آخر الطلبات</h3>${o.length?`<table class="recent-orders"><tr><th>ORDER</th><th>CUSTOMER</th><th>TOTAL</th><th>STATUS</th></tr>${o.slice(0,6).map(x=>`<tr><td><span class="order-pill">${x.order_number}</span></td><td>${esc(x.customer_name)}</td><td>${money(x.total)}</td><td>${STATUS[x.status]||x.status}</td></tr>`).join("")}</table>`:'<div class="empty">لا توجد طلبات بعد.</div>'}</section>`;
}

async function tabProducts(root){
  const [{data:ps,error},{data:cats}]=await Promise.all([OWNER_DB.from("products").select("*,categories(name_ar),product_images(id,storage_path,media_type,sort_order)").order("created_at",{ascending:false}),OWNER_DB.from("categories").select("*").order("sort_order")]);
  if(error)throw error;
  window.__cats=cats;window.__ps=ps;
  root.innerHTML=head("CATALOG","المنتجات","كل ما تنشرينه هنا يظهر مباشرة للزبائن.",'<button class="admin-primary" id="addProd" type="button">+ منتج جديد</button>')+`<div class="dashboard-card" style="padding:20px"><div class="admin-product-list">${ps.length?ps.map(p=>{const im=p.product_images.find(m=>m.media_type!=="video");return `<div class="admin-product-row"><div class="admin-product-preview">${im?`<img src="${pubUrl(im.storage_path)}" alt="">`:"NO IMAGE"}</div><div class="admin-product-main"><strong>${esc(p.name_ar)} ${p.is_active?"":"· مخفي"}</strong><small>${p.categories?.name_ar||""} · ${money(p.price)} · مخزون ${p.stock} · ${p.product_images.length} وسائط</small><div class="admin-product-actions"><button class="admin-secondary" data-edit="${p.id}">تعديل</button><label class="upload-btn">إضافة صور/فيديو<input type="file" accept="image/*,video/*" multiple data-up="${p.id}"></label><button class="danger-btn" data-del="${p.id}">حذف</button></div></div></div>`}).join(""):'<div class="empty">لا توجد منتجات. أضيفي أول منتج.</div>'}</div></div>`;
  $("addProd").onclick=()=>openProd();
  root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProd(window.__ps.find(p=>p.id===b.dataset.edit)));
  root.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف المنتج؟"))return;const {error}=await OWNER_DB.from("products").delete().eq("id",b.dataset.del);if(error)alert(error.message);adminRender("products")});
  root.querySelectorAll("[data-up]").forEach(i=>i.onchange=async()=>{
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
}

function openProd(p){
  $("productModalTitle").textContent=p?"تعديل منتج":"إضافة منتج";
  $("categoryId").innerHTML=window.__cats.map(c=>`<option value="${c.id}">${c.name_ar}</option>`).join("");
  const set=(i,v)=>$(i).value=v??"";
  set("productId",p?.id);set("nameAr",p?.name_ar);set("nameFr",p?.name_fr);set("nameEn",p?.name_en);set("price",p?.price);set("stock",p?.stock??0);set("categoryId",p?.category_id||window.__cats[0]?.id);set("descAr",p?.description_ar);set("descFr",p?.description_fr);set("descEn",p?.description_en);
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

async function tabOrders(root){
  const {data,error}=await OWNER_DB.from("orders").select("*,order_items(*)").order("created_at",{ascending:false});
  if(error)throw error;
  root.innerHTML=head("ORDERS","الطلبات","الطلبات الحقيقية من الزبائن.")+`<div class="dashboard-card" style="padding:20px">${data.length?data.map(o=>`<div class="admin-product-row" style="grid-template-columns:1fr"><div><strong><span class="order-pill">${o.order_number}</span> ${esc(o.customer_name)} · <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></strong><small style="display:block;margin:6px 0">${esc(o.wilaya_name)} · ${o.delivery_method==="office"?"مكتب التوصيل":"المنزل: "+esc(o.address)}${o.customer_email?" · "+esc(o.customer_email):""}${o.notes?"<br>ملاحظة: "+esc(o.notes):""}</small><div>${o.order_items.map(i=>`${esc(i.product_name)} × ${i.quantity}`).join(" · ")}</div><div style="margin-top:8px"><b>${money(o.subtotal)} + ${money(o.delivery_fee)} = ${money(o.total)}</b> <select data-st="${o.id}" style="width:auto">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v}</option>`).join("")}</select> <small>${new Date(o.created_at).toLocaleString("ar-DZ")}</small></div></div></div>`).join(""):'<div class="empty">لا توجد طلبات بعد.</div>'}</div>`;
  root.querySelectorAll("[data-st]").forEach(s=>s.onchange=async()=>{const {error}=await OWNER_DB.from("orders").update({status:s.value}).eq("id",s.dataset.st);if(error)alert(error.message)});
}

async function tabDelivery(root){
  const {data,error}=await OWNER_DB.from("delivery_zones").select("*").order("wilaya_code");
  if(error)throw error;
  root.innerHTML=head("DELIVERY","التوصيل","سعر التوصيل لكل ولاية (DA). يُحفظ تلقائيًا عند التعديل.")+`<div class="dashboard-card" style="padding:20px"><table class="recent-orders"><tr><th>الولاية</th><th>المنزل</th><th>المكتب</th></tr>${data.map(z=>`<tr data-id="${z.id}"><td>${z.wilaya_code} - ${esc(z.wilaya_name_ar)}</td><td><input type="number" min="0" data-f="home_fee" value="${z.home_fee}"></td><td><input type="number" min="0" data-f="office_fee" value="${z.office_fee}"></td></tr>`).join("")}</table></div>`;
  root.querySelectorAll("tr[data-id]").forEach(tr=>tr.addEventListener("change",async()=>{const v=f=>Number(tr.querySelector(`[data-f=${f}]`).value||0);const {error}=await OWNER_DB.from("delivery_zones").update({home_fee:v("home_fee"),office_fee:v("office_fee")}).eq("id",tr.dataset.id);if(error)alert(error.message)}));
}
