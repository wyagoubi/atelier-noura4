/* ============================================================
   ATELIER NOURA - REAL STORE APP
   FULL VERSION
   Order system fixed
============================================================ */

let STORE_DB = null;

let PRODUCTS = [];

let DELIVERY_ZONES = [];

let realtimeStoreChannel = null;

const SUPABASE_CDN =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";


/* ============================================================
   HELPERS
============================================================ */

const money = value =>
  new Intl.NumberFormat(
    "fr-DZ"
  ).format(
    Number(value || 0)
  ) + " DA";


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


function getLang() {

  return (
    localStorage.getItem(
      "lang"
    ) || "ar"
  );
}


function getCart() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "cart"
      ) || "[]"
    );

  } catch {

    return [];
  }
}


function saveCart(cart) {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

  updateCartCount();
}


function getAccount() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "atelierAccount"
      ) || "null"
    );

  } catch {

    return null;
  }
}


function updateCartCount() {

  const count =
    getCart()
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.qty || 0
          ),
        0
      );


  document
    .querySelectorAll(
      "#cartCount"
    )
    .forEach(
      element => {

        element.textContent =
          count;
      }
    );
}


/* ============================================================
   LOAD SUPABASE
============================================================ */

function loadScript(src) {

  return new Promise(
    (resolve, reject) => {

      const existing =
        document.querySelector(
          `script[src="${src}"]`
        );


      if (existing) {

        if (
          existing.dataset.loaded ===
          "true"
        ) {

          resolve();

        } else {

          existing.addEventListener(
            "load",
            resolve,
            {
              once: true
            }
          );

          existing.addEventListener(
            "error",
            reject,
            {
              once: true
            }
          );
        }

        return;
      }


      const script =
        document.createElement(
          "script"
        );

      script.src = src;

      script.onload = () => {

        script.dataset.loaded =
          "true";

        resolve();
      };

      script.onerror =
        () =>
          reject(
            new Error(
              "تعذر تحميل Supabase."
            )
          );

      document.head.appendChild(
        script
      );
    }
  );
}


async function initStoreSupabase() {

  if (
    typeof isSupabaseConfigured !==
    "function"
  ) {

    await loadScript(
      "js/supabase.js"
    );
  }


  if (!window.supabase) {

    await loadScript(
      SUPABASE_CDN
    );
  }


  STORE_DB =
    await initSupabase();


  if (!STORE_DB) {

    throw new Error(
      "Supabase غير مضبوط."
    );
  }


  return STORE_DB;
}


/* ============================================================
   PRODUCTS
============================================================ */

async function loadProducts() {

  const {
    data,
    error
  } = await STORE_DB
    .from("products")
    .select(
      "*,categories(*),product_images(*)"
    )
    .eq(
      "is_active",
      true
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error)
    throw error;


  PRODUCTS =
    data || [];


  cleanCart();


  return PRODUCTS;
}


function cleanCart() {

  const cart =
    getCart();


  const validIds =
    new Set(
      PRODUCTS.map(
        product =>
          String(product.id)
      )
    );


  const cleaned =
    cart.filter(
      item =>
        validIds.has(
          String(
            item.id ??
            item.product_id
          )
        )
    );


  if (
    cleaned.length !==
    cart.length
  ) {

    saveCart(
      cleaned
    );
  }
}


function productName(product) {

  const lang =
    getLang();


  if (lang === "fr")
    return (
      product.name_fr ||
      product.name_en ||
      product.name_ar ||
      "Product"
    );


  if (lang === "en")
    return (
      product.name_en ||
      product.name_fr ||
      product.name_ar ||
      "Product"
    );


  return (
    product.name_ar ||
    product.name_en ||
    product.name_fr ||
    "Product"
  );
}


function productDescription(
  product
) {

  const lang =
    getLang();


  if (lang === "fr")
    return (
      product.description_fr ||
      product.description_en ||
      product.description_ar ||
      ""
    );


  if (lang === "en")
    return (
      product.description_en ||
      product.description_fr ||
      product.description_ar ||
      ""
    );


  return (
    product.description_ar ||
    product.description_en ||
    product.description_fr ||
    ""
  );
}


function productCategory(
  product
) {

  return (
    product.categories?.slug ||
    ""
  );
}


function getMedia(
  product
) {

  return (
    product.product_images
      ?.slice()
      .sort(
        (a, b) =>
          Number(
            a.sort_order || 0
          ) -
          Number(
            b.sort_order || 0
          )
      ) || []
  );
}


function getCoverMedia(
  product
) {

  const media =
    getMedia(product);


  return (
    media.find(
      item =>
        item.is_cover
    )
    ||
    media.find(
      item =>
        item.media_type ===
        "image"
    )
    ||
    media[0]
    ||
    null
  );
}


function mediaUrl(
  storagePath
) {

  if (!storagePath)
    return "";


  return STORE_DB
    .storage
    .from(
      "product-media"
    )
    .getPublicUrl(
      storagePath
    )
    .data
    .publicUrl;
}


/* ============================================================
   MEDIA
============================================================ */

function productVisual(
  product,
  extraClass = ""
) {

  const media =
    getCoverMedia(
      product
    );


  if (!media) {

    return `
      <div
        class="
          product-image
          ${extraClass}
          product-placeholder
        "
      >

        <span class="product-number">
          AN
        </span>

        <div>

          <small>
            ATELIER NOURA
          </small>

          <strong>
            ${escapeHtml(
              productName(product)
            )}
          </strong>

        </div>

      </div>
    `;
  }


  const url =
    mediaUrl(
      media.storage_path
    );


  if (
    media.media_type ===
    "video"
  ) {

    return `
      <div
        class="
          product-image
          ${extraClass}
        "
      >

        <video
          src="${escapeHtml(url)}"
          muted
          loop
          autoplay
          playsinline
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
    <div
      class="
        product-image
        ${extraClass}
      "
    >

      <img
        src="${escapeHtml(url)}"
        alt="${escapeHtml(
          productName(product)
        )}"
        loading="lazy"
      >

    </div>
  `;
}


/* ============================================================
   PRODUCT CARD
============================================================ */

function productCard(
  product
) {

  return `

    <article
      class="product-card"
    >

      <a
        href="
          product.html?id=${
            encodeURIComponent(
              product.id
            )
          }
        "
      >

        ${productVisual(
          product
        )}

      </a>


      <button
        class="add"
        data-add="${escapeHtml(
          product.id
        )}"
        type="button"
      >
        +
      </button>


      <div class="product-info">

        <h3>
          ${escapeHtml(
            productName(product)
          )}
        </h3>

        <p>
          ${escapeHtml(
            productDescription(
              product
            )
          )}
        </p>

        <div class="price">
          ${money(
            product.price
          )}
        </div>

      </div>

    </article>
  `;
}


function renderProducts(
  list = PRODUCTS,
  target = "productsGrid"
) {

  const element =
    document.getElementById(
      target
    );


  if (!element)
    return;


  if (!list.length) {

    element.innerHTML = `
      <div
        class="empty"
        style="
          grid-column:1/-1;
        "
      >
        لا توجد منتجات متاحة حاليًا.
      </div>
    `;

    return;
  }


  element.innerHTML =
    list
      .map(
        productCard
      )
      .join("");


  element
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            addToCart(
              button.dataset.add
            );
          }
        );
      }
    );
}


/* ============================================================
   HOME
============================================================ */

function renderNewArrivals() {

  const grid =
    document.getElementById(
      "newArrivalsGrid"
    );


  if (!grid)
    return;


  const items =
    PRODUCTS.slice(0, 3);


  if (!items.length) {

    grid.innerHTML = "";

    return;
  }


  grid.innerHTML =
    items
      .map(
        (product, index) => `

          <a
            class="
              floating-product
              fp-${index + 1}
            "
            href="
              product.html?id=${
                encodeURIComponent(
                  product.id
                )
              }
            "
          >

            <div
              class="
                floating-product-image
              "
            >

              ${productVisual(
                product
              )}

            </div>


            <div
              class="
                floating-product-meta
              "
            >

              <span>
                ${
                  index === 0
                    ? "NEW ARRIVAL"
                    : index === 1
                      ? "JUST IN"
                      : "HANDMADE"
                }
              </span>

              <strong>
                ${escapeHtml(
                  productName(
                    product
                  )
                )}
              </strong>

              <small>
                ${money(
                  product.price
                )}
              </small>

            </div>

          </a>
        `
      )
      .join("");
}


function initHome() {

  renderNewArrivals();


  const featured =
    PRODUCTS
      .filter(
        p =>
          p.is_featured
      )
      .slice(0, 4);


  renderProducts(
    featured.length
      ? featured
      : PRODUCTS.slice(0, 4),
    "featuredGrid"
  );
}


/* ============================================================
   PRODUCTS PAGE
============================================================ */

function initProductsPage() {

  const grid =
    document.getElementById(
      "productsGrid"
    );


  if (!grid)
    return;


  let current =
    new URLSearchParams(
      location.search
    ).get(
      "category"
    ) || "all";


  function refresh() {

    let list =
      current === "all"
        ? [...PRODUCTS]
        : PRODUCTS.filter(
            product =>
              productCategory(
                product
              ) === current
          );


    const sort =
      document.getElementById(
        "sort"
      )?.value;


    if (sort === "low") {

      list.sort(
        (a, b) =>
          Number(a.price) -
          Number(b.price)
      );
    }


    if (sort === "high") {

      list.sort(
        (a, b) =>
          Number(b.price) -
          Number(a.price)
      );
    }


    renderProducts(
      list,
      "productsGrid"
    );
  }


  document
    .querySelectorAll(
      ".filter"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            current =
              button.dataset.cat;


            document
              .querySelectorAll(
                ".filter"
              )
              .forEach(
                x =>
                  x.classList
                    .remove(
                      "active"
                    )
              );


            button.classList
              .add(
                "active"
              );


            refresh();
          }
        );
      }
    );


  document
    .getElementById(
      "sort"
    )
    ?.addEventListener(
      "change",
      refresh
    );


  const active =
    document.querySelector(
      `[data-cat="${current}"]`
    );


  active
    ?.classList
    .add("active");


  refresh();
}


/* ============================================================
   PRODUCT DETAIL
============================================================ */

function renderProductDetail(
  product
) {

  const root =
    document.getElementById(
      "productDetail"
    );


  if (!root)
    return;


  if (!product) {

    root.innerHTML = `
      <div class="empty">
        المنتج غير موجود.
      </div>
    `;

    return;
  }


  const media =
    getMedia(
      product
    );


  const gallery =
    media.length
      ? media
          .map(
            item => {

              const url =
                mediaUrl(
                  item.storage_path
                );


              if (
                item.media_type ===
                "video"
              ) {

                return `
                  <div
                    class="detail-image"
                    style="
                      overflow:hidden;
                    "
                  >

                    <video
                      src="${escapeHtml(url)}"
                      controls
                      playsinline
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
                <div
                  class="
                    detail-image
                    has-image
                  "
                >

                  <img
                    src="${escapeHtml(url)}"
                    alt="${escapeHtml(
                      productName(
                        product
                      )
                    )}"
                  >

                </div>
              `;
            }
          )
          .join("")
      : `
          <div
            class="
              detail-image
              product-placeholder
            "
          >

            <div>

              <small>
                ATELIER NOURA
              </small>

              <strong>
                ${escapeHtml(
                  productName(
                    product
                  )
                )}
              </strong>

            </div>

          </div>
        `;


  const category =
    product.categories?.name_ar ||
    productCategory(
      product
    );


  root.innerHTML = `

    <div
      class="
        product-detail
      "
    >

      <div>

        <div
          style="
            display:grid;
            gap:16px;
          "
        >

          ${gallery}

        </div>

      </div>


      <div
        class="detail-info"
      >

        <p class="eyebrow">
          ${escapeHtml(
            category || ""
          )}
        </p>


        <h1>
          ${escapeHtml(
            productName(
              product
            )
          )}
        </h1>


        <div class="price">
          ${money(
            product.price
          )}
        </div>


        <p class="description">

          ${escapeHtml(
            productDescription(
              product
            )
          )}

          <br>
          <br>

          قطعة مصنوعة بعناية،
          وقد تختلف التفاصيل قليلًا
          لأن كل قطعة لها طابعها الخاص.

        </p>


        <div class="qty">

          <button
            type="button"
            id="minus"
          >
            −
          </button>

          <b id="qty">
            1
          </b>

          <button
            type="button"
            id="plus"
          >
            +
          </button>

        </div>


        <button
          class="btn btn-dark"
          id="buy"
          type="button"
        >
          أضيفي إلى الحقيبة
        </button>

      </div>

    </div>
  `;


  let quantity = 1;


  const quantityElement =
    document.getElementById(
      "qty"
    );


  document
    .getElementById(
      "plus"
    )
    ?.addEventListener(
      "click",
      () => {

        quantity++;

        quantityElement
          .textContent =
            quantity;
      }
    );


  document
    .getElementById(
      "minus"
    )
    ?.addEventListener(
      "click",
      () => {

        quantity =
          Math.max(
            1,
            quantity - 1
          );

        quantityElement
          .textContent =
            quantity;
      }
    );


  document
    .getElementById(
      "buy"
    )
    ?.addEventListener(
      "click",
      () => {

        addToCart(
          product.id,
          quantity
        );

        location.href =
          "cart.html";
      }
    );
}


function initDetail() {

  const root =
    document.getElementById(
      "productDetail"
    );


  if (!root)
    return;


  const id =
    new URLSearchParams(
      location.search
    ).get(
      "id"
    );


  const product =
    PRODUCTS.find(
      p =>
        String(p.id) ===
        String(id)
    );


  renderProductDetail(
    product
  );
}


/* ============================================================
   CART
============================================================ */

function addToCart(
  productId,
  quantity = 1
) {

  const product =
    PRODUCTS.find(
      p =>
        String(p.id) ===
        String(productId)
    );


  if (!product)
    return;


  let cart =
    getCart();


  const existing =
    cart.find(
      item =>
        String(
          item.id ??
          item.product_id
        ) ===
        String(productId)
    );


  if (existing) {

    existing.id =
      product.id;

    existing.qty =
      Number(
        existing.qty || 0
      ) +
      Number(quantity);

  } else {

    cart.push({
      id: product.id,
      qty: Number(quantity)
    });
  }


  saveCart(cart);


  const button =
    document.querySelector(
      `[data-add="${CSS.escape(
        String(productId)
      )}"]`
    );


  if (button) {

    const original =
      button.textContent;

    button.textContent =
      "✓";


    setTimeout(
      () => {

        button.textContent =
          original;

      },
      900
    );
  }
}


function initCart() {

  const root =
    document.getElementById(
      "cartView"
    );


  if (!root)
    return;


  const cart =
    getCart();


  if (!cart.length) {

    root.innerHTML = `
      <div class="empty">

        <h2>
          حقيبتك فارغة
        </h2>

        <p>
          اكتشفي قطع
          Atelier Noura.
        </p>

        <a
          class="btn btn-dark"
          href="products.html"
        >
          المتجر
        </a>

      </div>
    `;

    return;
  }


  let subtotal = 0;


  const rows =
    cart
      .map(
        item => {

          const product =
            PRODUCTS.find(
              p =>
                String(p.id) ===
                String(
                  item.id ??
                  item.product_id
                )
            );


          if (!product)
            return "";


          const quantity =
            Number(
              item.qty ??
              item.quantity ??
              1
            );


          const line =
            Number(
              product.price
            ) *
            quantity;


          subtotal +=
            line;


          return `

            <div
              class="cart-item"
            >

              <div
                class="cart-thumb"
              >

                ${productVisual(
                  product
                )}

              </div>


              <div>

                <h3>
                  ${escapeHtml(
                    productName(
                      product
                    )
                  )}
                </h3>

                <p>
                  ${quantity}
                  ×
                  ${money(
                    product.price
                  )}
                </p>

              </div>


              <div>

                <b>
                  ${money(line)}
                </b>

                <br>

                <button
                  class="remove"
                  data-remove-cart="${escapeHtml(
                    product.id
                  )}"
                  type="button"
                >
                  حذف
                </button>

              </div>

            </div>
          `;
        }
      )
      .join("");


  root.innerHTML = `

    <div
      class="cart-layout"
    >

      <div>
        ${rows}
      </div>


      <aside
        class="summary-card"
      >

        <h2>
          ملخص الطلب
        </h2>


        <div
          class="summary-row"
        >

          <span>
            المنتجات
          </span>

          <b>
            ${money(
              subtotal
            )}
          </b>

        </div>


        <div
          class="summary-row"
        >

          <span>
            التوصيل
          </span>

          <span>
            يحسب حسب الولاية
          </span>

        </div>


        <div
          class="
            summary-row
            summary-total
          "
        >

          <span>
            الإجمالي
          </span>

          <b>
            ${money(
              subtotal
            )}
          </b>

        </div>


        <a
          class="btn btn-dark full"
          href="checkout.html"
        >
          متابعة الطلب
        </a>

      </aside>

    </div>
  `;


  root
    .querySelectorAll(
      "[data-remove-cart]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset
                .removeCart;


            saveCart(
              getCart().filter(
                item =>
                  String(
                    item.id ??
                    item.product_id
                  ) !==
                  String(id)
              )
            );


            initCart();
          }
        );
      }
    );
}


/* ============================================================
   DELIVERY
============================================================ */

async function loadDeliveryZones() {

  const {
    data,
    error
  } = await STORE_DB
    .from(
      "delivery_zones"
    )
    .select("*")
    .eq(
      "is_active",
      true
    )
    .order(
      "wilaya_code",
      {
        ascending: true
      }
    );


  if (error)
    throw error;


  DELIVERY_ZONES =
    data || [];


  return DELIVERY_ZONES;
}


function findField(
  form,
  names
) {

  for (
    const name
    of names
  ) {

    const byId =
      form.querySelector(
        `#${name}`
      );


    if (byId)
      return byId;


    const byName =
      form.querySelector(
        `[name="${name}"]`
      );


    if (byName)
      return byName;
  }


  return null;
}


function getDeliveryMethod(
  form
) {

  const checked =
    form.querySelector(
      'input[name="delivery_method"]:checked'
    );


  if (checked)
    return checked.value;


  const select =
    findField(
      form,
      [
        "delivery_method",
        "deliveryMethod",
        "delivery"
      ]
    );


  return (
    select?.value ||
    "home"
  );
}


function getWilayaCode(
  form
) {

  const select =
    findField(
      form,
      [
        "wilaya",
        "wilaya_code"
      ]
    );


  return (
    select?.value ||
    ""
  );
}


function populateWilayas(
  form
) {

  const select =
    findField(
      form,
      [
        "wilaya",
        "wilaya_code"
      ]
    );


  if (!select)
    return;


  select.innerHTML = `

    <option value="">
      اختر الولاية
    </option>

    ${
      DELIVERY_ZONES
        .map(
          zone => {

            const name =
              zone.wilaya_name_ar ||
              zone.wilaya ||
              zone.wilaya_name_fr ||
              zone.wilaya_name_en ||
              zone.wilaya_code ||
              "";

            return `

              <option
                value="${escapeHtml(
                  zone.wilaya_code
                )}"
              >
                ${escapeHtml(
                  name
                )}
              </option>

            `;
          }
        )
        .join("")
    }

  `;
}


function renderCheckoutSummary(
  cart,
  deliveryFee = 0
) {

  const root =
    document.getElementById(
      "checkoutSummary"
    );


  if (!root)
    return;


  let subtotal = 0;


  const rows =
    cart
      .map(
        item => {

          const product =
            PRODUCTS.find(
              p =>
                String(p.id) ===
                String(
                  item.id ??
                  item.product_id
                )
            );


          if (!product)
            return "";


          const quantity =
            Number(
              item.qty ??
              item.quantity ??
              1
            );


          const line =
            Number(
              product.price
            ) *
            quantity;


          subtotal +=
            line;


          return `

            <div
              class="summary-row"
            >

              <span>

                ${escapeHtml(
                  productName(
                    product
                  )
                )}

                ×

                ${quantity}

              </span>

              <b>
                ${money(line)}
              </b>

            </div>

          `;
        }
      )
      .join("");


  const total =
    subtotal +
    Number(
      deliveryFee || 0
    );


  root.innerHTML = `

    <h2>
      طلبك
    </h2>

    ${rows}


    <div
      class="summary-row"
    >

      <span>
        المنتجات
      </span>

      <b>
        ${money(
          subtotal
        )}
      </b>

    </div>


    <div
      class="summary-row"
    >

      <span>
        التوصيل
      </span>

      <b>
        ${money(
          deliveryFee
        )}
      </b>

    </div>


    <div
      class="
        summary-row
        summary-total
      "
    >

      <span>
        الإجمالي
      </span>

      <b>
        ${money(total)}
      </b>

    </div>

  `;
}


/* ============================================================
   CHECKOUT
   FIXED
============================================================ */

async function initCheckout() {

  const form =
    document.querySelector(
      "#checkoutForm, #checkout-form, #order-form, form[data-checkout]"
    );


  if (!form)
    return;


  const cart =
    getCart();


  if (!cart.length) {

    const summary =
      document.getElementById(
        "checkoutSummary"
      );


    if (summary) {

      summary.innerHTML = `
        <div class="empty">
          السلة فارغة.
        </div>
      `;
    }


    return;
  }


  await loadDeliveryZones();


  populateWilayas(
    form
  );


  renderCheckoutSummary(
    cart,
    0
  );


  function updateFee() {

    const method =
      getDeliveryMethod(
        form
      );


    const code =
      getWilayaCode(
        form
      );


    const zone =
      DELIVERY_ZONES.find(
        zone =>
          String(
            zone.wilaya_code
          ) ===
          String(code)
      );


    let fee = 0;


    if (zone) {

      fee =
        method === "office"
          ? Number(
              zone.office_fee || 0
            )
          : Number(
              zone.home_fee || 0
            );
    }


    renderCheckoutSummary(
      cart,
      fee
    );


    toggleAddress(
      form
    );
  }


  form
    .querySelectorAll(
      "select,input,textarea"
    )
    .forEach(
      input => {

        input.addEventListener(
          "change",
          updateFee
        );

        input.addEventListener(
          "input",
          event => {

            if (
              event.target.matches(
                "#delivery-method, #deliveryMethod, #wilaya, #customer-wilaya, [name='delivery_method'], [name='deliveryMethod'], [name='wilaya'], [name='wilaya_code']"
              )
            ) {

              updateFee();
            }
          }
        );
      }
    );


  toggleAddress(
    form
  );


  form.onsubmit =
    async event => {

      event.preventDefault();


      if (!cart.length) {

        alert(
          "السلة فارغة."
        );

        return;
      }


      /* =====================================================
         CUSTOMER NAME
      ===================================================== */

      const customerName =
        (
          findField(
            form,
            [
              "name",
              "customerName",
              "customer_name"
            ]
          )?.value || ""
        ).trim();


      /* =====================================================
         CUSTOMER EMAIL
         OPTIONAL
      ===================================================== */

      const customerEmail =
        (
          findField(
            form,
            [
              "email",
              "customerEmail",
              "customer_email"
            ]
          )?.value || ""
        ).trim();


      /* =====================================================
         CUSTOMER PHONE
      ===================================================== */

      const customerPhone =
        (
          findField(
            form,
            [
              "phone",
              "customerPhone",
              "customer_phone"
            ]
          )?.value || ""
        ).trim();


      /* =====================================================
         ADDRESS
      ===================================================== */

      const address =
        (
          findField(
            form,
            [
              "address",
              "customer-address"
            ]
          )?.value || ""
        ).trim();


      /* =====================================================
         NOTES
      ===================================================== */

      const notes =
        (
          findField(
            form,
            [
              "notes",
              "customer-notes"
            ]
          )?.value || ""
        ).trim();


      /* =====================================================
         WILAYA
      ===================================================== */

      const wilayaCode =
        getWilayaCode(
          form
        );


      /* =====================================================
         DELIVERY METHOD
      ===================================================== */

      const deliveryMethod =
        getDeliveryMethod(
          form
        );


      /* =====================================================
         VALIDATE NAME
      ===================================================== */

      if (
        !customerName ||
        customerName.length < 2
      ) {

        alert(
          "اكتب اسمًا صحيحًا."
        );

        return;
      }


      if (
        customerName.length > 100
      ) {

        alert(
          "الاسم طويل جدًا."
        );

        return;
      }


      /* =====================================================
         VALIDATE EMAIL
         EMPTY EMAIL IS VALID
      ===================================================== */

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


      if (
        customerEmail &&
        !emailPattern.test(
          customerEmail
        )
      ) {

        alert(
          "اكتب بريدًا إلكترونيًا صحيحًا مثل example@gmail.com أو اتركه فارغًا."
        );

        return;
      }


      /* =====================================================
         VALIDATE PHONE
      ===================================================== */

      const phoneNormalized =
        customerPhone
          .replace(
            /\s+/g,
            ""
          )
          .replace(
            /-/g,
            ""
          );


      const algeriaPhonePattern =
        /^(0[567][0-9]{8}|\+213[567][0-9]{8})$/;


      if (
        !algeriaPhonePattern.test(
          phoneNormalized
        )
      ) {

        alert(
          "اكتب رقم هاتف جزائري صحيح، مثل 0550123456 أو +213551234567."
        );

        return;
      }


      /* =====================================================
         VALIDATE WILAYA
      ===================================================== */

      if (!wilayaCode) {

        alert(
          "اختر الولاية."
        );

        return;
      }


      /* =====================================================
         VALIDATE DELIVERY
      ===================================================== */

      if (
        deliveryMethod !== "home" &&
        deliveryMethod !== "office"
      ) {

        alert(
          "اختر طريقة توصيل صحيحة."
        );

        return;
      }


      /* =====================================================
         VALIDATE ADDRESS FOR HOME
      ===================================================== */

      if (
        deliveryMethod === "home" &&
        address.length < 5
      ) {

        alert(
          "اكتب عنوان التوصيل بشكل صحيح."
        );

        return;
      }


      /* =====================================================
         BUILD ORDER ITEMS
         IMPORTANT:
         Current DB uses bigint product IDs.
      ===================================================== */

      const items =
        cart
          .map(
            item => {

              const productId =
                Number(
                  item.id ??
                  item.product_id
                );


              const quantity =
                Number(
                  item.qty ??
                  item.quantity ??
                  1
                );


              return {
                product_id:
                  productId,

                quantity:
                  Math.max(
                    1,
                    Math.min(
                      99,
                      Number.isFinite(
                        quantity
                      )
                        ? Math.floor(
                            quantity
                          )
                        : 1
                    )
                  )
              };
            }
          )
          .filter(
            item =>
              Number.isInteger(
                item.product_id
              ) &&
              item.product_id > 0 &&
              Number.isInteger(
                item.quantity
              ) &&
              item.quantity > 0
          );


      if (!items.length) {

        alert(
          "لا توجد منتجات صالحة في السلة."
        );

        return;
      }


      /* =====================================================
         VERIFY PRODUCTS BEFORE RPC
      ===================================================== */

      for (
        const item of items
      ) {

        const product =
          PRODUCTS.find(
            product =>
              String(
                product.id
              ) ===
              String(
                item.product_id
              )
          );


        if (!product) {

          alert(
            "أحد المنتجات في السلة لم يعد متاحًا. حدّث الصفحة."
          );

          await loadProducts();

          initCart();

          return;
        }


        if (
          !product.is_active
        ) {

          alert(
            `المنتج "${productName(
              product
            )}" لم يعد متاحًا.`
          );

          await loadProducts();

          initCart();

          return;
        }


        const stock =
          Number(
            product.stock ?? 0
          );


        if (
          Number.isFinite(stock) &&
          stock < item.quantity
        ) {

          alert(
            `الكمية المطلوبة من "${productName(
              product
            )}" غير متوفرة.`
          );

          return;
        }
      }


      /* =====================================================
         SUBMIT BUTTON
      ===================================================== */

      const button =
        form.querySelector(
          'button[type="submit"]'
        );


      if (button) {

        button.disabled =
          true;

        button.dataset.originalText =
          button.textContent;

        button.textContent =
          "جاري إرسال الطلب...";
      }


      /* =====================================================
         SEND ORDER TO SUPABASE
      ===================================================== */

      try {

        const {
          data,
          error
        } = await STORE_DB.rpc(
          "place_order",
          {

            p_address:
              deliveryMethod ===
              "home"
                ? address
                : "",

            p_customer_email:
              customerEmail
                ? customerEmail
                : null,

            p_customer_name:
              customerName,

            p_customer_phone:
              phoneNormalized,

            p_delivery_method:
              deliveryMethod,

            p_items:
              items,

            p_notes:
              notes,

            p_wilaya_code:
              wilayaCode

          }
        );


        /* =================================================
           DATABASE ERROR
        ================================================= */

        if (error) {

          console.error(
            "place_order error:",
            error
          );

          throw new Error(
            error.message ||
            "تعذر إنشاء الطلب."
          );
        }


        /* =================================================
           RESPONSE
        ================================================= */

        if (!data) {

          throw new Error(
            "تم الاتصال بقاعدة البيانات لكن لم يتم إنشاء الطلب."
          );
        }


        const order =
          Array.isArray(data)
            ? data[0]
            : data;


        if (
          !order ||
          order.success !== true
        ) {

          console.error(
            "Unexpected place_order response:",
            data
          );

          throw new Error(
            "لم يتم تأكيد إنشاء الطلب."
          );
        }


        if (
          !order.order_number
        ) {

          throw new Error(
            "تم إنشاء الطلب بدون رقم طلب."
          );
        }


        /* =================================================
           SAVE LAST ORDER
        ================================================= */

        localStorage.setItem(
          "lastOrder",
          String(
            order.order_number
          )
        );


        localStorage.setItem(
          "lastOrderTotal",
          String(
            order.total ?? 0
          )
        );


        if (order.id) {

          localStorage.setItem(
            "lastOrderId",
            String(
              order.id
            )
          );
        }


        localStorage.setItem(
          "atelier_noura_last_order",
          JSON.stringify({
            id:
              order.id ||
              null,

            order_number:
              order.order_number,

            subtotal:
              order.subtotal,

            delivery_fee:
              order.delivery_fee,

            total:
              order.total,

            wilaya_name:
              order.wilaya_name,

            delivery_method:
              order.delivery_method,

            status:
              order.status,

            created_at:
              new Date().toISOString()
          })
        );


        /* =================================================
           CLEAR CART ONLY AFTER SUCCESS
        ================================================= */

        localStorage.removeItem(
          "cart"
        );


        updateCartCount();


        /* =================================================
           SUCCESS PAGE
        ================================================= */

        window.location.href =
          "order-success.html";

      }


      /* =====================================================
         ERROR
      ===================================================== */

      catch (error) {

        console.error(
          "Atelier Noura order error:",
          error
        );


        let message =
          error?.message ||
          "تعذر إرسال الطلب.";


        const lowerMessage =
          String(
            message
          ).toLowerCase();


        if (
          lowerMessage.includes(
            "function"
          ) &&
          lowerMessage.includes(
            "does not exist"
          )
        ) {

          message =
            "دالة إنشاء الطلب place_order غير موجودة أو لم يتم تحديثها في Supabase.";
        }


        if (
          lowerMessage.includes(
            "schema cache"
          )
        ) {

          message =
            "Supabase لا يزال يستخدم نسخة قديمة من place_order. يجب تشغيل SQL الجديد في Supabase.";
        }


        alert(
          message
        );


        if (button) {

          button.disabled =
            false;

          button.textContent =
            button.dataset
              .originalText ||
            "تأكيد الطلب";
        }
      }
    };
}


/* ============================================================
   ADDRESS TOGGLE
============================================================ */

function toggleAddress(
  form = null
) {

  const currentForm =
    form ||
    document.querySelector(
      "#checkoutForm, #checkout-form, #order-form, form[data-checkout]"
    );


  if (!currentForm)
    return;


  const method =
    getDeliveryMethod(
      currentForm
    );


  const group =
    currentForm.querySelector(
      "#address-group"
    ) ||
    document.getElementById(
      "address-group"
    );


  const address =
    findField(
      currentForm,
      [
        "address",
        "customer-address"
      ]
    );


  if (!group)
    return;


  if (
    method === "home"
  ) {

    group.style.display =
      "block";


    if (address) {

      address.required =
        true;
    }

  } else {

    group.style.display =
      "none";


    if (address) {

      address.required =
        false;

      address.value =
        "";
    }
  }
}


/* ============================================================
   ACCOUNT
============================================================ */

function initAccount() {

  const account =
    getAccount();


  document
    .querySelectorAll(
      "#accountName"
    )
    .forEach(
      element => {

        element.textContent =
          account?.email
            ?.split("@")[0]
            || "";
      }
    );


  document
    .querySelectorAll(
      "#accountBtn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          openAccountModal
        );
      }
    );


  document
    .querySelectorAll(
      "#accountLogout"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            localStorage.removeItem(
              "atelierAccount"
            );

            location.reload();
          }
        );
      }
    );


  const modal =
    document.getElementById(
      "accountModal"
    );


  if (!modal)
    return;


  const form =
    document.getElementById(
      "accountForm"
    );


  if (!form)
    return;


  const title =
    document.getElementById(
      "accountModalTitle"
    );


  const hint =
    document.getElementById(
      "accountHint"
    );


  if (account) {

    if (title) {

      title.textContent =
        "حسابك";
    }


    if (hint) {

      hint.textContent =
        account.email;
    }


    const input =
      form.querySelector(
        "input"
      );


    if (input) {

      input.value =
        account.email;
    }


    const button =
      form.querySelector(
        "button"
      );


    if (button) {

      button.textContent =
        "تحديث البريد";
    }
  }


  form.onsubmit =
    event => {

      event.preventDefault();


      const value =
        new FormData(
          form
        ).get(
          "email"
        );


      const email =
        String(
          value || ""
        ).trim();


      if (!email)
        return;


      localStorage.setItem(
        "atelierAccount",
        JSON.stringify({
          email
        })
      );


      modal.classList
        .remove(
          "open"
        );


      location.reload();
    };


  modal
    .querySelectorAll(
      "[data-close-account]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            modal.classList
              .remove(
                "open"
              )
        );
      }
    );
}


function openAccountModal() {

  document
    .getElementById(
      "accountModal"
    )
    ?.classList
    .add(
      "open"
    );
}


/* ============================================================
   REALTIME
============================================================ */

function subscribeStoreRealtime() {

  if (!STORE_DB)
    return;


  if (realtimeStoreChannel) {

    STORE_DB.removeChannel(
      realtimeStoreChannel
    );
  }


  realtimeStoreChannel =
    STORE_DB
      .channel(
        "atelier-noura-store"
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products"
        },
        async () => {

          try {

            await loadProducts();

            refreshVisiblePage();

          } catch (error) {

            console.error(
              "Products realtime error:",
              error
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

          try {

            await loadProducts();

            refreshVisiblePage();

          } catch (error) {

            console.error(
              "Product media realtime error:",
              error
            );
          }
        }
      )

      .subscribe();
}


function refreshVisiblePage() {

  if (
    document.getElementById(
      "newArrivalsGrid"
    )
  ) {

    initHome();
  }


  if (
    document.getElementById(
      "productsGrid"
    )
  ) {

    initProductsPage();
  }


  if (
    document.getElementById(
      "productDetail"
    )
  ) {

    initDetail();
  }


  if (
    document.getElementById(
      "cartView"
    )
  ) {

    initCart();
  }
}


/* ============================================================
   BOOT
============================================================ */

async function bootStore() {

  updateCartCount();


  try {

    await initStoreSupabase();


    await loadProducts();


    await loadDeliveryZones();


    initHome();


    initProductsPage();


    initDetail();


    initCart();


    await initCheckout();


    initAccount();


    subscribeStoreRealtime();


  } catch (error) {

    console.error(
      "Atelier Noura:",
      error
    );


    initAccount();


    const grids =
      document.querySelectorAll(
        "#featuredGrid,#productsGrid"
      );


    grids.forEach(
      grid => {

        grid.innerHTML = `
          <div
            class="empty"
            style="
              grid-column:1/-1;
            "
          >
            تعذر تحميل المنتجات
            حاليًا. حاول تحديث الصفحة.
          </div>
        `;
      }
    );
  }


  document
    .getElementById(
      "menuBtn"
    )
    ?.addEventListener(
      "click",
      () =>
        document
          .querySelector(
            ".nav"
          )
          ?.classList
          .toggle(
            "show"
          )
    );
}


document.addEventListener(
  "DOMContentLoaded",
  bootStore
);
