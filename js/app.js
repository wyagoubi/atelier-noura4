/* =========================================================
   Atelier Noura - Main Application
   File: js/app.js

   Responsibilities:
   - Supabase connection
   - Products
   - Categories
   - Product details
   - Cart
   - Checkout
   - Delivery zones
   - Order creation
   - Realtime product updates
========================================================= */

(function () {
    "use strict";

    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const SUPABASE_URL =
        "https://rjhdfzwsmsijpwfqglxn.supabase.co";

    const SUPABASE_ANON_KEY =
        window.SUPABASE_CONFIG?.anonKey || "";

    let STORE_DB = null;

    /* =========================================================
       GLOBAL STATE
    ========================================================= */

    let allProducts = [];
    let allCategories = [];
    let deliveryZones = [];

    let currentProduct = null;

    const CART_KEY = "atelier_noura_cart";
    const LAST_ORDER_KEY = "atelier_noura_last_order";


    /* =========================================================
       HELPERS
    ========================================================= */

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    function escapeHTML(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function formatPrice(value) {
        const number = Number(value || 0);

        return new Intl.NumberFormat("fr-DZ", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(number) + " DA";
    }

    function getLanguage() {
        return (
            localStorage.getItem("atelier_noura_language") ||
            document.documentElement.lang ||
            "ar"
        ).toLowerCase();
    }

    function getLocalizedValue(item, field) {
        if (!item) {
            return "";
        }

        const lang = getLanguage();

        const values = {
            ar: item[`${field}_ar`],
            fr: item[`${field}_fr`],
            en: item[`${field}_en`]
        };

        return (
            values[lang] ||
            values.ar ||
            values.fr ||
            values.en ||
            ""
        );
    }

    function showMessage(message) {
        alert(message);
    }

    function getProductImage(product) {
        if (!product) {
            return "";
        }

        if (product.cover_image) {
            return product.cover_image;
        }

        if (
            Array.isArray(product.product_images) &&
            product.product_images.length > 0
        ) {
            const cover =
                product.product_images.find((image) => image.is_cover) ||
                product.product_images[0];

            return cover?.storage_path || "";
        }

        return "";
    }

    /* =========================================================
       SUPABASE INITIALIZATION
    ========================================================= */

    async function initializeSupabase() {
        if (window.supabase?.createClient) {
            const key =
                SUPABASE_ANON_KEY ||
                window.SUPABASE_CONFIG?.anonKey;

            if (!key || key === "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY") {
                console.error("Supabase publishable key is missing.");
                return null;
            }

            STORE_DB = window.supabase.createClient(
                SUPABASE_URL,
                key
            );

            return STORE_DB;
        }

        await loadSupabaseScript();

        const key =
            SUPABASE_ANON_KEY ||
            window.SUPABASE_CONFIG?.anonKey;

        if (!key || key === "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY") {
            console.error("Supabase publishable key is missing.");
            return null;
        }

        STORE_DB = window.supabase.createClient(
            SUPABASE_URL,
            key
        );

        return STORE_DB;
    }

    function loadSupabaseScript() {
        return new Promise((resolve, reject) => {
            if (window.supabase?.createClient) {
                resolve();
                return;
            }

            const existing =
                document.querySelector(
                    'script[src*="supabase-js"]'
                );

            if (existing) {
                existing.addEventListener("load", resolve);
                existing.addEventListener("error", reject);
                return;
            }

            const script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

            script.onload = resolve;

            script.onerror = () => {
                reject(
                    new Error(
                        "Unable to load Supabase library."
                    )
                );
            };

            document.head.appendChild(script);
        });
    }

    /* =========================================================
       CART
    ========================================================= */

    function getCart() {
        try {
            const saved =
                localStorage.getItem(CART_KEY);

            if (!saved) {
                return [];
            }

            const parsed = JSON.parse(saved);

            return Array.isArray(parsed)
                ? parsed
                : [];
        } catch (error) {
            console.error(
                "Unable to read cart:",
                error
            );

            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

        updateCartCounter();

        document.dispatchEvent(
            new CustomEvent("atelier-cart-updated", {
                detail: cart
            })
        );
    }

    function clearCart() {
        localStorage.removeItem(CART_KEY);

        updateCartCounter();

        document.dispatchEvent(
            new CustomEvent("atelier-cart-updated", {
                detail: []
            })
        );
    }

    function getCartQuantity() {
        return getCart().reduce(
            (total, item) =>
                total + Number(item.quantity || 0),
            0
        );
    }

    function updateCartCounter() {
        const quantity = getCartQuantity();

        const counters = $$(
            "[data-cart-count], #cart-count, .cart-count"
        );

        counters.forEach((element) => {
            element.textContent = String(quantity);

            if (quantity > 0) {
                element.classList.remove("hidden");
            } else {
                element.classList.add("hidden");
            }
        });
    }

    function addToCart(productId, quantity = 1) {
        const product =
            allProducts.find(
                (item) => item.id === productId
            );

        if (!product) {
            showMessage(
                "المنتج غير موجود أو لم يعد متاحًا."
            );
            return;
        }

        if (!product.is_active) {
            showMessage(
                "هذا المنتج غير متاح حاليًا."
            );
            return;
        }

        const stock =
            Number(product.stock || 0);

        if (stock <= 0) {
            showMessage(
                "عذرًا، هذا المنتج غير متوفر حاليًا."
            );
            return;
        }

        const requestedQuantity =
            Math.max(1, Number(quantity || 1));

        const cart = getCart();

        const existing =
            cart.find(
                (item) =>
                    item.product_id === product.id
            );

        if (existing) {
            const newQuantity =
                Number(existing.quantity || 0) +
                requestedQuantity;

            if (newQuantity > stock) {
                showMessage(
                    `الكمية المتوفرة حاليًا هي ${stock} فقط.`
                );
                return;
            }

            existing.quantity = newQuantity;
        } else {
            cart.push({
                product_id: product.id,
                quantity: Math.min(
                    requestedQuantity,
                    stock
                )
            });
        }

        saveCart(cart);

        showMessage(
            "تمت إضافة المنتج إلى السلة."
        );
    }

    function updateCartItem(productId, quantity) {
        const cart = getCart();

        const item =
            cart.find(
                (cartItem) =>
                    cartItem.product_id === productId
            );

        if (!item) {
            return;
        }

        const product =
            allProducts.find(
                (productItem) =>
                    productItem.id === productId
            );

        const stock =
            Number(product?.stock || 0);

        let newQuantity =
            Number(quantity || 0);

        if (newQuantity <= 0) {
            removeCartItem(productId);
            return;
        }

        if (stock > 0 && newQuantity > stock) {
            newQuantity = stock;

            showMessage(
                `الكمية القصوى المتوفرة هي ${stock}.`
            );
        }

        item.quantity = newQuantity;

        saveCart(cart);

        renderCart();
    }

    function removeCartItem(productId) {
        const cart =
            getCart().filter(
                (item) =>
                    item.product_id !== productId
            );

        saveCart(cart);

        renderCart();
    }

    /* =========================================================
       LOAD PRODUCTS
    ========================================================= */

    async function loadProducts() {
        if (!STORE_DB) {
            return [];
        }

        const { data, error } =
            await STORE_DB
                .from("products")
                .select(`
                    *,
                    categories (
                        id,
                        slug,
                        name_ar,
                        name_fr,
                        name_en
                    ),
                    product_images (
                        id,
                        storage_path,
                        media_type,
                        alt_text,
                        sort_order,
                        is_cover
                    )
                `)
                .eq("is_active", true)
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            console.error(
                "Products loading error:",
                error
            );

            showMessage(
                "حدث خطأ أثناء تحميل المنتجات."
            );

            return [];
        }

        allProducts = data || [];

        return allProducts;
    }

    /* =========================================================
       LOAD CATEGORIES
    ========================================================= */

    async function loadCategories() {
        if (!STORE_DB) {
            return [];
        }

        const { data, error } =
            await STORE_DB
                .from("categories")
                .select("*")
                .eq("is_active", true)
                .order("sort_order", {
                    ascending: true
                });

        if (error) {
            console.error(
                "Categories loading error:",
                error
            );

            return [];
        }

        allCategories = data || [];

        return allCategories;
    }

    /* =========================================================
       LOAD DELIVERY ZONES
    ========================================================= */

    async function loadDeliveryZones() {
        if (!STORE_DB) {
            return [];
        }

        const { data, error } =
            await STORE_DB
                .from("delivery_zones")
                .select("*")
                .eq("is_active", true)
                .order("wilaya_code", {
                    ascending: true
                });

        if (error) {
            console.error(
                "Delivery zones loading error:",
                error
            );

            return [];
        }

        deliveryZones = data || [];

        return deliveryZones;
    }

    /* =========================================================
       PRODUCT CARD
    ========================================================= */

    function createProductCard(product) {
        const image =
            getProductImage(product);

        const name =
            getLocalizedValue(
                product,
                "name"
            ) ||
            product.name_ar ||
            product.name_fr ||
            product.name_en ||
            "Product";

        const category =
            product.categories
                ? getLocalizedValue(
                      product.categories,
                      "name"
                  )
                : "";

        const price =
            Number(product.price || 0);

        const comparePrice =
            Number(
                product.compare_at_price || 0
            );

        const stock =
            Number(product.stock || 0);

        const productUrl =
            `product.html?id=${encodeURIComponent(
                product.id
            )}`;

        return `
            <article
                class="product-card"
                data-product-id="${escapeHTML(product.id)}"
            >
                <a
                    href="${productUrl}"
                    class="product-card-image"
                >
                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(name)}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="product-image-placeholder">
                                    Atelier Noura
                                </div>
                            `
                    }
                </a>

                <div class="product-card-content">

                    ${
                        category
                            ? `
                                <span class="product-category">
                                    ${escapeHTML(category)}
                                </span>
                            `
                            : ""
                    }

                    <h3 class="product-title">
                        <a href="${productUrl}">
                            ${escapeHTML(name)}
                        </a>
                    </h3>

                    <div class="product-price">

                        <span class="current-price">
                            ${formatPrice(price)}
                        </span>

                        ${
                            comparePrice > price
                                ? `
                                    <span class="old-price">
                                        ${formatPrice(comparePrice)}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    ${
                        stock <= 0
                            ? `
                                <span class="stock-status">
                                    غير متوفر
                                </span>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        class="add-to-cart-btn"
                        data-add-to-cart="${escapeHTML(
                            product.id
                        )}"
                        ${
                            stock <= 0
                                ? "disabled"
                                : ""
                        }
                    >
                        ${
                            stock <= 0
                                ? "غير متوفر"
                                : "أضف إلى السلة"
                        }
                    </button>

                </div>
            </article>
        `;
    }

    /* =========================================================
       RENDER PRODUCTS
    ========================================================= */

    function renderProducts(
        products = allProducts,
        container = null
    ) {
        const target =
            container ||
            $(
                "[data-products], #products-grid, .products-grid"
            );

        if (!target) {
            return;
        }

        if (!products.length) {
            target.innerHTML = `
                <div class="empty-state">
                    لا توجد منتجات متاحة حاليًا.
                </div>
            `;

            return;
        }

        target.innerHTML =
            products
                .map(createProductCard)
                .join("");
    }

    /* =========================================================
       FEATURED PRODUCTS
    ========================================================= */

    function renderFeaturedProducts() {
        const target =
            $(
                "[data-featured-products], #featured-products, .featured-products"
            );

        if (!target) {
            return;
        }

        const featured =
            allProducts.filter(
                (product) =>
                    product.is_featured
            );

        renderProducts(
            featured.length
                ? featured
                : allProducts.slice(0, 8),
            target
        );
    }

    /* =========================================================
       NEW ARRIVALS
    ========================================================= */

    function renderNewArrivals() {
        const target =
            $(
                "[data-new-products], #new-products, .new-products"
            );

        if (!target) {
            return;
        }

        renderProducts(
            allProducts.slice(0, 8),
            target
        );
    }

    /* =========================================================
       CATEGORIES
    ========================================================= */

    function renderCategories() {
        const target =
            $(
                "[data-categories], #categories-grid, .categories-grid"
            );

        if (!target) {
            return;
        }

        if (!allCategories.length) {
            target.innerHTML = "";
            return;
        }

        target.innerHTML =
            allCategories
                .map((category) => {

                    const name =
                        getLocalizedValue(
                            category,
                            "name"
                        );

                    return `
                        <a
                            class="category-card"
                            href="products.html?category=${encodeURIComponent(
                                category.slug
                            )}"
                        >

                            ${
                                category.image_url
                                    ? `
                                        <img
                                            src="${escapeHTML(
                                                category.image_url
                                            )}"
                                            alt="${escapeHTML(
                                                name
                                            )}"
                                            loading="lazy"
                                        >
                                    `
                                    : ""
                            }

                            <div class="category-card-content">
                                <h3>
                                    ${escapeHTML(
                                        name
                                    )}
                                </h3>
                            </div>

                        </a>
                    `;
                })
                .join("");
    }

    /* =========================================================
       PRODUCT DETAILS
    ========================================================= */

    async function loadProductDetails() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const productId =
            params.get("id");

        const slug =
            params.get("slug");

        if (!productId && !slug) {
            return;
        }

        let product =
            allProducts.find(
                (item) =>
                    item.id === productId
            );

        if (!product && slug) {
            product =
                allProducts.find(
                    (item) =>
                        item.slug === slug
                );
        }

        if (!product) {
            const query =
                productId
                    ? STORE_DB
                          .from("products")
                          .select(`
                              *,
                              categories (
                                  id,
                                  slug,
                                  name_ar,
                                  name_fr,
                                  name_en
                              ),
                              product_images (
                                  id,
                                  storage_path,
                                  media_type,
                                  alt_text,
                                  sort_order,
                                  is_cover
                              )
                          `)
                          .eq("id", productId)
                          .eq("is_active", true)
                          .maybeSingle()
                    : STORE_DB
                          .from("products")
                          .select(`
                              *,
                              categories (
                                  id,
                                  slug,
                                  name_ar,
                                  name_fr,
                                  name_en
                              ),
                              product_images (
                                  id,
                                  storage_path,
                                  media_type,
                                  alt_text,
                                  sort_order,
                                  is_cover
                              )
                          `)
                          .eq("slug", slug)
                          .eq("is_active", true)
                          .maybeSingle();

            const { data, error } =
                await query;

            if (error) {
                console.error(error);
                return;
            }

            product = data;
        }

        if (!product) {
            showMessage(
                "المنتج غير موجود."
            );

            return;
        }

        currentProduct = product;

        renderProductDetails(product);
    }

    function renderProductDetails(product) {
        const name =
            getLocalizedValue(
                product,
                "name"
            ) ||
            "Product";

        const description =
            getLocalizedValue(
                product,
                "description"
            );

        const image =
            getProductImage(product);

        const titleTarget =
            $(
                "[data-product-name], #product-name, .product-name"
            );

        const descriptionTarget =
            $(
                "[data-product-description], #product-description, .product-description"
            );

        const priceTarget =
            $(
                "[data-product-price], #product-price, .product-price"
            );

        const imageTarget =
            $(
                "[data-product-image], #product-image, .product-main-image"
            );

        if (titleTarget) {
            titleTarget.textContent =
                name;
        }

        if (descriptionTarget) {
            descriptionTarget.innerHTML =
                escapeHTML(description).replace(
                    /\n/g,
                    "<br>"
                );
        }

        if (priceTarget) {
            priceTarget.textContent =
                formatPrice(
                    product.price
                );
        }

        if (
            imageTarget &&
            image
        ) {
            if (
                imageTarget.tagName === "IMG"
            ) {
                imageTarget.src = image;
                imageTarget.alt = name;
            } else {
                imageTarget.innerHTML = `
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                    >
                `;
            }
        }

        const addButton =
            $(
                "[data-product-add], #product-add-to-cart, .product-add-to-cart"
            );

        if (addButton) {
            addButton.dataset.addToCart =
                product.id;

            addButton.disabled =
                Number(product.stock || 0) <= 0;
        }
    }

    /* =========================================================
       CART RENDERING
    ========================================================= */

    function renderCart() {
        const target =
            $(
                "[data-cart-items], #cart-items, .cart-items"
            );

        if (!target) {
            return;
        }

        const cart =
            getCart();

        if (!cart.length) {
            target.innerHTML = `
                <div class="empty-cart">
                    <h3>السلة فارغة</h3>
                    <a href="products.html">
                        تصفح المنتجات
                    </a>
                </div>
            `;

            updateCartSummary(
                0,
                0,
                0
            );

            return;
        }

        let subtotal = 0;

        target.innerHTML =
            cart
                .map((item) => {

                    const product =
                        allProducts.find(
                            (productItem) =>
                                productItem.id ===
                                item.product_id
                        );

                    if (!product) {
                        return "";
                    }

                    const quantity =
                        Number(
                            item.quantity || 1
                        );

                    const price =
                        Number(
                            product.price || 0
                        );

                    const lineTotal =
                        price * quantity;

                    subtotal += lineTotal;

                    const name =
                        getLocalizedValue(
                            product,
                            "name"
                        );

                    const image =
                        getProductImage(
                            product
                        );

                    return `
                        <div
                            class="cart-item"
                            data-cart-item="${escapeHTML(
                                product.id
                            )}"
                        >

                            <div class="cart-item-image">

                                ${
                                    image
                                        ? `
                                            <img
                                                src="${escapeHTML(
                                                    image
                                                )}"
                                                alt="${escapeHTML(
                                                    name
                                                )}"
                                            >
                                        `
                                        : ""
                                }

                            </div>

                            <div class="cart-item-info">

                                <h3>
                                    ${escapeHTML(
                                        name
                                    )}
                                </h3>

                                <span>
                                    ${formatPrice(
                                        price
                                    )}
                                </span>

                            </div>

                            <div class="cart-item-quantity">

                                <button
                                    type="button"
                                    data-cart-minus="${escapeHTML(
                                        product.id
                                    )}"
                                >
                                    −
                                </button>

                                <input
                                    type="number"
                                    min="1"
                                    value="${quantity}"
                                    data-cart-quantity="${escapeHTML(
                                        product.id
                                    )}"
                                >

                                <button
                                    type="button"
                                    data-cart-plus="${escapeHTML(
                                        product.id
                                    )}"
                                >
                                    +
                                </button>

                            </div>

                            <div class="cart-item-total">
                                ${formatPrice(
                                    lineTotal
                                )}
                            </div>

                            <button
                                type="button"
                                class="remove-cart-item"
                                data-remove-cart="${escapeHTML(
                                    product.id
                                )}"
                            >
                                حذف
                            </button>

                        </div>
                    `;
                })
                .join("");

        updateCartSummary(
            subtotal,
            0,
            subtotal
        );
    }

    function updateCartSummary(
        subtotal,
        deliveryFee,
        total
    ) {
        const subtotalElements =
            $$(
                "[data-cart-subtotal], #cart-subtotal"
            );

        const deliveryElements =
            $$(
                "[data-cart-delivery], #cart-delivery"
            );

        const totalElements =
            $$(
                "[data-cart-total], #cart-total"
            );

        subtotalElements.forEach(
            (element) => {
                element.textContent =
                    formatPrice(subtotal);
            }
        );

        deliveryElements.forEach(
            (element) => {
                element.textContent =
                    formatPrice(
                        deliveryFee
                    );
            }
        );

        totalElements.forEach(
            (element) => {
                element.textContent =
                    formatPrice(total);
            }
        );
    }

    /* =========================================================
       CHECKOUT - DELIVERY ZONES
    ========================================================= */

    function renderDeliveryZones() {
        const select =
            $(
                "#wilaya, #customer-wilaya, [name='wilaya'], [data-wilaya]"
            );

        if (!select) {
            return;
        }

        const currentValue =
            select.value;

        select.innerHTML = `
            <option value="">
                اختر الولاية
            </option>
        `;

        deliveryZones.forEach(
            (zone) => {

                const name =
                    zone.wilaya_name_ar ||
                    zone.wilaya_name_fr ||
                    zone.wilaya_name_en ||
                    zone.wilaya_code;

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    zone.wilaya_code;

                option.textContent =
                    `${zone.wilaya_code} - ${name}`;

                select.appendChild(
                    option
                );
            }
        );

        if (currentValue) {
            select.value =
                currentValue;
        }
    }

    function getSelectedDeliveryZone() {
        const select =
            $(
                "#wilaya, #customer-wilaya, [name='wilaya'], [data-wilaya]"
            );

        if (!select) {
            return null;
        }

        return (
            deliveryZones.find(
                (zone) =>
                    String(zone.wilaya_code) ===
                    String(select.value)
            ) || null
        );
    }

    function getDeliveryMethod() {
        const select =
            $(
                "#delivery-method, #deliveryMethod, [name='delivery_method'], [name='deliveryMethod']"
            );

        if (select) {
            return select.value;
        }

        const checked =
            $(
                'input[name="delivery_method"]:checked, input[name="deliveryMethod"]:checked'
            );

        return checked?.value || "";
    }

    function updateCheckoutTotal() {
        const cart =
            getCart();

        let subtotal = 0;

        cart.forEach((item) => {
            const product =
                allProducts.find(
                    (productItem) =>
                        productItem.id ===
                        item.product_id
                );

            if (!product) {
                return;
            }

            subtotal +=
                Number(product.price || 0) *
                Number(item.quantity || 0);
        });

        const zone =
            getSelectedDeliveryZone();

        const method =
            getDeliveryMethod();

        let deliveryFee = 0;

        if (zone) {
            if (method === "home") {
                deliveryFee =
                    Number(
                        zone.home_fee || 0
                    );
            } else if (
                method === "office"
            ) {
                deliveryFee =
                    Number(
                        zone.office_fee || 0
                    );
            }
        }

        const total =
            subtotal + deliveryFee;

        updateCartSummary(
            subtotal,
            deliveryFee,
            total
        );
    }

    /* =========================================================
       CHECKOUT VALIDATION
    ========================================================= */

    function validateCustomerName(name) {
        const value =
            normalizeText(name);

        if (!value) {
            return {
                valid: false,
                message:
                    "الاسم مطلوب."
            };
        }

        if (
            value.length < 2 ||
            value.length > 60
        ) {
            return {
                valid: false,
                message:
                    "اكتب اسمًا صحيحًا."
            };
        }

        /*
          Supports Arabic, English and French names.
          Does not allow numbers or random symbols.
        */

        const nameRegex =
            /^[\p{L}\p{M}]+(?:[\s'-][\p{L}\p{M}]+)*$/u;

        if (!nameRegex.test(value)) {
            return {
                valid: false,
                message:
                    "اكتب اسمًا صحيحًا بدون أرقام أو رموز."
            };
        }

        return {
            valid: true,
            value
        };
    }

    function validatePhone(phone) {
        const value =
            String(phone || "")
                .trim()
                .replace(/\s+/g, "");

        if (!value) {
            return {
                valid: false,
                message:
                    "رقم الهاتف مطلوب."
            };
        }

        /*
          Accepted Algerian formats:

          0550123456
          0660123456
          0770123456

          +213550123456
          +213660123456
          +213770123456
        */

        const phoneRegex =
            /^(0[567][0-9]{8}|\+213[567][0-9]{8})$/;

        if (!phoneRegex.test(value)) {
            return {
                valid: false,
                message:
                    "أدخل رقم هاتف جزائري صحيح مثل 0550123456."
            };
        }

        return {
            valid: true,
            value
        };
    }

    function validateEmail(email) {
        /*
          IMPORTANT:
          Email is OPTIONAL.
        */

        const value =
            String(email || "").trim();

        if (!value) {
            return {
                valid: true,
                value: ""
            };
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!emailRegex.test(value)) {
            return {
                valid: false,
                message:
                    "اكتب بريدًا إلكترونيًا صحيحًا مثل example@gmail.com أو اتركه فارغًا."
            };
        }

        return {
            valid: true,
            value: value.toLowerCase()
        };
    }

    /* =========================================================
       GET CHECKOUT INPUTS
    ========================================================= */

    function getCheckoutInput(
        selectors
    ) {
        for (const selector of selectors) {
            const element =
                $(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function getCheckoutData() {
        const nameInput =
            getCheckoutInput([
                "#customer-name",
                "#customerName",
                "#name",
                'input[name="customer_name"]',
                'input[name="customerName"]',
                'input[name="name"]'
            ]);

        const emailInput =
            getCheckoutInput([
                "#customer-email",
                "#customerEmail",
                "#email",
                'input[name="customer_email"]',
                'input[name="customerEmail"]',
                'input[name="email"]'
            ]);

        const phoneInput =
            getCheckoutInput([
                "#customer-phone",
                "#customerPhone",
                "#phone",
                'input[name="customer_phone"]',
                'input[name="customerPhone"]',
                'input[name="phone"]'
            ]);

        const wilayaInput =
            getCheckoutInput([
                "#wilaya",
                "#customer-wilaya",
                'select[name="wilaya"]',
                'select[name="wilaya_code"]'
            ]);

        const addressInput =
            getCheckoutInput([
                "#address",
                "#customer-address",
                'textarea[name="address"]',
                'input[name="address"]'
            ]);

        const notesInput =
            getCheckoutInput([
                "#notes",
                "#customer-notes",
                'textarea[name="notes"]',
                'input[name="notes"]'
            ]);

        return {
            nameInput,
            emailInput,
            phoneInput,
            wilayaInput,
            addressInput,
            notesInput
        };
    }

    /* =========================================================
       BUILD ORDER ITEMS
    ========================================================= */

    function buildOrderItems() {
        const cart =
            getCart();

        if (!cart.length) {
            return {
                valid: false,
                message:
                    "السلة فارغة.",
                items: []
            };
        }

        const items = [];

        for (const cartItem of cart) {

            const product =
                allProducts.find(
                    (product) =>
                        product.id ===
                        cartItem.product_id
                );

            if (!product) {
                return {
                    valid: false,
                    message:
                        "أحد المنتجات في السلة لم يعد متاحًا.",
                    items: []
                };
            }

            if (!product.is_active) {
                return {
                    valid: false,
                    message:
                        `المنتج "${getLocalizedValue(
                            product,
                            "name"
                        )}" غير متاح حاليًا.`,
                    items: []
                };
            }

            const quantity =
                Number(
                    cartItem.quantity || 0
                );

            if (
                !Number.isInteger(
                    quantity
                ) ||
                quantity <= 0
            ) {
                return {
                    valid: false,
                    message:
                        "كمية أحد المنتجات غير صحيحة.",
                    items: []
                };
            }

            const stock =
                Number(
                    product.stock || 0
                );

            if (
                stock < quantity
            ) {
                return {
                    valid: false,
                    message:
                        `الكمية المطلوبة من "${getLocalizedValue(
                            product,
                            "name"
                        )}" غير متوفرة. المتوفر: ${stock}.`,
                    items: []
                };
            }

            items.push({
                product_id:
                    product.id,
                quantity
            });
        }

        return {
            valid: true,
            items
        };
    }

    /* =========================================================
       SUBMIT ORDER
    ========================================================= */

    async function submitOrder(event) {
        if (event) {
            event.preventDefault();
        }

        if (!STORE_DB) {
            showMessage(
                "تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى."
            );
            return;
        }

        const inputs =
            getCheckoutData();

        /* -------------------------
           NAME
        ------------------------- */

        const nameResult =
            validateCustomerName(
                inputs.nameInput?.value
            );

        if (!nameResult.valid) {
            showMessage(
                nameResult.message
            );

            inputs.nameInput?.focus();

            return;
        }

        const customerName =
            nameResult.value;


        /* -------------------------
           PHONE
        ------------------------- */

        const phoneResult =
            validatePhone(
                inputs.phoneInput?.value
            );

        if (!phoneResult.valid) {
            showMessage(
                phoneResult.message
            );

            inputs.phoneInput?.focus();

            return;
        }

        const phone =
            phoneResult.value;


        /* -------------------------
           EMAIL - OPTIONAL
        ------------------------- */

        const emailResult =
            validateEmail(
                inputs.emailInput?.value
            );

        if (!emailResult.valid) {
            showMessage(
                emailResult.message
            );

            inputs.emailInput?.focus();

            return;
        }

        /*
          Empty email becomes null.
          This is intentional.
        */

        const customerEmail =
            emailResult.value || null;


        /* -------------------------
           WILAYA
        ------------------------- */

        const wilayaCode =
            inputs.wilayaInput?.value?.trim() ||
            "";

        if (!wilayaCode) {
            showMessage(
                "اختر الولاية من فضلك."
            );

            inputs.wilayaInput?.focus();

            return;
        }

        const selectedZone =
            deliveryZones.find(
                (zone) =>
                    String(zone.wilaya_code) ===
                    String(wilayaCode)
            );

        if (!selectedZone) {
            showMessage(
                "الولاية المختارة غير متاحة للتوصيل."
            );

            return;
        }


        /* -------------------------
           DELIVERY METHOD
        ------------------------- */

        const deliveryMethod =
            getDeliveryMethod();

        if (
            deliveryMethod !== "home" &&
            deliveryMethod !== "office"
        ) {
            showMessage(
                "اختر طريقة التوصيل."
            );

            return;
        }


        /* -------------------------
           ADDRESS
        ------------------------- */

        const address =
            normalizeText(
                inputs.addressInput?.value
            );

        if (
            deliveryMethod === "home" &&
            address.length < 5
        ) {
            showMessage(
                "أدخل عنوانًا صحيحًا للتوصيل إلى المنزل."
            );

            inputs.addressInput?.focus();

            return;
        }


        /* -------------------------
           NOTES
        ------------------------- */

        const notes =
            normalizeText(
                inputs.notesInput?.value
            );


        /* -------------------------
           CART
        ------------------------- */

        const orderItemsResult =
            buildOrderItems();

        if (!orderItemsResult.valid) {
            showMessage(
                orderItemsResult.message
            );

            return;
        }

        const items =
            orderItemsResult.items;


        /* -------------------------
           DISABLE SUBMIT BUTTON
        ------------------------- */

        const submitButtons =
            $$(
                '#checkout-form button[type="submit"], ' +
                '#order-form button[type="submit"], ' +
                '[data-submit-order]'
            );

        submitButtons.forEach(
            (button) => {
                button.disabled = true;

                button.dataset.originalText =
                    button.textContent;

                button.textContent =
                    "جاري إرسال الطلب...";
            }
        );


        try {

            /* -------------------------
               CALL SUPABASE RPC
            ------------------------- */

            const { data, error } =
                await STORE_DB.rpc(
                    "place_order",
                    {
                        p_address:
                            deliveryMethod === "home"
                                ? address
                                : "",

                        p_customer_email:
                            customerEmail,

                        p_customer_name:
                            customerName,

                        p_customer_phone:
                            phone,

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


            /* -------------------------
               RPC ERROR
            ------------------------- */

            if (error) {
                console.error(
                    "place_order RPC error:",
                    error
                );

                showMessage(
                    error.message ||
                    "تعذر إنشاء الطلب. حاول مرة أخرى."
                );

                return;
            }


            /* -------------------------
               DATABASE RESPONSE
            ------------------------- */

            if (
                !data ||
                data.success !== true
            ) {
                console.error(
                    "Invalid order response:",
                    data
                );

                showMessage(
                    "لم يتم إنشاء الطلب. حاول مرة أخرى."
                );

                return;
            }


            /* -------------------------
               SAVE LAST ORDER
            ------------------------- */

            localStorage.setItem(
                LAST_ORDER_KEY,
                JSON.stringify({
                    id: data.id,
                    order_number:
                        data.order_number,
                    subtotal:
                        data.subtotal,
                    delivery_fee:
                        data.delivery_fee,
                    total:
                        data.total,
                    wilaya_name:
                        data.wilaya_name,
                    delivery_method:
                        data.delivery_method,
                    status:
                        data.status,
                    created_at:
                        new Date().toISOString()
                })
            );


            /* -------------------------
               CLEAR CART
            ------------------------- */

            clearCart();


            /* -------------------------
               SUCCESS REDIRECT
            ------------------------- */

            window.location.href =
                "order-success.html";

        } catch (error) {

            console.error(
                "Unexpected order error:",
                error
            );

            showMessage(
                error.message ||
                "حدث خطأ غير متوقع أثناء إرسال الطلب."
            );

        } finally {

            submitButtons.forEach(
                (button) => {
                    button.disabled = false;

                    if (
                        button.dataset.originalText
                    ) {
                        button.textContent =
                            button.dataset.originalText;
                    }
                }
            );
        }
    }

    /* =========================================================
       ORDER SUCCESS PAGE
    ========================================================= */

    function renderOrderSuccess() {
        const raw =
            localStorage.getItem(
                LAST_ORDER_KEY
            );

        if (!raw) {
            return;
        }

        let order;

        try {
            order =
                JSON.parse(raw);
        } catch {
            return;
        }

        const numberElements =
            $$(
                "[data-order-number], #order-number"
            );

        const totalElements =
            $$(
                "[data-order-total], #order-total"
            );

        const deliveryElements =
            $$(
                "[data-order-delivery], #order-delivery"
            );

        numberElements.forEach(
            (element) => {
                element.textContent =
                    order.order_number ||
                    "";
            }
        );

        totalElements.forEach(
            (element) => {
                element.textContent =
                    formatPrice(
                        order.total
                    );
            }
        );

        deliveryElements.forEach(
            (element) => {
                element.textContent =
                    order.delivery_method ===
                    "home"
                        ? "توصيل إلى المنزل"
                        : "توصيل إلى مكتب الاستلام";
            }
        );
    }

    /* =========================================================
       EVENT HANDLERS
    ========================================================= */

    function setupGlobalEvents() {

        /* Add to cart */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-add-to-cart]"
                    );

                if (!button) {
                    return;
                }

                const productId =
                    button.dataset.addToCart;

                const quantityInput =
                    $(
                        "[data-product-quantity], #product-quantity, #quantity"
                    );

                const quantity =
                    quantityInput
                        ? Number(
                              quantityInput.value
                          )
                        : 1;

                addToCart(
                    productId,
                    quantity
                );
            }
        );


        /* Product page add */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-product-add]"
                    );

                if (!button) {
                    return;
                }

                const productId =
                    button.dataset.productAdd;

                const quantityInput =
                    $(
                        "[data-product-quantity], #product-quantity, #quantity"
                    );

                const quantity =
                    quantityInput
                        ? Number(
                              quantityInput.value
                          )
                        : 1;

                addToCart(
                    productId,
                    quantity
                );
            }
        );


        /* Remove cart item */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-remove-cart]"
                    );

                if (!button) {
                    return;
                }

                removeCartItem(
                    button.dataset.removeCart
                );
            }
        );


        /* Minus */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-cart-minus]"
                    );

                if (!button) {
                    return;
                }

                const productId =
                    button.dataset.cartMinus;

                const cart =
                    getCart();

                const item =
                    cart.find(
                        (cartItem) =>
                            cartItem.product_id ===
                            productId
                    );

                if (!item) {
                    return;
                }

                updateCartItem(
                    productId,
                    Number(item.quantity) - 1
                );
            }
        );


        /* Plus */

        document.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-cart-plus]"
                    );

                if (!button) {
                    return;
                }

                const productId =
                    button.dataset.cartPlus;

                const cart =
                    getCart();

                const item =
                    cart.find(
                        (cartItem) =>
                            cartItem.product_id ===
                            productId
                    );

                if (!item) {
                    return;
                }

                updateCartItem(
                    productId,
                    Number(item.quantity) + 1
                );
            }
        );


        /* Quantity input */

        document.addEventListener(
            "change",
            (event) => {

                const input =
                    event.target.closest(
                        "[data-cart-quantity]"
                    );

                if (!input) {
                    return;
                }

                updateCartItem(
                    input.dataset.cartQuantity,
                    Number(input.value)
                );
            }
        );


        /* Checkout form */

        const checkoutForm =
            $(
                "#checkout-form, #order-form, form[data-checkout]"
            );

        if (checkoutForm) {
            checkoutForm.addEventListener(
                "submit",
                submitOrder
            );
        }


        /* Delivery changes */

        document.addEventListener(
            "change",
            (event) => {

                if (
                    event.target.matches(
                        "#wilaya, #customer-wilaya, [name='wilaya'], [name='wilaya_code'], #delivery-method, #deliveryMethod, [name='delivery_method'], [name='deliveryMethod'], input[name='delivery_method'], input[name='deliveryMethod']"
                    )
                ) {
                    updateCheckoutTotal();
                }
            }
        );
    }

    /* =========================================================
       REALTIME
    ========================================================= */

    function setupRealtime() {
        if (!STORE_DB) {
            return;
        }

        try {

            STORE_DB
                .channel(
                    "atelier-noura-products"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "products"
                    },
                    async () => {

                        await loadProducts();

                        renderFeaturedProducts();
                        renderNewArrivals();
                        renderProducts();
                        renderCart();

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

                        await loadProducts();

                        renderFeaturedProducts();
                        renderNewArrivals();
                        renderProducts();
                        renderCart();

                    }
                )
                .subscribe();

        } catch (error) {

            console.error(
                "Realtime initialization error:",
                error
            );
        }
    }

    /* =========================================================
       CHECKOUT INITIALIZATION
    ========================================================= */

    async function initializeCheckout() {
        const checkoutForm =
            $(
                "#checkout-form, #order-form, form[data-checkout]"
            );

        if (!checkoutForm) {
            return;
        }

        await loadDeliveryZones();

        renderDeliveryZones();

        renderCart();

        updateCheckoutTotal();
    }

    /* =========================================================
       PAGE INITIALIZATION
    ========================================================= */

    async function initializeApp() {

        updateCartCounter();

        setupGlobalEvents();

        try {

            await initializeSupabase();

            if (!STORE_DB) {
                console.error(
                    "Supabase client was not initialized."
                );

                return;
            }

            await Promise.all([
                loadProducts(),
                loadCategories()
            ]);

            renderFeaturedProducts();
            renderNewArrivals();
            renderProducts();
            renderCategories();
            renderCart();

            await loadProductDetails();

            await initializeCheckout();

            renderOrderSuccess();

            setupRealtime();

        } catch (error) {

            console.error(
                "Atelier Noura initialization error:",
                error
            );
        }
    }

    /* =========================================================
       START
    ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeApp
        );
    } else {
        initializeApp();
    }

})();
