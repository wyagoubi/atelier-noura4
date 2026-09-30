const BUCKET = "product-media";

let db = null;
let categories = [];
let products = [];
let currentTab = "overview";
let realtimeChannel = null;

const $ = id => document.getElementById(id);

function money(value) {
  return new Intl.NumberFormat("fr-DZ")
    .format(Number(value || 0)) + " DA";
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[c])
  );
}

function configured() {
  return typeof isSupabaseConfigured === "function"
    && isSupabaseConfigured();
}

function message(el, text, error = false) {
  if (!el) return;

  el.textContent = text || "";

  el.classList.toggle(
    "show",
    Boolean(text)
  );

  el.style.background =
    error ? "#f9e6e6" : "#f5eee8";

  el.style.color =
    error ? "#8d2525" : "#5e5148";
}


/* ============================================================
   AUTH
============================================================ */

async function getSession() {

  const {
    data,
    error
  } = await db.auth.getSession();

  if (error) throw error;

  return data.session;
}


async function ensureOwner() {

  const session = await getSession();

  if (!session) return false;

  const {
    data,
    error
  } = await db
    .from("profiles")
    .select("role,full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;

  return data?.role === "owner";
}


async function showDashboard() {

  $("loginView").style.display = "none";

  $("dashboardView").style.display = "grid";

  $("logoutBtn").style.display = "inline-block";

  const session = await getSession();

  $("ownerEmail").textContent =
    session?.user?.email || "";

  await loadBaseData();

  await renderTab("overview");

  subscribeOwnerRealtime();
}


function showLogin() {

  $("loginView").style.display = "block";

  $("dashboardView").style.display = "none";

  $("logoutBtn").style.display = "none";

  $("ownerEmail").textContent = "";

  if (realtimeChannel) {

    db.removeChannel(realtimeChannel);

    realtimeChannel = null;
  }
}


/* ============================================================
   DATA
============================================================ */

async function loadBaseData() {

  const [
    catRes,
    productRes
  ] = await Promise.all([

    db
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),

    db
      .from("products")
      .select(
        "*,categories(*),product_images(*)"
      )
      .order(
        "created_at",
        { ascending: false }
      )

  ]);

  if (catRes.error)
    throw catRes.error;

  if (productRes.error)
    throw productRes.error;

  categories =
    catRes.data || [];

  products =
    productRes.data || [];
}


async function refreshProducts() {

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
      { ascending: false }
    );

  if (error)
    throw error;

  products = data || [];
}


/* ============================================================
   REALTIME OWNER
============================================================ */

function subscribeOwnerRealtime() {

  if (!db) return;

  if (realtimeChannel) {

    db.removeChannel(
      realtimeChannel
    );
  }

  realtimeChannel =
    db
      .channel("atelier-noura-owner")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        async payload => {

          showNewOrderToast(
            payload.eventType === "INSERT"
          );

          if (
            currentTab === "orders"
            || currentTab === "overview"
          ) {

            await renderTab(
              currentTab
            );
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products"
        },
        async () => {

          await refreshProducts();

          if (
            currentTab === "products"
            || currentTab === "overview"
          ) {

            await renderTab(
              currentTab
            );
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_images"
        },
        async () => {

          await refreshProducts();

          if (
            currentTab === "products"
            || currentTab === "overview"
          ) {

            await renderTab(
              currentTab
            );
          }
        }
      )

      .subscribe();
}


function showNewOrderToast(isNew) {

  if (!isNew) return;

  document.title =
    "🔔 طلب جديد — Atelier Noura";

  const toast =
    document.createElement("div");

  toast.style.cssText = `
    position:fixed;
    top:22px;
    right:22px;
    z-index:99999;
    background:#201b17;
    color:white;
    padding:18px 22px;
    border-radius:18px;
    box-shadow:0 20px 60px rgba(0,0,0,.2);
    font-family:Cairo,sans-serif;
    direction:rtl;
  `;

  toast.innerHTML = `
    <strong>🔔 طلب جديد</strong>
    <div style="font-size:12px;margin-top:5px">
      وصل طلب جديد إلى المتجر.
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    document.title =
      "Owner Studio — Atelier Noura";
  }, 6000);
}


/* ============================================================
   DASHBOARD
============================================================ */

async function renderTab(tab) {

  currentTab = tab;

  const root = $("adminApp");

  root.innerHTML = `
    <div class="empty-admin">
      جاري التحميل...
    </div>
  `;

  try {

    if (tab === "overview")
      await renderOverview(root);

    if (tab === "products")
      await renderProducts(root);

    if (tab === "orders")
      await renderOrders(root);

    if (tab === "delivery")
      await renderDelivery(root);

    if (tab === "media")
      await renderMedia(root);

    if (tab === "settings")
      await renderSettings(root);

  } catch (error) {

    root.innerHTML = `
      <div class="admin-card">

        <h2>حدث خطأ</h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>
    `;
  }
}


async function renderOverview(root) {

  const {
    count: orderCount,
    error: orderError
  } = await db
    .from("orders")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    );

  if (orderError)
    throw orderError;


  const {
    count: newCount,
    error: newError
  } = await db
    .from("orders")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    )
    .eq("status", "new");

  if (newError)
    throw newError;


  root.innerHTML = `

    <div class="admin-toolbar">

      <div>

        <span class="eyebrow">
          ATELIER NOURA
        </span>

        <h1 class="dash-title">
          Owner Studio
        </h1>

      </div>

      <button
        class="admin-primary"
        data-open-product
      >
        + إضافة منتج
      </button>

    </div>


    <div class="stats">

      <div class="stat">
        <span>Products</span>
        <b>${products.length}</b>
      </div>

      <div class="stat">
        <span>Orders</span>
        <b>${orderCount || 0}</b>
      </div>

      <div class="stat">
        <span>New orders</span>
        <b>${newCount || 0}</b>
      </div>

      <div class="stat">
        <span>Active products</span>
        <b>
          ${
            products.filter(
              p => p.is_active
            ).length
          }
        </b>
      </div>

    </div>


    <div class="admin-grid">

      <div class="admin-card">

        <h3>
          المنتجات
        </h3>

        <p>
          أضف المنتجات والأسعار
          والصور والفيديوهات والمخزون.
        </p>

        <button
          class="admin-primary"
          data-tab-go="products"
        >
          إدارة المنتجات
        </button>

      </div>


      <div class="admin-card">

        <h3>
          الطلبات
        </h3>

        <p>
          الطلبات الجديدة تظهر تلقائيًا
          عند وصولها.
        </p>

        <button
          class="admin-primary"
          data-tab-go="orders"
        >
          فتح الطلبات
        </button>

      </div>

    </div>

  `;

  bindInlineActions();
}


/* ============================================================
   PRODUCTS
============================================================ */

async function renderProducts(root) {

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

      <button
        class="admin-primary"
        data-open-product
      >
        + إضافة منتج
      </button>

    </div>


    <div class="admin-card">

      <input
        class="admin-search"
        id="productSearch"
        placeholder="ابحث عن منتج..."
      >

      <div
        id="productAdminList"
        style="margin-top:20px"
      >

        ${
          products.length
            ? products
                .map(productRow)
                .join("")
            : `
              <div class="empty-admin">
                لا توجد منتجات بعد.
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


function productRow(p) {

  const cat =
    p.categories?.name_ar
    || "بدون تصنيف";

  const media =
    p.product_images || [];

  const mediaCount =
    media.length;

  const mediaHtml =
    media.map(m => {

      const url =
        publicUrl(
          m.storage_path
        );

      if (
        m.media_type === "video"
      ) {

        return `
          <div
            style="
              position:relative;
              width:72px;
              height:90px;
              border-radius:12px;
              overflow:hidden;
              background:#ddd;
            "
          >

            <video
              src="${url}"
              muted
              preload="metadata"
              style="
                width:100%;
                height:100%;
                object-fit:cover;
              "
            ></video>

            <button
              type="button"
              data-delete-media="${m.id}"
              data-media-path="${escapeHtml(
                m.storage_path
              )}"
              style="
                position:absolute;
                top:4px;
                right:4px;
                border:0;
                border-radius:50%;
                width:22px;
                height:22px;
                cursor:pointer;
              "
            >
              ×
            </button>

          </div>
        `;

      }

      return `
        <div
          style="
            position:relative;
            width:72px;
            height:90px;
            border-radius:12px;
            overflow:hidden;
            background:#ddd;
          "
        >

          <img
            src="${url}"
            alt=""
            style="
              width:100%;
              height:100%;
              object-fit:cover;
            "
          >

          <button
            type="button"
            data-delete-media="${m.id}"
            data-media-path="${escapeHtml(
              m.storage_path
            )}"
            style="
              position:absolute;
              top:4px;
              right:4px;
              border:0;
              border-radius:50%;
              width:22px;
              height:22px;
              cursor:pointer;
            "
          >
            ×
          </button>

        </div>
      `;

    }).join("");


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
      style="
        grid-template-columns:
          90px 1fr auto;
        align-items:start;
      "
    >

      ${productCover(p)}


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

          المخزون:
          ${p.stock}

        </small>

        <small>

          ${
            p.is_active
              ? "ظاهر في المتجر"
              : "مخفي"
          }

          ·

          ${mediaCount}
          ملفات Media

        </small>


        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            margin-top:12px;
          "
        >

          ${mediaHtml}

        </div>


        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            margin-top:12px;
          "
        >

          <label
            class="upload-label"
          >

            + صور / فيديو

            <input
              type="file"
              accept="image/*,video/*"
              multiple
              data-upload-media="${p.id}"
            >

          </label>

        </div>

      </div>


      <div class="admin-actions">

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


function productCover(p) {

  const media =
    (p.product_images || [])
      .find(x => x.is_cover)
      ||
    (p.product_images || [])
      .find(
        x =>
          x.media_type === "image"
      )
      ||
    (p.product_images || [])[0];


  if (!media) {

    return `
      <div class="admin-thumb">
        NO MEDIA
      </div>
    `;
  }


  const url =
    publicUrl(
      media.storage_path
    );


  if (
    media.media_type === "video"
  ) {

    return `
      <div class="admin-thumb">

        <video
          src="${url}"
          muted
          preload="metadata"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
          "
        ></video>

      </div>
    `;
  }


  return `
    <div class="admin-thumb">

      <img
        src="${url}"
        alt=""
      >

    </div>
  `;
}


function publicUrl(path) {

  return db
    .storage
    .from(BUCKET)
    .getPublicUrl(path)
    .data
    .publicUrl;
}


/* ============================================================
   PRODUCT MODAL
============================================================ */

function openProductModal(id = null) {

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
    p?.price ?? 0;


  $("stock").value =
    p?.stock ?? 0;


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

    `<option value="">
      بدون تصنيف
    </option>` +

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


function closeProductModal() {

  $("productModal")
    .classList
    .remove("open");
}


/* ============================================================
   SLUG
============================================================ */

function makeSlug(name) {

  let slug =
    String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9\u0600-\u06ff]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );


  if (!slug) {

    slug =
      "product-" +
      Date.now();
  }


  return slug;
}


async function uniqueSlug(
  base,
  currentId = null
) {

  let slug =
    makeSlug(base);

  let candidate =
    slug;

  let counter = 2;


  while (true) {

    let query =
      db
        .from("products")
        .select("id")
        .eq("slug", candidate)
        .limit(1);


    if (currentId) {

      query =
        query.neq(
          "id",
          currentId
        );
    }


    const {
      data,
      error
    } = await query;


    if (error)
      throw error;


    if (!data?.length)
      return candidate;


    candidate =
      `${slug}-${counter}`;

    counter++;
  }
}


/* ============================================================
   SAVE PRODUCT
============================================================ */

async function saveProduct(e) {

  e.preventDefault();


  const id =
    $("productId").value.trim();


  const nameAr =
    $("nameAr")
      .value
      .trim();


  const nameFr =
    $("nameFr")
      .value
      .trim()
      ||
      nameAr;


  const nameEn =
    $("nameEn")
      .value
      .trim()
      ||
      nameAr;


  const price =
    Number(
      $("price").value
    );


  const stock =
    Number(
      $("stock").value
    );


  if (!nameAr) {

    message(
      $("productMessage"),
      "اكتب اسم المنتج.",
      true
    );

    return;
  }


  if (
    !Number.isFinite(price)
    || price < 0
  ) {

    message(
      $("productMessage"),
      "السعر غير صحيح.",
      true
    );

    return;
  }


  if (
    !Number.isInteger(stock)
    || stock < 0
  ) {

    message(
      $("productMessage"),
      "المخزون غير صحيح.",
      true
    );

    return;
  }


  const slug =
    await uniqueSlug(
      nameEn || nameAr,
      id || null
    );


  const categoryValue =
    $("categoryId").value.trim();


  const payload = {

    category_id:
      categoryValue || null,

    slug,

    name_ar:
      nameAr,

    name_fr:
      nameFr,

    name_en:
      nameEn,

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

    price,

    stock,

    is_featured:
      $("featured").checked,

    is_active:
      $("active").checked

  };


  const result =
    id

      ? await db
          .from("products")
          .update(payload)
          .eq("id", id)
          .select()
          .single()

      : await db
          .from("products")
          .insert(payload)
          .select()
          .single();


  if (result.error) {

    message(
      $("productMessage"),
      result.error.message,
      true
    );

    return;
  }


  closeProductModal();

  await refreshProducts();

  await renderTab(
    "products"
  );
}


/* ============================================================
   DELETE PRODUCT
============================================================ */

async function deleteProduct(id) {

  const p =
    products.find(
      x => x.id === id
    );


  if (!p) return;


  if (
    !confirm(
      "هل تريد حذف المنتج وكل صوره وفيديوهاته؟"
    )
  ) {

    return;
  }


  const media =
    p.product_images || [];


  const paths =
    media.map(
      x => x.storage_path
    );


  if (paths.length) {

    await db
      .storage
      .from(BUCKET)
      .remove(paths);
  }


  const {
    error
  } = await db
    .from("products")
    .delete()
    .eq("id", id);


  if (error) {

    alert(
      error.message
    );

    return;
  }


  await refreshProducts();

  await renderTab(
    "products"
  );
}


/* ============================================================
   UPLOAD IMAGE / VIDEO
============================================================ */

async function uploadMedia(
  productId,
  files
) {

  if (!files?.length)
    return;


  const selected =
    [...files];


  for (
    const file
    of selected
  ) {

    if (
      !file.type.startsWith(
        "image/"
      )
      &&
      !file.type.startsWith(
        "video/"
      )
    ) {

      alert(
        `${file.name}: نوع الملف غير مدعوم.`
      );

      continue;
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
            upsert: false,
            contentType: file.type
          }
        );


    if (upload.error) {

      alert(
        upload.error.message
      );

      continue;
    }


    const {
      data: existing,
      error: existingError
    } = await db
      .from("product_images")
      .select(
        "id,is_cover"
      )
      .eq(
        "product_id",
        productId
      );


    if (existingError) {

      await db
        .storage
        .from(BUCKET)
        .remove([path]);

      alert(
        existingError.message
      );

      continue;
    }


    const hasCover =
      existing?.some(
        x => x.is_cover
      );


    const mediaType =
      file.type.startsWith(
        "video/"
      )
        ? "video"
        : "image";


    const insert =
      await db
        .from("product_images")
        .insert({

          product_id:
            productId,

          storage_path:
            path,

          media_type:
            mediaType,

          is_cover:
            !hasCover,

          sort_order:
            existing?.length || 0

        })
        .select()
        .single();


    if (insert.error) {

      await db
        .storage
        .from(BUCKET)
        .remove([path]);

      alert(
        insert.error.message
      );

      continue;
    }


    if (!hasCover) {

      const url =
        publicUrl(path);


      await db
        .from("products")
        .update({
          cover_image: url
        })
        .eq(
          "id",
          productId
        );
    }
  }


  await refreshProducts();

  await renderTab(
    "products"
  );
}


/* ============================================================
   DELETE MEDIA
============================================================ */

async function deleteMedia(
  mediaId,
  storagePath
) {

  if (
    !confirm(
      "هل تريد حذف هذا الملف؟"
    )
  ) {

    return;
  }


  const {
    data: media,
    error: mediaError
  } = await db
    .from("product_images")
    .select(
      "id,product_id,is_cover"
    )
    .eq(
      "id",
      mediaId
    )
    .single();


  if (mediaError)
    throw mediaError;


  await db
    .storage
    .from(BUCKET)
    .remove([
      storagePath
    ]);


  const {
    error
  } = await db
    .from("product_images")
    .delete()
    .eq(
      "id",
      mediaId
    );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  if (media.is_cover) {

    const {
      data: next
    } = await db
      .from("product_images")
      .select("*")
      .eq(
        "product_id",
        media.product_id
      )
      .order(
        "sort_order"
      )
      .limit(1);


    if (next?.length) {

      await db
        .from("product_images")
        .update({
          is_cover: true
        })
        .eq(
          "id",
          next[0].id
        );


      await db
        .from("products")
        .update({
          cover_image:
            publicUrl(
              next[0]
                .storage_path
            )
        })
        .eq(
          "id",
          media.product_id
        );

    } else {

      await db
        .from("products")
        .update({
          cover_image: null
        })
        .eq(
          "id",
          media.product_id
        );
    }
  }


  await refreshProducts();

  await renderTab(
    "products"
  );
}


/* ============================================================
   ORDERS
============================================================ */

async function renderOrders(root) {

  const {
    data,
    error
  } = await db
    .from("orders")
    .select(
      "*,order_items(*)"
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error)
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

              <th>الطلب</th>

              <th>الزبون</th>

              <th>التوصيل</th>

              <th>المحتوى</th>

              <th>الإجمالي</th>

              <th>الحالة</th>

            </tr>

          </thead>


          <tbody>

            ${
              data?.length

                ? data
                    .map(
                      orderRow
                    )
                    .join("")

                : `

                  <tr>

                    <td colspan="6">

                      <div
                        class="empty-admin"
                      >
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
            e.target.dataset
              .orderStatus;

          const status =
            e.target.value;


          const {
            error
          } = await db
            .from("orders")
            .update({
              status
            })
            .eq(
              "id",
              id
            );


          if (error) {

            alert(
              error.message
            );

            return;
          }
        }
      );
    });


  $("refresh-orders")
    ?.addEventListener(
      "click",
      () =>
        renderTab(
          "orders"
        )
    );
}


function orderRow(o) {

  const items =
    (o.order_items || [])
      .map(
        item =>
          `
          ${escapeHtml(
            item.product_name
          )}
          × ${item.quantity}
          `
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
          ${new Date(
            o.created_at
          ).toLocaleString("fr-DZ")}
        </small>

      </td>


      <td>

        <strong>
          ${escapeHtml(
            o.customer_name
          )}
        </strong>

        <br>

        ${escapeHtml(
          o.customer_phone
        )}

        ${
          o.customer_email
            ? `<br>${escapeHtml(
                o.customer_email
              )}`
            : ""
        }

      </td>


      <td>

        ${escapeHtml(
          o.wilaya_name
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
                status =>
                  `
                  <option
                    value="${status}"
                    ${
                      o.status === status
                        ? "selected"
                        : ""
                    }
                  >
                    ${status}
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


/* ============================================================
   DELIVERY
============================================================ */

async function renderDelivery(root) {

  const {
    data,
    error
  } = await db
    .from("delivery_zones")
    .select("*")
    .order(
      "wilaya_code"
    );


  if (error)
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
        حدد سعر التوصيل للمنزل
        أو مكتب التوصيل لكل ولاية.
      </p>


      <div class="admin-table-wrap">

        <table class="admin-table">

          <thead>

            <tr>
              <th>الولاية</th>
              <th>Home</th>
              <th>Office</th>
              <th>Active</th>
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
                          z.wilaya_name_ar
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

      const rows =
        {};

      document
        .querySelectorAll(
          ".delivery-input"
        )
        .forEach(
          input => {

            const id =
              input.dataset.id;

            rows[id] ??= {
              id
            };

            rows[id][
              input.dataset.field
            ] =
              Number(
                input.value || 0
              );
          }
        );


      for (
        const row
        of Object.values(rows)
      ) {

        const active =
          document.querySelector(
            `.delivery-active[data-id="${row.id}"]`
          );


        row.is_active =
          !!active?.checked;


        const {
          id,
          ...update
        } = row;


        const {
          error
        } = await db
          .from("delivery_zones")
          .update(update)
          .eq(
            "id",
            id
          );


        if (error) {

          alert(
            error.message
          );

          return;
        }
      }


      alert(
        "تم حفظ أسعار التوصيل."
      );
    };
}


/* ============================================================
   MEDIA
============================================================ */

async function renderMedia(root) {

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
        إدارة صور وفيديوهات المنتجات
      </h3>

      <p>
        افتح Products ثم اختر المنتج
        لرفع الصور أو الفيديوهات.
      </p>

      <button
        class="admin-primary"
        data-tab-go="products"
      >
        إدارة Media
      </button>

    </div>

  `;

  bindInlineActions();
}


/* ============================================================
   SETTINGS
============================================================ */

async function renderSettings(root) {

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
        الحساب محمي بواسطة
        Supabase Auth + RLS.
      </p>

    </div>

  `;
}


/* ============================================================
   BUTTONS
============================================================ */

function bindInlineActions() {

  document
    .querySelectorAll(
      "[data-open-product]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openProductModal();

      }
    );


  document
    .querySelectorAll(
      "[data-tab-go]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            renderTab(
              button.dataset.tabGo
            );

      }
    );


  document
    .querySelectorAll(
      "[data-edit-product]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openProductModal(
              button.dataset
                .editProduct
            );

      }
    );


  document
    .querySelectorAll(
      "[data-delete-product]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            deleteProduct(
              button.dataset
                .deleteProduct
            );

      }
    );


  document
    .querySelectorAll(
      "[data-upload-media]"
    )
    .forEach(
      input => {

        input.addEventListener(
          "change",
          async e => {

            await uploadMedia(
              e.target.dataset
                .uploadMedia,

              e.target.files
            );

            e.target.value = "";
          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-delete-media]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            deleteMedia(
              button.dataset
                .deleteMedia,

              button.dataset
                .mediaPath
            );

      }
    );

}


/* ============================================================
   LOGIN
============================================================ */

async function login(e) {

  e.preventDefault();

  message(
    $("loginMessage"),
    ""
  );


  try {

    const {
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


    if (error)
      throw error;


    const owner =
      await ensureOwner();


    if (!owner) {

      await db.auth.signOut();

      throw new Error(
        "هذا الحساب ليس حساب مالك Atelier Noura."
      );
    }


    await showDashboard();


  } catch (err) {

    message(
      $("loginMessage"),
      err.message,
      true
    );
  }
}


async function logout() {

  if (realtimeChannel) {

    db.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }


  await db.auth.signOut();

  showLogin();
}


/* ============================================================
   BOOT
============================================================ */

async function boot() {

  if (!configured()) {

    message(
      $("loginMessage"),
      "Supabase غير مضبوط بشكل صحيح.",
      true
    );

    return;
  }


  try {

    db =
      await initSupabase();


    const session =
      await getSession();


    if (session) {

      const owner =
        await ensureOwner();


      if (owner) {

        await showDashboard();

      } else {

        await db.auth.signOut();
      }
    }


  } catch (error) {

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

    $("loginForm")
      ?.addEventListener(
        "submit",
        login
      );


    $("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );


    $("productForm")
      ?.addEventListener(
        "submit",
        saveProduct
      );


    document
      .querySelectorAll(
        "[data-close-modal]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            closeProductModal
          );
        }
      );


    document
      .querySelectorAll(
        ".admin-tab"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

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


              button.classList
                .add("active");


              await renderTab(
                button.dataset.tab
              );
            }
          );
        }
      );


    boot();

  }
);
