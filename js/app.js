/* =========================================================
   Atelier Noura
   File: js/app.js
========================================================= */

(function () {

    "use strict";

    const CART_KEY =
        "atelier_noura_cart";

    const LAST_ORDER_KEY =
        "atelier_noura_last_order";

    let db = null;

    let products = [];
    let categories = [];
    let deliveryZones = [];

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function $$(selector, parent = document) {
        return Array.from(
            parent.querySelectorAll(selector)
        );
    }

    function escapeHTML(value) {

        return String(
            value ?? ""
        )
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

        return (
            Number(value || 0)
                .toLocaleString("fr-DZ") +
            " DA"
        );
    }

    function language() {

        return (
            localStorage.getItem(
                "atelier_noura_language"
            ) ||
            document.documentElement.lang ||
            "ar"
        );
    }

    function localized(item, field) {

        if (!item) {
            return "";
        }

        const lang =
            language();

        return (
            item[`${field}_${lang}`] ||
            item[`${field}_ar`] ||
            item[`${field}_fr`] ||
            item[`${field}_en`] ||
            ""
        );
    }

    function showMessage(message) {
        alert(message);
    }

    /* =====================================================
       SUPABASE
    ===================================================== */

    function initializeDatabase() {

        if (
            typeof initSupabase !==
            "function"
        ) {
            throw new Error(
                "Supabase configuration file is missing."
            );
        }

        db = initSupabase();

        return db;
    }

    /* =====================================================
       IMAGE
    ===================================================== */

    function getImageUrl(path) {

        if (!path) {
            return "";
        }

        if (
            path.startsWith("http://") ||
            path.startsWith("https://") ||
            path.startsWith("data:")
        ) {
            return path;
        }

        if (!db) {
            return "";
        }

        return db.storage
            .from("product-media")
            .getPublicUrl(path)
            .data.publicUrl;
    }

    function productImage(product) {

        if (
            product.cover_image
        ) {
            return getImageUrl(
                product.cover_image
            );
        }

        const images =
            product.product_images ||
            [];

        const cover =
            images.find(
                image => image.is_cover
            ) ||
            images[0];

        return getImageUrl(
            cover?.storage_path
        );
    }

    /* =====================================================
       CART
    ===================================================== */

    function getCart() {

        try {

            const raw =
                localStorage.getItem(
                    CART_KEY
                );

            if (!raw) {
                return [];
            }

            const data =
                JSON.parse(raw);

            return Array.isArray(data)
                ? data
                : [];

        } catch {

            return [];

        }
    }

    function saveCart(cart) {

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

        updateCartCount();

        renderCart();
    }

    function clearCart() {

        localStorage.removeItem(
            CART_KEY
        );

        updateCartCount();
    }

    function updateCartCount() {

        const count =
            getCart().reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.quantity || 0
                    ),
                0
            );

        $$("#cartCount, #cart-count, .cart-count")
            .forEach(element => {
                element.textContent =
                    String(count);
            });
    }

    function addToCart(
        productId,
        quantity = 1
    ) {

        const product =
            products.find(
                item =>
                    String(item.id) ===
                    String(productId)
            );

        if (!product) {

            showMessage(
                "المنتج غير موجود."
            );

            return;
        }

        const stock =
            Number(product.stock || 0);

        if (stock <= 0) {

            showMessage(
                "هذا المنتج غير متوفر حاليًا."
            );

            return;
        }

        const cart =
            getCart();

        const existing =
            cart.find(
                item =>
                    String(item.product_id) ===
                    String(product.id)
            );

        const requested =
            Math.max(
                1,
                Number(quantity || 1)
            );

        if (existing) {

            const next =
                Number(existing.quantity) +
                requested;

            if (next > stock) {

                showMessage(
                    `المتوفر فقط ${stock} قطعة.`
                );

                return;
            }

            existing.quantity =
                next;

        } else {

            cart.push({
                product_id:
                    product.id,
                quantity:
                    Math.min(
                        requested,
                        stock
                    )
            });

        }

        saveCart(cart);

        showMessage(
            "تمت إضافة المنتج إلى السلة."
        );
    }

    function removeCartItem(productId) {

        const cart =
            getCart().filter(
                item =>
                    String(item.product_id) !==
                    String(productId)
            );

        saveCart(cart);
    }

    function updateCartItem(
        productId,
        quantity
    ) {

        const cart =
            getCart();

        const item =
            cart.find(
                entry =>
                    String(entry.product_id) ===
                    String(productId)
            );

        if (!item) {
            return;
        }

        const product =
            products.find(
                entry =>
                    String(entry.id) ===
                    String(productId)
            );

        const stock =
            Number(product?.stock || 0);

        let next =
            Number(quantity || 0);

        if (next <= 0) {

            removeCartItem(
                productId
            );

            return;
        }

        if (
            stock > 0 &&
            next > stock
        ) {

            next = stock;

            showMessage(
                `المتوفر فقط ${stock} قطعة.`
            );
        }

        item.quantity =
            next;

        saveCart(cart);
    }

    /* =====================================================
       LOAD PRODUCTS
    ===================================================== */

    async function loadProducts() {

        const {
            data,
            error
        } = await db

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

        if (error) {

            console.error(
                "Products error:",
                error
            );

            throw error;
        }

        products =
            data || [];

        return products;
    }

    async function loadCategories() {

        const {
            data,
            error
        } = await db

            .from("categories")

            .select("*")

            .eq(
                "is_active",
                true
            )

            .order(
                "sort_order",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "Categories error:",
                error
            );

            return [];
        }

        categories =
            data || [];

        return categories;
    }

    async function loadDeliveryZones() {

        const {
            data,
            error
        } = await db

            .from("delivery_zones")

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

        if (error) {

            console.error(
                "Delivery error:",
                error
            );

            return [];
        }

        deliveryZones =
            data || [];

        return deliveryZones;
    }

    /* =====================================================
       PRODUCT CARD
    ===================================================== */

    function productCard(product) {

        const name =
            localized(
                product,
                "name"
            ) ||
            "Produit";

        const category =
            localized(
                product.categories,
                "name"
            );

        const image =
            productImage(
                product
            );

        const stock =
            Number(
                product.stock || 0
            );

        return `
            <article
                class="product-card"
                data-product-id="${escapeHTML(product.id)}"
            >

                <a
                    class="product-card-image"
                    href="product.html?id=${encodeURIComponent(product.id)}"
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
                        <a
                            href="product.html?id=${encodeURIComponent(product.id)}"
                        >
                            ${escapeHTML(name)}
                        </a>
                    </h3>

                    <div class="product-price">
                        ${formatPrice(product.price)}
                    </div>

                    <button
                        type="button"
                        class="add-to-cart-btn"
                        data-add-to-cart="${escapeHTML(product.id)}"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${
                            stock > 0
                                ? "أضف إلى السلة"
                                : "غير متوفر"
                        }
                    </button>

                </div>

            </article>
        `;
    }

    function renderProducts(
        list = products,
        target = null
    ) {

        target =
            target ||
            $(
                "[data-products], #products-grid, .products-grid"
            );

        if (!target) {
            return;
        }

        if (!list.length) {

            target.innerHTML = `
                <div class="empty-state">
                    لا توجد منتجات متاحة حاليًا.
                </div>
            `;

            return;
        }

        target.innerHTML =
            list
                .map(productCard)
                .join("");
    }

    function renderFeatured() {

        const target =
            $(
                "[data-featured-products], #featured-products, .featured-products"
            );

        if (!target) {
            return;
        }

        const featured =
            products.filter(
                product =>
                    product.is_featured
            );

        renderProducts(
            featured.length
                ? featured
                : products.slice(0, 8),
            target
        );
    }

    /* =====================================================
       PRODUCT DETAILS
    ===================================================== */

    async function renderProductDetails() {

        const target =
            $("#productDetail");

        if (!target) {
            return;
        }

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("id");

        const slug =
            params.get("slug");

        if (!id && !slug) {

            target.innerHTML = `
                <div class="empty-state">
                    المنتج غير محدد.
                </div>
            `;

            return;
        }

        let product =
            products.find(
                item =>
                    id &&
                    String(item.id) ===
                    String(id)
            );

        if (!product && slug) {

            product =
                products.find(
                    item =>
                        item.slug ===
                        slug
                );
        }

        if (!product) {

            target.innerHTML = `
                <div class="empty-state">
                    المنتج غير موجود أو لم يعد متاحًا.
                </div>
            `;

            return;
        }

        const name =
            localized(
                product,
                "name"
            );

        const description =
            localized(
                product,
                "description"
            );

        const image =
            productImage(
                product
            );

        const stock =
            Number(
                product.stock || 0
            );

        target.innerHTML = `

            <div
                class="product-detail"
                style="
                    display:grid;
                    grid-template-columns:
                        minmax(0,1fr)
                        minmax(0,1fr);
                    gap:40px;
                    max-width:1100px;
                    margin:50px auto;
                    padding:0 20px;
                "
            >

                <div>

                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(name)}"
                                    style="
                                        width:100%;
                                        max-height:650px;
                                        object-fit:cover;
                                        border-radius:25px;
                                    "
                                >
                            `
                            : `
                                <div
                                    style="
                                        min-height:500px;
                                        display:grid;
                                        place-items:center;
                                        background:#eee8e1;
                                        border-radius:25px;
                                    "
                                >
                                    Atelier Noura
                                </div>
                            `
                    }

                </div>

                <div>

                    <span
                        style="
                            color:#88796d;
                            font-size:13px;
                        "
                    >
                        ${escapeHTML(
                            localized(
                                product.categories,
                                "name"
                            )
                        )}
                    </span>

                    <h1>
                        ${escapeHTML(name)}
                    </h1>

                    <div
                        style="
                            font-size:24px;
                            font-weight:700;
                            margin:20px 0;
                        "
                    >
                        ${formatPrice(product.price)}
                    </div>

                    <p
                        style="
                            line-height:2;
                            color:#6e665f;
                        "
                    >
                        ${escapeHTML(description)}
                    </p>

                    ${
                        stock > 0
                            ? `
                                <p>
                                    المتوفر:
                                    <strong>
                                        ${stock}
                                    </strong>
                                </p>

                                <div
                                    style="
                                        display:flex;
                                        gap:10px;
                                        margin-top:20px;
                                    "
                                >

                                    <input
                                        id="product-quantity"
                                        type="number"
                                        min="1"
                                        max="${stock}"
                                        value="1"
                                        style="
                                            width:90px;
                                            padding:13px;
                                            border:1px solid #ddd;
                                            border-radius:12px;
                                        "
                                    >

                                    <button
                                        type="button"
                                        class="add-to-cart-btn"
                                        data-product-add="${escapeHTML(product.id)}"
                                    >
                                        أضف إلى السلة
                                    </button>

                                </div>
                            `
                            : `
                                <p>
                                    هذا المنتج غير متوفر حاليًا.
                                </p>
                            `
                    }

                </div>

            </div>
        `;

        document.title =
            `${name} — Atelier Noura`;
    }

    /* =====================================================
       CART PAGE
    ===================================================== */

    function renderCart() {

        const target =
            $(
                "#cartItems, [data-cart-items]"
            );

        if (!target) {
            return;
        }

        const cart =
            getCart();

        if (!cart.length) {

            target.innerHTML = `
                <div class="empty-state">
                    السلة فارغة.
                </div>
            `;

            updateCartTotals(
                0
            );

            return;
        }

        let subtotal = 0;

        target.innerHTML =
            cart
                .map(item => {

                    const product =
                        products.find(
                            product =>
                                String(product.id) ===
                                String(item.product_id)
                        );

                    if (!product) {
                        return "";
                    }

                    const quantity =
                        Number(
                            item.quantity || 1
                        );

                    const line =
                        Number(
                            product.price || 0
                        ) *
                        quantity;

                    subtotal +=
                        line;

                    const image =
                        productImage(
                            product
                        );

                    const name =
                        localized(
                            product,
                            "name"
                        );

                    return `

                        <div
                            class="cart-item"
                            style="
                                display:flex;
                                gap:15px;
                                align-items:center;
                                margin-bottom:15px;
                            "
                        >

                            ${
                                image
                                    ? `
                                        <img
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(name)}"
                                            style="
                                                width:90px;
                                                height:100px;
                                                object-fit:cover;
                                                border-radius:15px;
                                            "
                                        >
                                    `
                                    : ""
                            }

                            <div
                                style="
                                    flex:1;
                                "
                            >

                                <h3>
                                    ${escapeHTML(name)}
                                </h3>

                                <p>
                                    ${formatPrice(product.price)}
                                </p>

                                <div>

                                    <button
                                        type="button"
                                        data-cart-minus="${escapeHTML(product.id)}"
                                    >
                                        −
                                    </button>

                                    <input
                                        data-cart-quantity="${escapeHTML(product.id)}"
                                        type="number"
                                        min="1"
                                        max="${product.stock}"
                                        value="${quantity}"
                                        style="width:55px"
                                    >

                                    <button
                                        type="button"
                                        data-cart-plus="${escapeHTML(product.id)}"
                                    >
                                        +
                                    </button>

                                    <button
                                        type="button"
                                        data-cart-remove="${escapeHTML(product.id)}"
                                    >
                                        حذف
                                    </button>

                                </div>

                            </div>

                            <strong>
                                ${formatPrice(line)}
                            </strong>

                        </div>
                    `;
                })
                .join("");

        updateCartTotals(
            subtotal
        );
    }

    function updateCartTotals(
        subtotal
    ) {

        const subtotalElement =
            $(
                "#cartSubtotal, [data-cart-subtotal]"
            );

        const totalElement =
            $(
                "#cartTotal, [data-cart-total]"
            );

        if (subtotalElement) {
            subtotalElement.textContent =
                formatPrice(
                    subtotal
                );
        }

        if (totalElement) {
            totalElement.textContent =
                formatPrice(
                    subtotal
                );
        }
    }

    /* =====================================================
       CHECKOUT
    ===================================================== */

    function getCheckoutInputs() {

        return {

            form:
                $(
                    "#checkout-form, #order-form"
                ),

            name:
                $(
                    "#customer-name, #customerName, input[name='customer_name']"
                ),

            phone:
                $(
                    "#customer-phone, #customerPhone, input[name='customer_phone']"
                ),

            email:
                $(
                    "#customer-email, #customerEmail, input[name='customer_email']"
                ),

            wilaya:
                $(
                    "#wilaya, select[name='wilaya_code']"
                ),

            delivery:
                $(
                    "#delivery-method, select[name='delivery_method']"
                ),

            address:
                $(
                    "#address, textarea[name='address']"
                ),

            notes:
                $(
                    "#notes, textarea[name='notes']"
                ),

            message:
                $(
                    "#checkout-message"
                )

        };
    }

    function showCheckoutMessage(
        message
    ) {

        const element =
            $(
                "#checkout-message"
            );

        if (!element) {
            alert(message);
            return;
        }

        element.textContent =
            message;

        element.classList.add(
            "show"
        );
    }

    function hideCheckoutMessage() {

        $(
            "#checkout-message"
        )?.classList.remove(
            "show"
        );
    }

    function validateName(
        value
    ) {

        const name =
            normalizeText(value);

        if (!name) {

            return {
                valid: false,
                message:
                    "الاسم مطلوب."
            };
        }

        if (
            name.length < 2 ||
            name.length > 60
        ) {

            return {
                valid: false,
                message:
                    "اكتب اسمًا صحيحًا."
            };
        }

        const regex =
            /^[\p{L}\p{M}]+(?:[\s'-][\p{L}\p{M}]+)*$/u;

        if (!regex.test(name)) {

            return {
                valid: false,
                message:
                    "اكتب اسمًا صحيحًا بدون أرقام أو رموز."
            };
        }

        return {
            valid: true,
            value: name
        };
    }

    function validatePhone(
        value
    ) {

        const phone =
            String(value || "")
                .trim()
                .replace(/\s+/g, "");

        const regex =
            /^(0[567][0-9]{8}|\+213[567][0-9]{8})$/;

        if (!phone) {

            return {
                valid: false,
                message:
                    "رقم الهاتف مطلوب."
            };
        }

        if (!regex.test(phone)) {

            return {
                valid: false,
                message:
                    "أدخل رقم هاتف جزائري صحيح مثل 0550123456."
            };
        }

        return {
            valid: true,
            value: phone
        };
    }

    function validateEmail(
        value
    ) {

        const email =
            String(value || "")
                .trim();

        /*
           البريد اختياري.
           الفراغ = صحيح.
        */

        if (!email) {

            return {
                valid: true,
                value: null
            };
        }

        const regex =
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!regex.test(email)) {

            return {
                valid: false,
                message:
                    "إذا أدخلت بريدًا إلكترونيًا، يجب أن يكون صحيحًا مثل example@gmail.com."
            };
        }

        return {
            valid: true,
            value:
                email.toLowerCase()
        };
    }

    function renderWilayas() {

        const select =
            $("#wilaya");

        if (!select) {
            return;
        }

        select.innerHTML = `
            <option value="">
                اختر الولاية
            </option>
        `;

        deliveryZones.forEach(
            zone => {

                const name =
                    zone.wilaya_name_ar ||
                    zone.wilaya ||
                    zone.wilaya_name_fr ||
                    zone.wilaya_code;

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    zone.wilaya_code;

                option.textContent =
                    name;

                select.appendChild(
                    option
                );
            }
        );
    }

    function getDeliveryMethod() {

        return (
            $("#delivery-method")
                ?.value ||
            "home"
        );
    }

    function selectedZone() {

        const code =
            $("#wilaya")
                ?.value;

        return deliveryZones.find(
            zone =>
                String(
                    zone.wilaya_code
                ) ===
                String(code)
        );
    }

    function checkoutSubtotal() {

        return getCart().reduce(
            (sum, item) => {

                const product =
                    products.find(
                        p =>
                            String(p.id) ===
                            String(item.product_id)
                    );

                if (!product) {
                    return sum;
                }

                return (
                    sum +
                    Number(product.price || 0) *
                    Number(item.quantity || 0)
                );

            },
            0
        );
    }

    function updateCheckoutTotal() {

        const subtotal =
            checkoutSubtotal();

        const zone =
            selectedZone();

        const method =
            getDeliveryMethod();

        let deliveryFee = 0;

        if (zone) {

            deliveryFee =
                method === "office"
                    ? Number(
                        zone.office_fee || 0
                    )
                    : Number(
                        zone.home_fee || 0
                    );
        }

        const total =
            subtotal +
            deliveryFee;

        const subtotalElement =
            $("#checkout-subtotal");

        const deliveryElement =
            $("#checkout-delivery");

        const totalElement =
            $("#checkout-total");

        if (subtotalElement) {
            subtotalElement.textContent =
                formatPrice(
                    subtotal
                );
        }

        if (deliveryElement) {
            deliveryElement.textContent =
                formatPrice(
                    deliveryFee
                );
        }

        if (totalElement) {
            totalElement.textContent =
                formatPrice(
                    total
                );
        }
    }

    function renderCheckoutItems() {

        const target =
            $("#checkout-items");

        if (!target) {
            return;
        }

        const cart =
            getCart();

        if (!cart.length) {

            target.innerHTML = `
                <div class="checkout-empty">
                    السلة فارغة.
                </div>
            `;

            return;
        }

        target.innerHTML =
            cart
                .map(item => {

                    const product =
                        products.find(
                            p =>
                                String(p.id) ===
                                String(item.product_id)
                        );

                    if (!product) {
                        return "";
                    }

                    const name =
                        localized(
                            product,
                            "name"
                        );

                    const image =
                        productImage(
                            product
                        );

                    const quantity =
                        Number(
                            item.quantity || 1
                        );

                    return `

                        <div class="checkout-item">

                            ${
                                image
                                    ? `
                                        <img
                                            class="checkout-item-image"
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(name)}"
                                        >
                                    `
                                    : ""
                            }

                            <div class="checkout-item-info">

                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <div>
                                    ${quantity} ×
                                    ${formatPrice(product.price)}
                                </div>

                            </div>

                        </div>
                    `;

                })
                .join("");
    }

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

        for (
            const cartItem of cart
        ) {

            const product =
                products.find(
                    p =>
                        String(p.id) ===
                        String(
                            cartItem.product_id
                        )
                );

            if (!product) {

                return {
                    valid: false,
                    message:
                        "أحد المنتجات لم يعد متاحًا.",
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
                        "كمية المنتج غير صحيحة.",
                    items: []
                };
            }

            if (
                quantity >
                Number(product.stock || 0)
            ) {

                return {
                    valid: false,
                    message:
                        `الكمية المطلوبة من "${localized(product, "name")}" غير متوفرة.`,
                    items: []
                };
            }

            items.push({
                product_id:
                    Number(product.id),
                quantity:
                    quantity
            });
        }

        return {
            valid: true,
            items
        };
    }

    async function submitOrder(
        event
    ) {

        event.preventDefault();

        hideCheckoutMessage();

        const input =
            getCheckoutInputs();

        if (!input.form) {
            return;
        }

        const nameResult =
            validateName(
                input.name?.value
            );

        if (!nameResult.valid) {

            showCheckoutMessage(
                nameResult.message
            );

            input.name?.focus();

            return;
        }

        const phoneResult =
            validatePhone(
                input.phone?.value
            );

        if (!phoneResult.valid) {

            showCheckoutMessage(
                phoneResult.message
            );

            input.phone?.focus();

            return;
        }

        const emailResult =
            validateEmail(
                input.email?.value
            );

        if (!emailResult.valid) {

            showCheckoutMessage(
                emailResult.message
            );

            input.email?.focus();

            return;
        }

        const zone =
            selectedZone();

        if (!zone) {

            showCheckoutMessage(
                "اختر الولاية من فضلك."
            );

            input.wilaya?.focus();

            return;
        }

        const deliveryMethod =
            getDeliveryMethod();

        const address =
            normalizeText(
                input.address?.value
            );

        if (
            deliveryMethod === "home" &&
            address.length < 5
        ) {

            showCheckoutMessage(
                "أدخل عنوانًا صحيحًا للتوصيل إلى المنزل."
            );

            input.address?.focus();

            return;
        }

        const orderItems =
            buildOrderItems();

        if (!orderItems.valid) {

            showCheckoutMessage(
                orderItems.message
            );

            return;
        }

        const notes =
            normalizeText(
                input.notes?.value
            );

        const buttons =
            $$(
                "#checkout-form button[type='submit'], [data-submit-order]"
            );

        buttons.forEach(
            button => {

                button.disabled =
                    true;

                button.dataset.originalText =
                    button.textContent;

                button.textContent =
                    "جاري إرسال الطلب...";

            }
        );

        try {

            const {
                data,
                error
            } = await db.rpc(
                "place_order",
                {
                    p_address:
                        deliveryMethod === "home"
                            ? address
                            : "",

                    p_customer_email:
                        emailResult.value,

                    p_customer_name:
                        nameResult.value,

                    p_customer_phone:
                        phoneResult.value,

                    p_delivery_method:
                        deliveryMethod,

                    p_items:
                        orderItems.items,

                    p_notes:
                        notes,

                    p_wilaya_code:
                        String(
                            zone.wilaya_code
                        )
                }
            );

            if (error) {

                console.error(
                    "place_order error:",
                    error
                );

                showCheckoutMessage(
                    error.message ||
                    "تعذر إنشاء الطلب."
                );

                return;
            }

            if (
                !data ||
                data.success !== true
            ) {

                console.error(
                    "Invalid order response:",
                    data
                );

                showCheckoutMessage(
                    "لم يتم إنشاء الطلب."
                );

                return;
            }

            localStorage.setItem(
                LAST_ORDER_KEY,
                JSON.stringify(data)
            );

            clearCart();

            window.location.href =
                "order-success.html";

        } catch (error) {

            console.error(
                "Checkout exception:",
                error
            );

            showCheckoutMessage(
                error.message ||
                "حدث خطأ غير متوقع."
            );

        } finally {

            buttons.forEach(
                button => {

                    button.disabled =
                        false;

                    button.textContent =
                        button.dataset.originalText ||
                        "تأكيد الطلب";

                }
            );
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    function setupEvents() {

        document.addEventListener(
            "click",
            event => {

                const add =
                    event.target.closest(
                        "[data-add-to-cart]"
                    );

                if (add) {

                    addToCart(
                        add.dataset.addToCart
                    );

                    return;
                }

                const productAdd =
                    event.target.closest(
                        "[data-product-add]"
                    );

                if (productAdd) {

                    const quantity =
                        Number(
                            $(
                                "#product-quantity"
                            )?.value || 1
                        );

                    addToCart(
                        productAdd.dataset.productAdd,
                        quantity
                    );

                    return;
                }

                const remove =
                    event.target.closest(
                        "[data-cart-remove]"
                    );

                if (remove) {

                    removeCartItem(
                        remove.dataset.cartRemove
                    );

                    return;
                }

                const minus =
                    event.target.closest(
                        "[data-cart-minus]"
                    );

                if (minus) {

                    const item =
                        getCart().find(
                            entry =>
                                String(
                                    entry.product_id
                                ) ===
                                String(
                                    minus.dataset.cartMinus
                                )
                        );

                    if (item) {

                        updateCartItem(
                            item.product_id,
                            Number(
                                item.quantity
                            ) - 1
                        );
                    }

                    return;
                }

                const plus =
                    event.target.closest(
                        "[data-cart-plus]"
                    );

                if (plus) {

                    const item =
                        getCart().find(
                            entry =>
                                String(
                                    entry.product_id
                                ) ===
                                String(
                                    plus.dataset.cartPlus
                                )
                        );

                    if (item) {

                        updateCartItem(
                            item.product_id,
                            Number(
                                item.quantity
                            ) + 1
                        );
                    }
                }
            }
        );

        document.addEventListener(
            "change",
            event => {

                const quantity =
                    event.target.closest(
                        "[data-cart-quantity]"
                    );

                if (quantity) {

                    updateCartItem(
                        quantity.dataset.cartQuantity,
                        Number(
                            quantity.value
                        )
                    );

                    return;
                }

                if (
                    event.target.matches(
                        "#wilaya, #delivery-method"
                    )
                ) {

                    updateCheckoutTotal();

                    if (
                        event.target.id ===
                        "delivery-method"
                    ) {
                        toggleAddress();
                    }
                }
            }
        );

        const checkout =
            $(
                "#checkout-form, #order-form"
            );

        if (checkout) {

            checkout.addEventListener(
                "submit",
                submitOrder
            );
        }
    }

    function toggleAddress() {

        const method =
            getDeliveryMethod();

        const group =
            $("#address-group");

        const address =
            $("#address");

        if (!group) {
            return;
        }

        if (method === "home") {

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

                address.value = "";
            }
        }
    }

    /* =====================================================
       REALTIME
    ===================================================== */

    function setupRealtime() {

        if (!db) {
            return;
        }

        db
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

                        renderProducts();
                        renderFeatured();
                        renderCart();
                        renderCheckoutItems();
                        updateCheckoutTotal();

                    } catch (error) {

                        console.error(
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

                        renderProducts();
                        renderFeatured();
                        renderCart();
                        renderCheckoutItems();

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "Realtime:",
                        status
                    );
                }
            );
    }

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        try {

            initializeDatabase();

            await loadProducts();

            await loadCategories();

            await loadDeliveryZones();

            updateCartCount();

            renderProducts();

            renderFeatured();

            renderCart();

            await renderProductDetails();

            if ($("#wilaya")) {

                renderWilayas();

                renderCheckoutItems();

                updateCheckoutTotal();

                toggleAddress();
            }

            setupEvents();

            setupRealtime();

        } catch (error) {

            console.error(
                "Atelier Noura initialization error:",
                error
            );

            const detail =
                $("#productDetail");

            if (detail) {

                detail.innerHTML = `
                    <div class="empty-state">
                        حدث خطأ في الاتصال بقاعدة البيانات.
                        <br>
                        ${escapeHTML(
                            error.message
                        )}
                    </div>
                `;
            }
        }
    }

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

})();
