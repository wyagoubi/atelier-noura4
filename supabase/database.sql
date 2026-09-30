/* =========================================================
   ATELIER NOURA
   FINAL DATABASE FIX
   Compatible with current bigint product schema
   ========================================================= */

create extension if not exists pgcrypto;


/* =========================================================
   1. CATEGORIES
========================================================= */

alter table public.categories
    add column if not exists description_ar text;

alter table public.categories
    add column if not exists description_fr text;

alter table public.categories
    add column if not exists description_en text;

alter table public.categories
    add column if not exists image_url text;

alter table public.categories
    add column if not exists sort_order integer
    not null default 0;

alter table public.categories
    add column if not exists is_active boolean
    not null default true;


/* =========================================================
   2. PRODUCTS
========================================================= */

alter table public.products
    add column if not exists slug text;

alter table public.products
    add column if not exists compare_at_price numeric(12,2);

alter table public.products
    add column if not exists cover_image text;

alter table public.products
    add column if not exists sku text;

alter table public.products
    add column if not exists updated_at timestamptz
    not null default now();


update public.products
set slug =
    'product-' || id::text
where slug is null
   or trim(slug) = '';


create unique index if not exists
    products_slug_unique_idx
on public.products(slug);


/* =========================================================
   3. PRODUCT IMAGES
========================================================= */

alter table public.product_images
    add column if not exists media_type text
    not null default 'image';

alter table public.product_images
    add column if not exists alt_text text;

alter table public.product_images
    drop constraint if exists product_images_media_type_check;

alter table public.product_images
    add constraint product_images_media_type_check
    check (
        media_type in ('image','video')
    );


/* =========================================================
   4. DELIVERY
========================================================= */

alter table public.delivery_zones
    add column if not exists wilaya_code text;

alter table public.delivery_zones
    add column if not exists wilaya_name_ar text;

alter table public.delivery_zones
    add column if not exists wilaya_name_fr text;

alter table public.delivery_zones
    add column if not exists wilaya_name_en text;


/*
   Existing rows receive their old wilaya value
   as the Arabic display name.
*/

update public.delivery_zones
set wilaya_code =
    coalesce(
        nullif(wilaya_code,''),
        id::text
    )
where wilaya_code is null
   or trim(wilaya_code) = '';


update public.delivery_zones
set wilaya_name_ar =
    coalesce(
        nullif(wilaya_name_ar,''),
        wilaya
    )
where wilaya_name_ar is null
   or trim(wilaya_name_ar) = '';


update public.delivery_zones
set wilaya_name_fr =
    coalesce(
        nullif(wilaya_name_fr,''),
        wilaya_name_ar
    )
where wilaya_name_fr is null
   or trim(wilaya_name_fr) = '';


update public.delivery_zones
set wilaya_name_en =
    coalesce(
        nullif(wilaya_name_en,''),
        wilaya_name_ar
    )
where wilaya_name_en is null
   or trim(wilaya_name_en) = '';


create index if not exists
    delivery_zones_code_idx
on public.delivery_zones(wilaya_code);


/* =========================================================
   5. ORDERS
========================================================= */

alter table public.orders
    add column if not exists customer_email text;

alter table public.orders
    add column if not exists customer_phone text;

alter table public.orders
    add column if not exists wilaya_code text;

alter table public.orders
    add column if not exists wilaya_name text;

alter table public.orders
    add column if not exists updated_at timestamptz
    not null default now();


/*
   Keep old columns compatible with existing data.
*/

update public.orders
set customer_phone =
    coalesce(
        customer_phone,
        phone
    )
where customer_phone is null;


update public.orders
set wilaya_code =
    coalesce(
        wilaya_code,
        wilaya
    )
where wilaya_code is null;


update public.orders
set wilaya_name =
    coalesce(
        wilaya_name,
        wilaya
    )
where wilaya_name is null;


/* =========================================================
   6. ORDER ITEMS
========================================================= */

alter table public.order_items
    add column if not exists product_name text;

alter table public.order_items
    add column if not exists line_total numeric(12,2);


update public.order_items oi
set
    product_name =
        coalesce(
            oi.product_name,
            p.name_ar,
            p.name_en,
            p.name_fr,
            'Product'
        ),

    line_total =
        coalesce(
            oi.line_total,
            oi.unit_price * oi.quantity
        )

from public.products p
where p.id = oi.product_id;


/* =========================================================
   7. OWNER FUNCTION
========================================================= */

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
        and role = 'owner'
    );
$$;


/* =========================================================
   8. FINAL PLACE ORDER FUNCTION
========================================================= */

drop function if exists public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
);


create or replace function public.place_order(
    p_address text,
    p_customer_email text,
    p_customer_name text,
    p_customer_phone text,
    p_delivery_method text,
    p_items jsonb,
    p_notes text,
    p_wilaya_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$

declare

    v_order_id uuid;

    v_order_number text;

    v_subtotal numeric(12,2) := 0;

    v_delivery_fee numeric(12,2) := 0;

    v_total numeric(12,2) := 0;

    v_wilaya_name text;

    v_item jsonb;

    v_product public.products%rowtype;

    v_product_id bigint;

    v_quantity integer;

    v_line_total numeric(12,2);

    v_zone public.delivery_zones%rowtype;

begin

    /* =====================================================
       NAME
    ===================================================== */

    if coalesce(
        trim(p_customer_name),
        ''
    ) = '' then

        raise exception
            'اسم العميل مطلوب';

    end if;


    if length(
        trim(p_customer_name)
    ) < 2 then

        raise exception
            'اسم العميل قصير جدًا';

    end if;


    /* =====================================================
       PHONE
    ===================================================== */

    if coalesce(
        trim(p_customer_phone),
        ''
    ) = '' then

        raise exception
            'رقم الهاتف مطلوب';

    end if;


    if trim(
        p_customer_phone
    ) !~ '^(0[567][0-9]{8}|\+213[567][0-9]{8})$' then

        raise exception
            'رقم الهاتف الجزائري غير صحيح';

    end if;


    /* =====================================================
       OPTIONAL EMAIL
    ===================================================== */

    if coalesce(
        trim(p_customer_email),
        ''
    ) <> '' then

        if trim(
            p_customer_email
        ) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then

            raise exception
                'البريد الإلكتروني غير صحيح';

        end if;

    end if;


    /* =====================================================
       DELIVERY METHOD
    ===================================================== */

    if p_delivery_method not in (
        'home',
        'office'
    ) then

        raise exception
            'طريقة التوصيل غير صحيحة';

    end if;


    /* =====================================================
       WILAYA
    ===================================================== */

    if coalesce(
        trim(p_wilaya_code),
        ''
    ) = '' then

        raise exception
            'الولاية مطلوبة';

    end if;


    select *
    into v_zone
    from public.delivery_zones
    where wilaya_code =
        trim(p_wilaya_code)
    and is_active = true
    limit 1;


    if not found then

        raise exception
            'الولاية غير متاحة للتوصيل';

    end if;


    v_wilaya_name =
        coalesce(
            v_zone.wilaya_name_ar,
            v_zone.wilaya,
            v_zone.wilaya_name_fr,
            v_zone.wilaya_name_en,
            ''
        );


    /* =====================================================
       DELIVERY FEE
    ===================================================== */

    if p_delivery_method = 'home' then

        v_delivery_fee =
            coalesce(
                v_zone.home_fee,
                0
            );

    else

        v_delivery_fee =
            coalesce(
                v_zone.office_fee,
                0
            );

    end if;


    /* =====================================================
       ADDRESS
    ===================================================== */

    if
        p_delivery_method = 'home'
        and length(
            trim(
                coalesce(
                    p_address,
                    ''
                )
            )
        ) < 5
    then

        raise exception
            'عنوان التوصيل مطلوب للتوصيل إلى المنزل';

    end if;


    /* =====================================================
       CART
    ===================================================== */

    if p_items is null then

        raise exception
            'السلة فارغة';

    end if;


    if jsonb_typeof(
        p_items
    ) <> 'array' then

        raise exception
            'بيانات المنتجات غير صحيحة';

    end if;


    if jsonb_array_length(
        p_items
    ) = 0 then

        raise exception
            'السلة فارغة';

    end if;


    /* =====================================================
       ORDER NUMBER
    ===================================================== */

    v_order_number =
        'AN-' ||
        upper(
            substr(
                replace(
                    gen_random_uuid()::text,
                    '-',
                    ''
                ),
                1,
                10
            )
        );


    /* =====================================================
       CREATE ORDER
    ===================================================== */

    insert into public.orders (

        order_number,

        customer_name,

        customer_email,

        phone,

        customer_phone,

        wilaya,

        wilaya_code,

        wilaya_name,

        delivery_method,

        address,

        notes,

        subtotal,

        delivery_fee,

        total,

        status,

        updated_at

    )

    values (

        v_order_number,

        trim(
            p_customer_name
        ),

        nullif(
            lower(
                trim(
                    coalesce(
                        p_customer_email,
                        ''
                    )
                )
            ),
            ''
        ),

        trim(
            p_customer_phone
        ),

        trim(
            p_customer_phone
        ),

        v_wilaya_name,

        trim(
            p_wilaya_code
        ),

        v_wilaya_name,

        p_delivery_method,

        case
            when p_delivery_method =
                'home'
            then
                trim(
                    coalesce(
                        p_address,
                        ''
                    )
                )
            else
                ''
        end,

        trim(
            coalesce(
                p_notes,
                ''
            )
        ),

        0,

        v_delivery_fee,

        0,

        'new',

        now()

    )

    returning id
    into v_order_id;


    /* =====================================================
       ORDER ITEMS
    ===================================================== */

    for v_item in
        select value
        from jsonb_array_elements(
            p_items
        )
    loop

        begin

            v_product_id =
                (
                    v_item
                    ->>
                    'product_id'
                )::bigint;

        exception
            when others then

                raise exception
                    'معرف المنتج غير صحيح';

        end;


        v_quantity =
            coalesce(
                (
                    v_item
                    ->>
                    'quantity'
                )::integer,
                0
            );


        if v_quantity <= 0 then

            raise exception
                'كمية المنتج غير صحيحة';

        end if;


        if v_quantity > 99 then

            raise exception
                'الكمية المطلوبة كبيرة جدًا';

        end if;


        select *
        into v_product
        from public.products
        where id = v_product_id
        for update;


        if not found then

            raise exception
                'أحد المنتجات غير موجود';

        end if;


        if not v_product.is_active then

            raise exception
                'أحد المنتجات غير متاح حاليًا';

        end if;


        if coalesce(
            v_product.stock,
            0
        ) < v_quantity then

            raise exception
                'الكمية المطلوبة غير متوفرة للمنتج: %',
                coalesce(
                    v_product.name_ar,
                    v_product.name_en,
                    v_product.name_fr,
                    'Product'
                );

        end if;


        v_line_total =
            round(
                coalesce(
                    v_product.price,
                    0
                )
                *
                v_quantity,
                2
            );


        v_subtotal =
            v_subtotal +
            v_line_total;


        insert into public.order_items (

            order_id,

            product_id,

            product_name,

            unit_price,

            quantity,

            line_total

        )

        values (

            v_order_id,

            v_product.id,

            coalesce(
                v_product.name_ar,
                v_product.name_en,
                v_product.name_fr,
                'Product'
            ),

            v_product.price,

            v_quantity,

            v_line_total

        );


        update public.products

        set
            stock =
                coalesce(
                    stock,
                    0
                )
                -
                v_quantity,

            updated_at =
                now()

        where id =
            v_product.id;

    end loop;


    /* =====================================================
       FINAL TOTAL
    ===================================================== */

    v_total =
        round(
            v_subtotal +
            v_delivery_fee,
            2
        );


    update public.orders

    set

        subtotal =
            v_subtotal,

        delivery_fee =
            v_delivery_fee,

        total =
            v_total,

        updated_at =
            now()

    where id =
        v_order_id;


    /* =====================================================
       RESPONSE
    ===================================================== */

    return jsonb_build_object(

        'success',
        true,

        'id',
        v_order_id,

        'order_number',
        v_order_number,

        'subtotal',
        v_subtotal,

        'delivery_fee',
        v_delivery_fee,

        'total',
        v_total,

        'wilaya_name',
        v_wilaya_name,

        'delivery_method',
        p_delivery_method,

        'status',
        'new'

    );

end;

$$;


/* =========================================================
   9. RPC PERMISSIONS
========================================================= */

revoke all on function public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
from public;


grant execute on function public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
to anon;


grant execute on function public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
to authenticated;


/* =========================================================
   10. RLS
========================================================= */

alter table public.profiles
    enable row level security;

alter table public.categories
    enable row level security;

alter table public.products
    enable row level security;

alter table public.product_images
    enable row level security;

alter table public.delivery_zones
    enable row level security;

alter table public.orders
    enable row level security;

alter table public.order_items
    enable row level security;


/* =========================================================
   11. REMOVE OLD POLICIES
========================================================= */

drop policy if exists
    "public read active categories"
on public.categories;

drop policy if exists
    "public read active products"
on public.products;

drop policy if exists
    "public read product images"
on public.product_images;

drop policy if exists
    "public read delivery zones"
on public.delivery_zones;

drop policy if exists
    "owner read all orders"
on public.orders;

drop policy if exists
    "owner update orders"
on public.orders;

drop policy if exists
    "owner read order items"
on public.order_items;

drop policy if exists
    "owner manage products"
on public.products;

drop policy if exists
    "owner manage categories"
on public.categories;

drop policy if exists
    "owner manage product images"
on public.product_images;

drop policy if exists
    "owner manage delivery"
on public.delivery_zones;

drop policy if exists
    "owner read profiles"
on public.profiles;


/* =========================================================
   12. PUBLIC CATALOG POLICIES
========================================================= */

create policy
    "public read active categories"
on public.categories

for select

to anon, authenticated

using (
    is_active = true
);


create policy
    "public read active products"
on public.products

for select

to anon, authenticated

using (
    is_active = true
);


create policy
    "public read product images"
on public.product_images

for select

to anon, authenticated

using (true);


create policy
    "public read delivery zones"
on public.delivery_zones

for select

to anon, authenticated

using (
    is_active = true
);


/* =========================================================
   13. OWNER POLICIES
========================================================= */

create policy
    "owner read all orders"
on public.orders

for select

to authenticated

using (
    (select public.is_owner())
);


create policy
    "owner update orders"
on public.orders

for update

to authenticated

using (
    (select public.is_owner())
)

with check (
    (select public.is_owner())
);


create policy
    "owner read order items"
on public.order_items

for select

to authenticated

using (
    (select public.is_owner())
);


create policy
    "owner manage products"
on public.products

for all

to authenticated

using (
    (select public.is_owner())
)

with check (
    (select public.is_owner())
);


create policy
    "owner manage categories"
on public.categories

for all

to authenticated

using (
    (select public.is_owner())
)

with check (
    (select public.is_owner())
);


create policy
    "owner manage product images"
on public.product_images

for all

to authenticated

using (
    (select public.is_owner())
)

with check (
    (select public.is_owner())
);


create policy
    "owner manage delivery"
on public.delivery_zones

for all

to authenticated

using (
    (select public.is_owner())
)

with check (
    (select public.is_owner())
);


create policy
    "owner read profiles"
on public.profiles

for select

to authenticated

using (
    id = auth.uid()
    or
    (select public.is_owner())
);


/* =========================================================
   14. GRANTS
========================================================= */

grant select
on public.categories
to anon, authenticated;

grant select
on public.products
to anon, authenticated;

grant select
on public.product_images
to anon, authenticated;

grant select
on public.delivery_zones
to anon, authenticated;

grant select
on public.orders
to authenticated;

grant update
on public.orders
to authenticated;

grant select
on public.order_items
to authenticated;

grant select
on public.profiles
to authenticated;

grant insert, update, delete
on public.products
to authenticated;

grant insert, update, delete
on public.categories
to authenticated;

grant insert, update, delete
on public.product_images
to authenticated;

grant insert, update, delete
on public.delivery_zones
to authenticated;


/* =========================================================
   15. STORAGE BUCKET
========================================================= */

insert into storage.buckets (
    id,
    name,
    public
)

values (
    'product-media',
    'product-media',
    true
)

on conflict (id)

do update set
    public = true;


/* =========================================================
   16. STORAGE POLICIES
========================================================= */

drop policy if exists
    "public read product media"
on storage.objects;

drop policy if exists
    "owner upload product media"
on storage.objects;

drop policy if exists
    "owner update product media"
on storage.objects;

drop policy if exists
    "owner delete product media"
on storage.objects;


create policy
    "public read product media"
on storage.objects

for select

to public

using (
    bucket_id =
    'product-media'
);


create policy
    "owner upload product media"
on storage.objects

for insert

to authenticated

with check (
    bucket_id =
    'product-media'
    and
    (select public.is_owner())
);


create policy
    "owner update product media"
on storage.objects

for update

to authenticated

using (
    bucket_id =
    'product-media'
    and
    (select public.is_owner())
)

with check (
    bucket_id =
    'product-media'
    and
    (select public.is_owner())
);


create policy
    "owner delete product media"
on storage.objects

for delete

to authenticated

using (
    bucket_id =
    'product-media'
    and
    (select public.is_owner())
);


/* =========================================================
   17. REALTIME
========================================================= */

do $$

declare
    t text;

begin

    foreach t in array array[
        'products',
        'product_images',
        'orders'
    ]

    loop

        if not exists (

            select 1

            from pg_publication_tables

            where pubname =
                'supabase_realtime'

            and schemaname =
                'public'

            and tablename =
                t

        ) then

            execute format(
                'alter publication supabase_realtime add table public.%I',
                t
            );

        end if;

    end loop;

end $$;


/* =========================================================
   18. CHECK
========================================================= */

select
    p.oid::regprocedure
        as function_signature,

    pg_get_function_arguments(p.oid)
        as arguments

from pg_proc p

join pg_namespace n
    on n.oid = p.pronamespace

where
    n.nspname = 'public'

and
    p.proname =
    'place_order';
