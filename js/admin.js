/* =========================================================
   Atelier Noura
   File: js/admin.js
========================================================= */

(function () {

    "use strict";

    let db = null;
    let products = [];
    let categories = [];
    let currentTab = "overview";

    const statuses = [
        "new",
        "confirmed",
        "preparing",
        "shipped",
        "delivered",
        "cancelled"
    ];

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {

        return (
            Number(value || 0)
                .toLocaleString("fr-DZ") +
            " DA"
        );
    }

    function showMessage(
        element,
        message,
        error = false
    ) {

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.style.background =
            error
                ? "#f8e4df"
                : "#eee8df";

        element.classList.add(
            "show"
        );
    }

    function slugify(value) {

        const text =
            String(value || "")
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(
                    /[\u0300-\u036f]/g,
                    ""
                )
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );

        return (
            text ||
            "product"
        );
    }

    function productSlug(
        name,
        existingId = ""
    ) {

        const base =
            slugify(name);

        if (existingId) {
            return base;
        }

        return (
            base +
            "-" +
            Date.now()
        );
    }

    /* =====================================================
       AUTH
    ===================================================== */

    async function checkOwner() {

        const {
            data: {
                session
            }
        } =
            await db.auth.getSession();

        if (!session) {
            showLogin();
            return false;
        }

        const {
            data: profile,
            error
        } = await db
            .from("profiles")
            .select(
                "id,full_name,role"
            )
            .eq(
                "id",
                session.user.id
            )
            .maybeSingle();

        if (
            error ||
            !profile ||
            profile.role !== "owner"
        ) {

            await db.auth.signOut();

            showLogin();

            showMessage(
                $("loginMessage"),
                "هذا الحساب ليس حساب مالك.",
                true
            );

            return false;
        }

        $("ownerEmail").textContent =
            session.user.email || "";

        $("loginView").style.display =
            "none";

        $("dashboardView").style.display =
            "grid";

        $("logoutBtn").style.display =
            "inline-block";

        return true;
    }

    function showLogin() {

        $("loginView").style.display =
            "block";

        $("dashboardView").style.display =
            "none";

        $("logoutBtn").style.display =
            "none";
    }

    async function login(
        event
    ) {

        event.preventDefault();

        const email =
            $("loginEmail")
                .value
                .trim();

        const password =
            $("loginPassword")
                .value;

        showMessage(
            $("loginMessage"),
            "جاري تسجيل الدخول..."
        );

        const {
            error
        } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) {

            showMessage(
                $("loginMessage"),
                error.message,
                true
            );

            return;
        }

        const owner =
            await checkOwner();

        if (owner) {
            await startDashboard();
        }
    }

    async function logout() {

        await db.auth.signOut();

        location.reload();
    }

    /* =====================================================
       DATA
    ===================================================== */

    async function loadCategories() {

        const {
            data,
            error
        } = await db
            .from("categories")
            .select("*")
            .order(
                "sort_order",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        categories =
            data || [];
    }

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
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        products =
            data || [];
    }

    function imageUrl(
        path
    ) {

        if (!path) {
            return "";
        }

        if (
            path.startsWith("http")
        ) {
            return path;
        }

        return db.storage
            .from("product-media")
            .getPublicUrl(path)
            .data.publicUrl;
    }

    /* =====================================================
       OVERVIEW
    ===================================================== */

    async function renderOverview() {

        await loadProducts();

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

        if (orderError) {
            throw orderError;
        }

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
            .eq(
                "status",
                "new"
            );

        if (newError) {
            throw newError;
        }

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>

                    <span class="eyebrow">
                        ATELIER NOURA
                    </span>

                    <h1>
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

            <div class="admin-card">

                <h2>
                    لوحة التحكم
                </h2>

                <p>
                    من هنا يمكنك إدارة المنتجات
                    والأسعار والمخزون والصور
                    والطلبات والتوصيل.
                </p>

            </div>
        `;
    }

    /* =====================================================
       PRODUCTS
    ===================================================== */

    function productRow(
        product
    ) {

        const image =
            product.cover_image
                ? imageUrl(
                    product.cover_image
                )
                : imageUrl(
                    product.product_images?.find(
                        x => x.is_cover
                    )?.storage_path ||
                    product.product_images?.[0]
                        ?.storage_path
                );

        const category =
            product.categories
                ?.name_ar ||
            "بدون تصنيف";

        return `

            <div
                class="product-admin-row"
                data-product-row
                data-search="${escapeHTML(
                    (
                        product.name_ar +
                        " " +
                        product.name_fr +
                        " " +
                        product.name_en +
                        " " +
                        category
                    ).toLowerCase()
                )}"
            >

                <div class="admin-thumb">

                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt=""
                                >
                            `
                            : "AN"
                    }

                </div>

                <div>

                    <strong>
                        ${escapeHTML(
                            product.name_ar
                        )}
                    </strong>

                    <div>
                        ${escapeHTML(category)}
                    </div>

                    <small>
                        ${money(product.price)}
                        ·
                        المخزون:
                        ${product.stock}
                    </small>

                </div>

                <div class="admin-actions">

                    <label class="upload-label">

                        صورة

                        <input
                            type="file"
                            accept="image/*,video/*"
                            data-upload-media="${product.id}"
                        >

                    </label>

                    <button
                        type="button"
                        data-edit-product="${product.id}"
                    >
                        تعديل
                    </button>

                    <button
                        type="button"
                        data-delete-product="${product.id}"
                    >
                        حذف
                    </button>

                </div>

            </div>
        `;
    }

    async function renderProducts() {

        await loadProducts();

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>

                    <span class="eyebrow">
                        CATALOG
                    </span>

                    <h1>
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
                    id="productSearch"
                    placeholder="ابحث عن منتج..."
                    style="
                        width:100%;
                        box-sizing:border-box;
                        padding:13px;
                        border:1px solid #ddd4cb;
                        border-radius:12px;
                        margin-bottom:15px;
                    "
                >

                <div id="productList">

                    ${
                        products.length
                            ? products
                                .map(productRow)
                                .join("")
                            : `
                                <div class="empty-admin">
                                    لا توجد منتجات.
                                </div>
                            `
                    }

                </div>

            </div>
        `;

        $("productSearch")
            ?.addEventListener(
                "input",
                event => {

                    const query =
                        event.target.value
                            .trim()
                            .toLowerCase();

                    document
                        .querySelectorAll(
                            "[data-product-row]"
                        )
                        .forEach(
                            row => {

                                row.style.display =
                                    row.dataset.search
                                        .includes(query)
                                        ? "grid"
                                        : "none";
                            }
                        );
                }
            );
    }

    /* =====================================================
       PRODUCT MODAL
    ===================================================== */

    async function openProductModal(
        product = null
    ) {

        await loadCategories();

        $("productId").value =
            product?.id || "";

        $("nameAr").value =
            product?.name_ar || "";

        $("nameFr").value =
            product?.name_fr || "";

        $("nameEn").value =
            product?.name_en || "";

        $("price").value =
            product?.price ?? "";

        $("stock").value =
            product?.stock ?? 0;

        $("descAr").value =
            product?.description_ar || "";

        $("descFr").value =
            product?.description_fr || "";

        $("descEn").value =
            product?.description_en || "";

        $("featured").checked =
            Boolean(
                product?.is_featured
            );

        $("active").checked =
            product
                ? Boolean(
                    product.is_active
                )
                : true;

        $("categoryId").innerHTML =
            categories
                .map(
                    category => `

                        <option
                            value="${category.id}"
                            ${
                                product &&
                                String(
                                    product.category_id
                                ) ===
                                String(
                                    category.id
                                )
                                    ? "selected"
                                    : ""
                            }
                        >
                            ${escapeHTML(
                                category.name_ar
                            )}
                        </option>

                    `
                )
                .join("");

        $("productModalTitle")
            .textContent =
            product
                ? "تعديل المنتج"
                : "إضافة منتج";

        $("productModal")
            .classList.add(
                "open"
            );

        $("productMessage")
            .classList.remove(
                "show"
            );
    }

    function closeProductModal() {

        $("productModal")
            .classList.remove(
                "open"
            );
    }

    async function saveProduct(
        event
    ) {

        event.preventDefault();

        const id =
            $("productId").value;

        const nameAr =
            $("nameAr")
                .value
                .trim();

        const nameFr =
            $("nameFr")
                .value
                .trim() ||
            nameAr;

        const nameEn =
            $("nameEn")
                .value
                .trim() ||
            nameAr;

        const price =
            Number(
                $("price").value
            );

        const stock =
            Number(
                $("stock").value
            );

        const categoryId =
            $("categoryId").value;

        if (!nameAr) {

            showMessage(
                $("productMessage"),
                "اسم المنتج مطلوب.",
                true
            );

            return;
        }

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {

            showMessage(
                $("productMessage"),
                "السعر غير صحيح.",
                true
            );

            return;
        }

        if (
            !Number.isInteger(stock) ||
            stock < 0
        ) {

            showMessage(
                $("productMessage"),
                "المخزون غير صحيح.",
                true
            );

            return;
        }

        if (!categoryId) {

            showMessage(
                $("productMessage"),
                "اختر التصنيف.",
                true
            );

            return;
        }

        const payload = {

            category_id:
                Number(categoryId),

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
                $("active").checked,

            updated_at:
                new Date().toISOString()

        };

        if (!id) {

            payload.slug =
                productSlug(
                    nameEn
                );
        }

        const query =
            id

                ? db
                    .from("products")
                    .update(payload)
                    .eq(
                        "id",
                        Number(id)
                    )

                : db
                    .from("products")
                    .insert(
                        payload
                    );

        const {
            error
        } = await query;

        if (error) {

            console.error(
                error
            );

            showMessage(
                $("productMessage"),
                error.message,
                true
            );

            return;
        }

        closeProductModal();

        await renderProducts();
    }

    async function deleteProduct(
        id
    ) {

        if (
            !confirm(
                "هل تريد حذف هذا المنتج؟"
            )
        ) {
            return;
        }

        const {
            error
        } = await db
            .from("products")
            .delete()
            .eq(
                "id",
                Number(id)
            );

        if (error) {

            alert(
                error.message
            );

            return;
        }

        await renderProducts();
    }

    /* =====================================================
       MEDIA
    ===================================================== */

    async function uploadMedia(
        productId,
        file
    ) {

        if (!file) {
            return;
        }

        const isVideo =
            file.type.startsWith(
                "video/"
            );

        const allowed =
            file.type.startsWith(
                "image/"
            ) ||
            isVideo;

        if (!allowed) {

            alert(
                "اختر صورة أو فيديو."
            );

            return;
        }

        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();

        const path =
            `products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

        const {
            error: uploadError
        } = await db.storage
            .from("product-media")
            .upload(
                path,
                file,
                {
                    upsert: false,
                    contentType:
                        file.type
                }
            );

        if (uploadError) {

            alert(
                uploadError.message
            );

            return;
        }

        const {
            error
        } = await db
            .from("product_images")
            .insert({

                product_id:
                    Number(productId),

                storage_path:
                    path,

                media_type:
                    isVideo
                        ? "video"
                        : "image",

                alt_text:
                    file.name,

                sort_order:
                    0,

                is_cover:
                    !isVideo

            });

        if (error) {

            alert(
                error.message
            );

            return;
        }

        if (!isVideo) {

            await db
                .from("products")
                .update({
                    cover_image:
                        path,
                    updated_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "id",
                    Number(productId)
                );
        }

        alert(
            "تم رفع الملف بنجاح."
        );

        await renderProducts();
    }

    /* =====================================================
       ORDERS
    ===================================================== */

    async function renderOrders() {

        const {
            data,
            error
        } = await db
            .from("orders")
            .select(`
                *,
                order_items (
                    id,
                    product_id,
                    product_name,
                    unit_price,
                    quantity,
                    line_total
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>

                    <span class="eyebrow">
                        CUSTOMER ORDERS
                    </span>

                    <h1>
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
                                <th>المنتجات</th>
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
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        async event => {

                            const id =
                                event.target
                                    .dataset
                                    .orderStatus;

                            const status =
                                event.target
                                    .value;

                            const {
                                error
                            } = await db
                                .from(
                                    "orders"
                                )
                                .update({
                                    status,
                                    updated_at:
                                        new Date()
                                            .toISOString()
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

                            showToast(
                                "تم تحديث حالة الطلب."
                            );
                        }
                    );
                }
            );
    }

    function orderRow(
        order
    ) {

        const items =
            (order.order_items || [])
                .map(
                    item =>
                        `
                            <div>
                                ${escapeHTML(
                                    item.product_name ||
                                    "Product"
                                )}
                                ×
                                ${item.quantity}
                            </div>
                        `
                )
                .join("");

        const method =
            order.delivery_method ===
            "home"
                ? "المنزل"
                : "مكتب التوصيل";

        return `

            <tr>

                <td>
                    <strong>
                        ${escapeHTML(
                            order.order_number
                        )}
                    </strong>

                    <br>

                    <small>
                        ${new Date(
                            order.created_at
                        ).toLocaleString("fr-DZ")}
                    </small>
                </td>

                <td>

                    <strong>
                        ${escapeHTML(
                            order.customer_name
                        )}
                    </strong>

                    <br>

                    📞
                    ${escapeHTML(
                        order.customer_phone ||
                        order.phone
                    )}

                    <br>

                    ${
                        order.customer_email
                            ? `
                                ✉
                                ${escapeHTML(
                                    order.customer_email
                                )}
                            `
                            : `
                                <small>
                                    لا يوجد بريد
                                </small>
                            `
                    }

                </td>

                <td>

                    ${escapeHTML(
                        method
                    )}

                    <br>

                    ${escapeHTML(
                        order.wilaya_name ||
                        order.wilaya ||
                        ""
                    )}

                    ${
                        order.address
                            ? `
                                <br>
                                ${escapeHTML(
                                    order.address
                                )}
                            `
                            : ""
                    }

                </td>

                <td>
                    ${items}
                </td>

                <td>

                    <strong>
                        ${money(
                            order.total
                        )}
                    </strong>

                    <br>

                    <small>
                        المنتجات:
                        ${money(
                            order.subtotal
                        )}

                        <br>

                        التوصيل:
                        ${money(
                            order.delivery_fee
                        )}
                    </small>

                </td>

                <td>

                    <select
                        class="status-select"
                        data-order-status="${order.id}"
                    >

                        ${statuses
                            .map(
                                status =>
                                    `
                                        <option
                                            value="${status}"
                                            ${
                                                status ===
                                                order.status
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            ${status}
                                        </option>
                                    `
                            )
                            .join("")}

                    </select>

                </td>

            </tr>
        `;
    }

    /* =====================================================
       DELIVERY
    ===================================================== */

    async function renderDelivery() {

        const {
            data,
            error
        } = await db
            .from(
                "delivery_zones"
            )
            .select("*")
            .order(
                "wilaya_code",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>
                    <span class="eyebrow">
                        DELIVERY
                    </span>

                    <h1>
                        Delivery Zones
                    </h1>
                </div>

            </div>

            <div class="admin-card">

                <div class="admin-table-wrap">

                    <table class="admin-table">

                        <thead>

                            <tr>
                                <th>الكود</th>
                                <th>الولاية</th>
                                <th>Home</th>
                                <th>Office</th>
                                <th>حالة</th>
                                <th></th>
                            </tr>

                        </thead>

                        <tbody>

                            ${
                                data
                                    ?.map(
                                        zone =>
                                            `
                                                <tr>

                                                    <td>
                                                        ${escapeHTML(
                                                            zone.wilaya_code
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${escapeHTML(
                                                            zone.wilaya_name_ar ||
                                                            zone.wilaya
                                                        )}
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value="${zone.home_fee}"
                                                            data-home-fee="${zone.id}"
                                                        >
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value="${zone.office_fee}"
                                                            data-office-fee="${zone.id}"
                                                        >
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            ${
                                                                zone.is_active
                                                                    ? "checked"
                                                                    : ""
                                                            }
                                                            data-zone-active="${zone.id}"
                                                        >
                                                    </td>

                                                    <td>
                                                        <button
                                                            class="admin-primary"
                                                            data-save-zone="${zone.id}"
                                                        >
                                                            حفظ
                                                        </button>
                                                    </td>

                                                </tr>
                                            `
                                    )
                                    .join("") ||
                                ""
                            }

                        </tbody>

                    </table>

                </div>

            </div>
        `;

        document
            .querySelectorAll(
                "[data-save-zone]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const id =
                                button.dataset
                                    .saveZone;

                            const home =
                                document.querySelector(
                                    `[data-home-fee="${id}"]`
                                );

                            const office =
                                document.querySelector(
                                    `[data-office-fee="${id}"]`
                                );

                            const active =
                                document.querySelector(
                                    `[data-zone-active="${id}"]`
                                );

                            const {
                                error
                            } = await db
                                .from(
                                    "delivery_zones"
                                )
                                .update({

                                    home_fee:
                                        Number(
                                            home.value
                                        ),

                                    office_fee:
                                        Number(
                                            office.value
                                        ),

                                    is_active:
                                        active.checked

                                })
                                .eq(
                                    "id",
                                    Number(id)
                                );

                            if (error) {

                                alert(
                                    error.message
                                );

                                return;
                            }

                            showToast(
                                "تم حفظ التوصيل."
                            );
                        }
                    );
                }
            );
    }

    /* =====================================================
       MEDIA
    ===================================================== */

    async function renderMedia() {

        await loadProducts();

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>

                    <span class="eyebrow">
                        MEDIA
                    </span>

                    <h1>
                        الصور والفيديو
                    </h1>

                </div>

            </div>

            <div class="admin-card">

                <p>
                    يمكنك رفع صورة أو فيديو لكل منتج
                    من قائمة المنتجات.
                </p>

                ${
                    products
                        .map(
                            product =>
                                `
                                    <div
                                        style="
                                            padding:15px 0;
                                            border-bottom:1px solid #eee5de;
                                        "
                                    >

                                        <strong>
                                            ${escapeHTML(
                                                product.name_ar
                                            )}
                                        </strong>

                                        <label
                                            class="upload-label"
                                            style="
                                                margin-right:15px;
                                            "
                                        >
                                            رفع ملف

                                            <input
                                                type="file"
                                                accept="image/*,video/*"
                                                data-upload-media="${product.id}"
                                            >
                                        </label>

                                    </div>
                                `
                        )
                        .join("")
                }

            </div>
        `;
    }

    /* =====================================================
       SETTINGS
    ===================================================== */

    async function renderSettings() {

        $("adminApp").innerHTML = `

            <div class="admin-toolbar">

                <div>

                    <span class="eyebrow">
                        SETTINGS
                    </span>

                    <h1>
                        Settings
                    </h1>

                </div>

            </div>

            <div class="admin-card">

                <h2>
                    Atelier Noura
                </h2>

                <p>
                    Owner Studio متصل بقاعدة بيانات
                    Supabase.
                </p>

                <p>
                    البريد الإلكتروني اختياري للعميل،
                    بينما الاسم والهاتف والولاية
                    مطلوبة لإرسال الطلب.
                </p>

            </div>
        `;
    }

    /* =====================================================
       TABS
    ===================================================== */

    async function renderTab(
        tab
    ) {

        currentTab =
            tab;

        document
            .querySelectorAll(
                ".admin-tab"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.tab ===
                        tab
                    );
                }
            );

        $("adminApp").innerHTML = `
            <div class="empty-admin">
                جاري التحميل...
            </div>
        `;

        try {

            if (
                tab ===
                "overview"
            ) {
                await renderOverview();
            }

            if (
                tab ===
                "products"
            ) {
                await renderProducts();
            }

            if (
                tab ===
                "orders"
            ) {
                await renderOrders();
            }

            if (
                tab ===
                "delivery"
            ) {
                await renderDelivery();
            }

            if (
                tab ===
                "media"
            ) {
                await renderMedia();
            }

            if (
                tab ===
                "settings"
            ) {
                await renderSettings();
            }

        } catch (error) {

            console.error(
                error
            );

            $("adminApp").innerHTML = `

                <div class="admin-card">

                    <h2>
                        حدث خطأ
                    </h2>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>
            `;
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    function setupEvents() {

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

        document.addEventListener(
            "click",
            async event => {

                const tab =
                    event.target.closest(
                        "[data-tab]"
                    );

                if (
                    tab &&
                    tab.classList.contains(
                        "admin-tab"
                    )
                ) {

                    await renderTab(
                        tab.dataset.tab
                    );

                    return;
                }

                const open =
                    event.target.closest(
                        "[data-open-product]"
                    );

                if (open) {

                    await openProductModal();

                    return;
                }

                const close =
                    event.target.closest(
                        "[data-close-modal]"
                    );

                if (close) {

                    closeProductModal();

                    return;
                }

                const edit =
                    event.target.closest(
                        "[data-edit-product]"
                    );

                if (edit) {

                    const product =
                        products.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    edit.dataset
                                        .editProduct
                                )
                        );

                    if (product) {
                        await openProductModal(
                            product
                        );
                    }

                    return;
                }

                const remove =
                    event.target.closest(
                        "[data-delete-product]"
                    );

                if (remove) {

                    await deleteProduct(
                        remove.dataset
                            .deleteProduct
                    );

                    return;
                }

                const refresh =
                    event.target.closest(
                        "[data-refresh-orders]"
                    );

                if (refresh) {

                    await renderTab(
                        "orders"
                    );

                    return;
                }

                const go =
                    event.target.closest(
                        "[data-tab-go]"
                    );

                if (go) {

                    await renderTab(
                        go.dataset.tabGo
                    );
                }
            }
        );

        document.addEventListener(
            "change",
            async event => {

                const upload =
                    event.target.closest(
                        "[data-upload-media]"
                    );

                if (
                    upload &&
                    upload.files?.[0]
                ) {

                    await uploadMedia(
                        upload.dataset
                            .uploadMedia,
                        upload.files[0]
                    );
                }
            }
        );
    }

    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(
        message
    ) {

        alert(message);
    }

    /* =====================================================
       REALTIME
    ===================================================== */

    function setupRealtime() {

        db
            .channel(
                "atelier-noura-admin"
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders"
                },
                async () => {

                    if (
                        currentTab ===
                        "orders"
                    ) {
                        await renderOrders();
                    }

                    if (
                        currentTab ===
                        "overview"
                    ) {
                        await renderOverview();
                    }

                    showToast(
                        "تم تحديث الطلبات."
                    );
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

                    await loadProducts();

                    if (
                        currentTab ===
                        "products"
                    ) {
                        await renderProducts();
                    }
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "Admin realtime:",
                        status
                    );
                }
            );
    }

    /* =====================================================
       START
    ===================================================== */

    async function startDashboard() {

        await loadCategories();

        await loadProducts();

        await renderTab(
            "overview"
        );

        setupRealtime();
    }

    async function initialize() {

        try {

            db =
                initSupabase();

            setupEvents();

            const owner =
                await checkOwner();

            if (owner) {

                await startDashboard();
            }

        } catch (error) {

            console.error(
                error
            );

            showMessage(
                $("loginMessage"),
                error.message,
                true
            );
        }
    }

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

})();
