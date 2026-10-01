const BUCKET = "product-media";

let db = null;

let categories = [];

let products = [];

let currentTab = "overview";


const $ = id =>
  document.getElementById(id);



function configured(){

  return typeof isSupabaseConfigured === "function"
    && isSupabaseConfigured();

}



function money(value){

  return new Intl.NumberFormat("fr-DZ")
    .format(Number(value || 0))
    + " DA";

}



function escapeHtml(value = ""){

  return String(value).replace(
    /[&<>'"]/g,

    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      '"':"&quot;"
    }[c])
  );

}



function message(el,text,error=false){

  if(!el) return;

  el.textContent = text || "";

  el.classList.toggle(
    "show",
    Boolean(text)
  );

  el.style.background =
    error
      ? "#f9e6e6"
      : "#f5eee8";

  el.style.color =
    error
      ? "#8d2525"
      : "#5e5148";

}



async function getSession(){

  const {
    data,
    error
  } = await db.auth.getSession();

  if(error) throw error;

  return data.session;

}



async function ensureOwner(){

  const session =
    await getSession();


  if(!session) {
    return false;
  }


  const {
    data,
    error
  } = await db
    .from("profiles")
    .select("role,full_name")
    .eq("id",session.user.id)
    .maybeSingle();


  if(error) throw error;


  return data?.role === "owner";

}



async function showDashboard(){

  $("loginView").style.display =
    "none";


  $("dashboardView").style.display =
    "grid";


  $("logoutBtn").style.display =
    "inline-block";


  const session =
    await getSession();


  $("ownerEmail").textContent =
    session?.user?.email || "";


  await loadBaseData();


  await renderTab("overview");

}



function showLogin(){

  $("loginView").style.display =
    "block";


  $("dashboardView").style.display =
    "none";


  $("logoutBtn").style.display =
    "none";


  $("ownerEmail").textContent =
    "";

}



async function loadBaseData(){

  const [
    catRes,
    productRes
  ] = await Promise.all([

    db
      .from("categories")
      .select("*")
      .order("id"),

    db
      .from("products")
      .select("*,categories(*)")
      .order(
        "created_at",
        {ascending:false}
      )

  ]);


  if(catRes.error)
    throw catRes.error;


  if(productRes.error)
    throw productRes.error;


  categories =
    catRes.data || [];


  products =
    productRes.data || [];

}



function productImage(product){

  const image =
    product.product_images?.find(
      x => x.is_cover
    )
    ||
    product.product_images?.[0];


  if(!image){

    return `
      <div class="admin-thumb">
        NO IMAGE
      </div>
    `;

  }


  const url =
    db
      .storage
      .from(BUCKET)
      .getPublicUrl(
        image.storage_path
      )
      .data
      .publicUrl;


  return `

    <div class="admin-thumb">

      <img
        src="${url}"
        alt="${escapeHtml(
          product.name_en ||
          product.name_ar
        )}"
      >

    </div>

  `;

}



async function refreshProducts(){

  const {
    data,
    error
  } = await db

    .from("products")

    .select(
      "*,categories(*),product_images(*)"
    )

    .order(
      "created_at",
      {ascending:false}
    );


  if(error)
    throw error;


  products =
    data || [];

}



async function renderTab(tab){

  currentTab = tab;


  const root =
    $("adminApp");


  root.innerHTML = `

    <div class="empty-admin">

      جاري التحميل...

    </div>

  `;


  try{

    if(tab === "overview")
      await renderOverview(root);


    if(tab === "products")
      await renderProducts(root);


    if(tab === "orders")
      await renderOrders(root);


    if(tab === "delivery")
      await renderDelivery(root);


    if(tab === "media")
      await renderMedia(root);


    if(tab === "settings")
      await renderSettings(root);


  }catch(error){

    root.innerHTML = `

      <div class="admin-card">

        <h2>
          حدث خطأ
        </h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>

    `;

  }

}



async function renderOverview(root){

  const [
    orderResult,
    newOrderResult
  ] = await Promise.all([
    db
      .from("orders")
      .select("id,total,status,created_at,customer_name,wilaya,delivery_method")
      .order("created_at", {ascending:false}),
    db
      .from("orders")
      .select("id", {count:"exact", head:true})
      .eq("status", "new")
  ]);

  if(orderResult.error)
    throw orderResult.error;

  if(newOrderResult.error)
    throw newOrderResult.error;

  const orders = orderResult.data || [];
  const activeOrders = orders.filter(o => String(o.status || "").toLowerCase() !== "cancelled");
  const revenue = activeOrders.reduce((sum,o) => sum + Number(o.total || 0), 0);
  const average = activeOrders.length ? revenue / activeOrders.length : 0;
  const cancelled = orders.filter(o => String(o.status || "").toLowerCase() === "cancelled").length;

  const months = [];
  const now = new Date();
  for(let i = 5; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("fr-DZ", {month:"short"}),
      value: 0
    });
  }

  orders.forEach(order => {
    if(String(order.status || "").toLowerCase() === "cancelled") return;
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const month = months.find(m => m.key === key);
    if(month) month.value += Number(order.total || 0);
  });

  const maxMonth = Math.max(...months.map(m => m.value), 1);
  const recentOrders = orders.slice(0,5);

  root.innerHTML = `
    <div class="admin-toolbar">
      <div>
        <span class="eyebrow">ATELIER NOURA · OWNER</span>
        <h1 class="dash-title">نظرة عامة</h1>
        <p class="dashboard-subtitle">لوحة متابعة حقيقية للطلبات والمبيعات والمخزون.</p>
      </div>
      <div class="admin-toolbar-actions">
        <span class="dashboard-live"><i></i> LIVE DATA</span>
        <button class="admin-primary" data-open-product>+ إضافة منتج</button>
      </div>
    </div>

    <div class="stats luxury-stats">
      <div class="stat stat-revenue"><span>إجمالي المبيعات</span><b>${money(revenue)}</b><small>${activeOrders.length} طلب محسوب</small></div>
      <div class="stat"><span>الطلبات</span><b>${orders.length}</b><small>${newOrderResult.count || 0} طلب جديد</small></div>
      <div class="stat"><span>متوسط الطلب</span><b>${money(average)}</b><small>Average order value</small></div>
      <div class="stat"><span>المنتجات النشطة</span><b>${products.filter(p => p.is_active).length}</b><small>${products.length} إجمالي المنتجات</small></div>
    </div>

    <div class="owner-dashboard-grid">
      <section class="admin-card sales-panel">
        <div class="panel-head"><div><span class="eyebrow">PERFORMANCE</span><h2>المبيعات</h2></div><span class="panel-caption">آخر 6 أشهر</span></div>
        <div class="sales-bars">
          ${months.map(m => `<div class="sales-bar-column"><span>${m.value ? money(m.value) : "—"}</span><div class="sales-bar-track"><i style="height:${Math.max(8, (m.value/maxMonth)*100)}%"></i></div><small>${escapeHtml(m.label)}</small></div>`).join("")}
        </div>
      </section>

      <section class="admin-card status-panel">
        <div class="panel-head"><div><span class="eyebrow">ORDERS</span><h2>حالة الطلبات</h2></div></div>
        <div class="status-summary">
          <div><strong>${newOrderResult.count || 0}</strong><span>جديد</span></div>
          <div><strong>${orders.filter(o => String(o.status).toLowerCase() === "delivered").length}</strong><span>تم التسليم</span></div>
          <div><strong>${cancelled}</strong><span>ملغى</span></div>
        </div>
        <div class="profit-note"><b>الأرباح الصافية</b><strong>—</strong><span>لا نحسب Profit وهميًا. نحتاج تكلفة تصنيع/شراء لكل منتج حتى يكون صافي الربح دقيقًا.</span></div>
      </section>
    </div>

    <div class="owner-dashboard-grid lower">
      <section class="admin-card">
        <div class="panel-head"><div><span class="eyebrow">RECENT ACTIVITY</span><h2>آخر الطلبات</h2></div><button class="admin-secondary" data-tab-go="orders">كل الطلبات</button></div>
        <div class="recent-order-list">
          ${recentOrders.length ? recentOrders.map(o => `
            <div class="recent-order-row">
              <div class="recent-order-avatar">AN</div>
              <div><strong>${escapeHtml(o.customer_name || "زبون")}</strong><small>${escapeHtml(o.wilaya || "—")} · ${escapeHtml(o.order_number || String(o.id).slice(0,8))}</small></div>
              <b>${money(o.total)}</b>
            </div>
          `).join("") : `<div class="empty-admin">لا توجد طلبات بعد.</div>`}
        </div>
      </section>

      <section class="admin-card owner-actions-card">
        <div class="panel-head"><div><span class="eyebrow">QUICK ACCESS</span><h2>إدارة المتجر</h2></div></div>
        <button class="quick-admin-link" data-tab-go="products"><span>◇</span><div><b>المنتجات والمخزون</b><small>تعديل الأسعار والكميات والصور</small></div><i>←</i></button>
        <button class="quick-admin-link" data-tab-go="orders"><span>◌</span><div><b>الطلبات</b><small>متابعة العملاء وتحديث الحالة</small></div><i>←</i></button>
        <button class="quick-admin-link" data-tab-go="delivery"><span>⌁</span><div><b>التوصيل</b><small>أسعار المنزل ومكاتب التوصيل</small></div><i>←</i></button>
      </section>
    </div>
  `;

  bindInlineActions();
}


async function renderProducts(root){

  await refreshProducts();


  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          CATALOG
        </span>

        <h1 class="dash-title">
          Products
        </h1>

      </div>


      <div class="admin-toolbar-actions">

        <button
          class="admin-primary"
          data-open-product
        >
          + إضافة منتج
        </button>

      </div>

    </div>


    <div class="admin-card">


      <div
        class="admin-grid"
        style="margin-bottom:18px"
      >

        <input
          class="admin-search"
          id="productSearch"
          placeholder="ابحث عن منتج..."
        >

        <div></div>

      </div>


      <div id="productAdminList">

        ${
          products.length

          ?

          products
            .map(productRow)
            .join("")

          :

          `

          <div class="empty-admin">

            لا توجد منتجات.
            أضف أول منتج.

          </div>

          `
        }

      </div>

    </div>

  `;


  bindInlineActions();


  $("productSearch")
    ?.addEventListener(
      "input",
      e => {

        const q =
          e.target.value
            .trim()
            .toLowerCase();


        document
          .querySelectorAll(
            "[data-product-row]"
          )
          .forEach(row => {

            row.style.display =
              row.dataset.search
                .includes(q)

              ? "grid"

              : "none";

          });

      }
    );

}



function productRow(p){

  const cat =
    p.categories?.name_ar
    ||
    p.category_id
    ||
    "—";


  return `

    <div
      class="product-admin-row"
      data-product-row
      data-search="${escapeHtml(
        [
          p.name_ar,
          p.name_fr,
          p.name_en,
          cat
        ]
        .join(" ")
        .toLowerCase()
      )}"
    >


      ${productImage(p)}


      <div class="admin-meta">

        <strong>

          ${escapeHtml(
            p.name_ar ||
            p.name_en
          )}

        </strong>


        <small>

          ${escapeHtml(cat)}

          ·

          ${money(p.price)}

          ·

          Stock: ${p.stock}

          ·

          ${
            p.is_active
              ? "ظاهر"
              : "مخفي"
          }

        </small>

      </div>


      <div class="admin-actions">


        <label class="upload-label">

          صورة

          <input
            type="file"
            accept="image/*"
            data-upload-image="${p.id}"
          >

        </label>


        <button
          data-edit-product="${p.id}"
        >
          تعديل
        </button>


        <button
          data-delete-product="${p.id}"
        >
          حذف
        </button>


      </div>

    </div>

  `;

}



async function renderOrders(root){

  const {
    data,
    error
  } = await db

    .from("orders")

    .select(
      "*,order_items(*,products(name_ar,name_en))"
    )

    .order(
      "created_at",
      {ascending:false}
    );


  if(error)
    throw error;


  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          CUSTOMER ORDERS
        </span>

        <h1 class="dash-title">
          Orders
        </h1>

      </div>


      <button
        class="admin-secondary"
        data-refresh-orders
      >
        تحديث
      </button>

    </div>


    <div class="admin-card">

      <div class="admin-table-wrap">

        <table class="admin-table">

          <thead>

            <tr>

              <th>
                الطلب
              </th>

              <th>
                الزبون
              </th>

              <th>
                التوصيل
              </th>

              <th>
                المحتوى
              </th>

              <th>
                الإجمالي
              </th>

              <th>
                الحالة
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              data?.length

              ?

              data
                .map(orderRow)
                .join("")

              :

              `

              <tr>

                <td colspan="6">

                  <div class="empty-admin">

                    لا توجد طلبات بعد.

                  </div>

                </td>

              </tr>

              `
            }

          </tbody>

        </table>

      </div>

    </div>

  `;


  document
    .querySelectorAll(
      "[data-order-status]"
    )
    .forEach(select => {

      select.addEventListener(
        "change",
        async e => {

          const id =
            e.target.dataset.orderStatus;


          const status =
            e.target.value;


          const {
            error
          } = await db

            .from("orders")

            .update({status})

            .eq("id",id);


          if(error)
            alert(error.message);

        }
      );

    });


  $(
    "refresh-orders"
  )
    ?.addEventListener(
      "click",
      () => renderTab("orders")
    );

}



function orderRow(o){

  const items =
    (o.order_items || [])
      .map(
        i =>
          `${escapeHtml(
            i.products?.name_ar ||
            i.products?.name_en ||
            "Product"
          )} × ${i.quantity}`
      )
      .join("<br>");


  const method =
    o.delivery_method === "home"

      ? "توصيل للمنزل"

      : "مكتب التوصيل";


  return `

    <tr>


      <td>

        <strong>
          ${escapeHtml(
            o.order_number
          )}
        </strong>

        <br>

        <small>
          ${
            new Date(
              o.created_at
            ).toLocaleString("fr-DZ")
          }
        </small>

      </td>


      <td>

        <strong>
          ${escapeHtml(
            o.customer_name
          )}
        </strong>

        <br>

        ${escapeHtml(o.phone)}

        <br>

        <small>
          ${escapeHtml(
            o.notes || ""
          )}
        </small>

      </td>


      <td>

        ${escapeHtml(
          o.wilaya
        )}

        <br>

        ${method}

        <br>

        <small>
          ${escapeHtml(
            o.address || "—"
          )}
        </small>

      </td>


      <td>

        ${items}

      </td>


      <td>

        ${money(o.total)}

        <br>

        <small>

          المنتجات:
          ${money(o.subtotal)}

          <br>

          التوصيل:
          ${money(o.delivery_fee)}

        </small>

      </td>


      <td>

        <select
          class="status-select"
          data-order-status="${o.id}"
        >

          ${
            [
              "new",
              "confirmed",
              "preparing",
              "shipped",
              "delivered",
              "cancelled"
            ]
              .map(
                s => `

                  <option
                    value="${s}"
                    ${
                      o.status === s
                        ? "selected"
                        : ""
                    }
                  >
                    ${s}
                  </option>

                `
              )
              .join("")
          }

        </select>

      </td>

    </tr>

  `;

}



async function renderDelivery(root){

  const {
    data,
    error
  } = await db

    .from("delivery_zones")

    .select("*")

    .order("wilaya");


  if(error)
    throw error;


  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          DELIVERY
        </span>

        <h1 class="dash-title">
          Delivery Zones
        </h1>

      </div>


      <button
        class="admin-primary"
        id="saveDelivery"
      >
        حفظ الأسعار
      </button>

    </div>


    <div class="admin-card">

      <p>

        ضع سعر التوصيل لكل ولاية.
        يمكن أن يكون سعر Home
        مختلفًا عن Office.

      </p>


      <div class="admin-table-wrap">

        <table class="admin-table">

          <thead>

            <tr>

              <th>
                Wilaya
              </th>

              <th>
                Home
              </th>

              <th>
                Office
              </th>

              <th>
                Active
              </th>

            </tr>

          </thead>


          <tbody>

            ${

              data

                .map(
                  z => `

                    <tr>

                      <td>
                        ${escapeHtml(
                          z.wilaya
                        )}
                      </td>


                      <td>

                        <input
                          class="delivery-input"
                          data-id="${z.id}"
                          data-field="home_fee"
                          type="number"
                          min="0"
                          value="${z.home_fee}"
                        >

                      </td>


                      <td>

                        <input
                          class="delivery-input"
                          data-id="${z.id}"
                          data-field="office_fee"
                          type="number"
                          min="0"
                          value="${z.office_fee}"
                        >

                      </td>


                      <td>

                        <input
                          class="delivery-active"
                          data-id="${z.id}"
                          type="checkbox"
                          ${
                            z.is_active
                              ? "checked"
                              : ""
                          }
                        >

                      </td>

                    </tr>

                  `
                )

                .join("")

            }

          </tbody>

        </table>

      </div>

    </div>

  `;


  $("saveDelivery").onclick =
    async () => {

      const updates =
        [
          ...document
            .querySelectorAll(
              ".delivery-input"
            )
        ]

        .reduce(
          (a,input) => {

            const id =
              input.dataset.id;


            a[id] ??= {
              id:Number(id)
            };


            a[id][
              input.dataset.field
            ] =
              Number(
                input.value || 0
              );


            return a;

          },
          {}
        );


      const active =
        [
          ...document
            .querySelectorAll(
              ".delivery-active"
            )
        ];


      for(
        const item
        of Object.values(updates)
      ){

        const checkbox =
          active.find(
            x =>
              x.dataset.id ===
              String(item.id)
          );


        item.is_active =
          !!checkbox?.checked;


        const {
          error
        } =
          await db

            .from("delivery_zones")

            .update(item)

            .eq(
              "id",
              item.id
            );


        if(error){

          alert(
            error.message
          );

          return;

        }

      }


      alert(
        "تم حفظ أسعار التوصيل"
      );

    };

}



async function renderMedia(root){

  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          MEDIA
        </span>

        <h1 class="dash-title">
          Media Studio
        </h1>

      </div>

    </div>


    <div class="admin-card">

      <h3>
        صور وفيديوهات المنتجات
      </h3>


      <p>

        ارفع الصور من داخل كل منتج
        في قسم Products.

      </p>


      <button
        class="admin-primary"
        data-tab-go="products"
      >
        إدارة صور المنتجات
      </button>

    </div>

  `;


  bindInlineActions();

}



async function renderSettings(root){

  const session =
    await getSession();


  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          ACCOUNT
        </span>

        <h1 class="dash-title">
          Settings
        </h1>

      </div>

    </div>


    <div class="admin-card">

      <h3>
        Owner account
      </h3>


      <p>

        ${escapeHtml(
          session?.user?.email || ""
        )}

      </p>


      <p>

        صلاحية المالك محفوظة
        في Supabase عبر جدول
        profiles و RLS.

      </p>


      <p>

        لا تضع service_role key
        في المتصفح.

      </p>

    </div>

  `;

}



function bindInlineActions(){

  document
    .querySelectorAll(
      "[data-open-product]"
    )
    .forEach(
      b =>
        b.onclick =
          () => openProductModal()
    );


  document
    .querySelectorAll(
      "[data-tab-go]"
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            renderTab(
              b.dataset.tabGo
            )
    );


  document
    .querySelectorAll(
      "[data-edit-product]"
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            openProductModal(
              Number(
                b.dataset.editProduct
              )
            )
    );


  document
    .querySelectorAll(
      "[data-delete-product]"
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            deleteProduct(
              Number(
                b.dataset.deleteProduct
              )
            )
    );


  document
    .querySelectorAll(
      "[data-upload-image]"
    )
    .forEach(
      input =>
        input.addEventListener(
          "change",
          e =>
            uploadCover(
              Number(
                e.target.dataset
                  .uploadImage
              ),
              e.target.files[0]
            )
        )
    );

}



function openProductModal(id=null){

  const p =
    id
      ? products.find(
          x => x.id === id
        )
      : null;


  $("productModalTitle")
    .textContent =
      p
        ? "تعديل المنتج"
        : "إضافة منتج";


  $("productId").value =
    p?.id || "";


  $("nameAr").value =
    p?.name_ar || "";


  $("nameFr").value =
    p?.name_fr || "";


  $("nameEn").value =
    p?.name_en || "";


  $("price").value =
    p?.price || 0;


  $("stock").value =
    p?.stock || 0;


  $("descAr").value =
    p?.description_ar || "";


  $("descFr").value =
    p?.description_fr || "";


  $("descEn").value =
    p?.description_en || "";


  $("featured").checked =
    !!p?.is_featured;


  $("active").checked =
    p
      ? !!p.is_active
      : true;


  $("categoryId").innerHTML =
    categories
      .map(
        c => `

          <option
            value="${c.id}"
            ${
              p?.category_id === c.id
                ? "selected"
                : ""
            }
          >

            ${escapeHtml(
              c.name_ar
            )}

          </option>

        `
      )
      .join("");


  message(
    $("productMessage"),
    ""
  );


  $("productModal")
    .classList
    .add("open");

}



function closeProductModal(){

  $("productModal")
    .classList
    .remove("open");

}



async function saveProduct(e){

  e.preventDefault();


  const id =
    $("productId").value;


  const payload = {

    category_id:
      Number(
        $("categoryId").value
      ),

    name_ar:
      $("nameAr")
        .value
        .trim(),

    name_fr:
      $("nameFr")
        .value
        .trim()
      ||
      $("nameAr")
        .value
        .trim(),

    name_en:
      $("nameEn")
        .value
        .trim()
      ||
      $("nameAr")
        .value
        .trim(),

    description_ar:
      $("descAr")
        .value
        .trim(),

    description_fr:
      $("descFr")
        .value
        .trim(),

    description_en:
      $("descEn")
        .value
        .trim(),

    price:
      Number(
        $("price").value
      ),

    stock:
      Number(
        $("stock").value
      ),

    is_featured:
      $("featured").checked,

    is_active:
      $("active").checked

  };


  if(
    !payload.name_ar ||
    payload.price < 0
  ){

    message(
      $("productMessage"),
      "أكمل اسم المنتج والسعر بشكل صحيح.",
      true
    );

    return;

  }


  const query =
    id

      ?

      db
        .from("products")
        .update(payload)
        .eq("id",id)
        .select()
        .single()

      :

      db
        .from("products")
        .insert(payload)
        .select()
        .single();


  const {
    data,
    error
  } =
    await query;


  if(error){

    message(
      $("productMessage"),
      error.message,
      true
    );

    return;

  }


  closeProductModal();


  await renderTab(
    "products"
  );

}



async function deleteProduct(id){

  if(
    !confirm(
      "هل تريد حذف هذا المنتج؟ سيتم حذف صوره المرتبطة أيضًا."
    )
  ){

    return;

  }


  const {
    error
  } =
    await db
      .from("products")
      .delete()
      .eq("id",id);


  if(error){

    alert(
      error.message
    );

    return;

  }


  await renderTab(
    "products"
  );

}



async function uploadCover(
  productId,
  file
){

  if(!file)
    return;


  if(
    !file.type.startsWith(
      "image/"
    )
  ){

    alert(
      "اختَر صورة فقط."
    );

    return;

  }


  const safe =
    file.name
      .toLowerCase()
      .replace(
        /[^a-z0-9.\-_]+/g,
        "-"
      );


  const path =
    `products/${productId}/${crypto.randomUUID()}-${safe}`;


  const upload =
    await db
      .storage
      .from(BUCKET)
      .upload(
        path,
        file,
        {
          upsert:false,
          contentType:file.type
        }
      );


  if(upload.error){

    alert(
      upload.error.message
    );

    return;

  }


  const existing =
    await db
      .from("product_images")
      .select(
        "id,storage_path"
      )
      .eq(
        "product_id",
        productId
      );


  if(existing.error){

    alert(
      existing.error.message
    );

    return;

  }


  if(existing.data?.length){

    const paths =
      existing.data.map(
        x => x.storage_path
      );


    await db
      .storage
      .from(BUCKET)
      .remove(paths);


    await db
      .from("product_images")
      .delete()
      .eq(
        "product_id",
        productId
      );

  }


  const {
    error
  } =
    await db
      .from("product_images")
      .insert({

        product_id:
          productId,

        storage_path:
          path,

        is_cover:
          true,

        sort_order:
          0

      });


  if(error){

    await db
      .storage
      .from(BUCKET)
      .remove([path]);


    alert(
      error.message
    );

    return;

  }


  await renderTab(
    "products"
  );

}



async function login(e){

  e.preventDefault();


  message(
    $("loginMessage"),
    ""
  );


  try{

    const {
      data,
      error
    } =
      await db.auth
        .signInWithPassword({

          email:
            $("loginEmail")
              .value
              .trim(),

          password:
            $("loginPassword")
              .value

        });


    if(error)
      throw error;


    const owner =
      await ensureOwner();


    if(!owner){

      await db.auth
        .signOut();


      throw new Error(
        "هذا الحساب ليس حساب مالك Atelier Noura."
      );

    }


    await showDashboard();


  }catch(err){

    message(
      $("loginMessage"),
      err.message,
      true
    );

  }

}



async function logout(){

  await db.auth.signOut();

  showLogin();

}



async function boot(){

  if(!configured()){

    message(
      $("loginMessage"),
      "لم يتم ربط Supabase بعد. افتح js/supabase.js وضع URL و anon/publishable key للمشروع.",
      true
    );

    return;

  }


  try{

    db =
      await initSupabase();


    const session =
      await getSession();


    if(session){

      const owner =
        await ensureOwner();


      if(owner){

        await showDashboard();

      }else{

        await db.auth.signOut();

      }

    }


  }catch(error){

    message(
      $("loginMessage"),
      error.message,
      true
    );

  }

}



document.addEventListener(
  "DOMContentLoaded",
  () => {

    if(!configured()){

      message(
        $("loginMessage"),
        "أكمل إعداد Supabase أولًا في js/supabase.js.",
        true
      );

    }


    $("loginForm")
      .addEventListener(
        "submit",
        login
      );


    $("logoutBtn")
      .addEventListener(
        "click",
        logout
      );


    $("productForm")
      .addEventListener(
        "submit",
        saveProduct
      );


    document
      .querySelectorAll(
        "[data-close-modal]"
      )
      .forEach(
        b =>
          b.addEventListener(
            "click",
            closeProductModal
          )
      );


    document
      .querySelectorAll(
        ".admin-tab"
      )
      .forEach(
        b =>
          b.addEventListener(
            "click",
            () => {

              document
                .querySelectorAll(
                  ".admin-tab"
                )
                .forEach(
                  x =>
                    x.classList
                      .remove(
                        "active"
                      )
                );


              b.classList
                .add("active");


              renderTab(
                b.dataset.tab
              );

            }
          )
      );


    boot();

  }
);