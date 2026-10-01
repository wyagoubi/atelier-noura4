/* =========================================================
   ATELIER NOURA
   ORDER SYSTEM FIX
   Non-destructive migration
   ========================================================= */


/* =========================================================
   1. ADD MISSING COLUMNS
   ========================================================= */

ALTER TABLE public.delivery_zones
    ADD COLUMN IF NOT EXISTS wilaya_code text;

ALTER TABLE public.delivery_zones
    ADD COLUMN IF NOT EXISTS wilaya_name_ar text;

ALTER TABLE public.delivery_zones
    ADD COLUMN IF NOT EXISTS wilaya_name_fr text;

ALTER TABLE public.delivery_zones
    ADD COLUMN IF NOT EXISTS wilaya_name_en text;


/* Orders */

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_email text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS wilaya_code text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS wilaya_name text;


/* Order items */

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS product_name text;

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS line_total numeric(12,2);


/* Products */

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS cover_image text;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2);

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sku text;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS updated_at timestamptz
    DEFAULT now();


/* Product images */

ALTER TABLE public.product_images
    ADD COLUMN IF NOT EXISTS media_type text
    DEFAULT 'image';

ALTER TABLE public.product_images
    ADD COLUMN IF NOT EXISTS alt_text text;


/* =========================================================
   2. NORMALIZE DELIVERY ZONES
   ========================================================= */

UPDATE public.delivery_zones
SET
    wilaya_code =
        COALESCE(
            NULLIF(trim(wilaya_code), ''),
            NULLIF(trim(wilaya), ''),
            id::text
        ),

    wilaya_name_ar =
        COALESCE(
            NULLIF(trim(wilaya_name_ar), ''),
            NULLIF(trim(wilaya), ''),
            NULLIF(trim(wilaya_code), ''),
            id::text
        )

WHERE
    wilaya_code IS NULL
    OR trim(wilaya_code) = ''
    OR wilaya_name_ar IS NULL
    OR trim(wilaya_name_ar) = '';


/* =========================================================
   3. SYNCHRONIZE OLD ORDER COLUMNS
   ========================================================= */

UPDATE public.orders
SET
    customer_phone =
        COALESCE(
            NULLIF(trim(customer_phone), ''),
            NULLIF(trim(phone), '')
        ),

    phone =
        COALESCE(
            NULLIF(trim(phone), ''),
            NULLIF(trim(customer_phone), '')
        ),

    wilaya_code =
        COALESCE(
            NULLIF(trim(wilaya_code), ''),
            NULLIF(trim(wilaya), '')
        ),

    wilaya_name =
        COALESCE(
            NULLIF(trim(wilaya_name), ''),
            NULLIF(trim(wilaya), ''),
            NULLIF(trim(wilaya_code), '')
        )

WHERE
    customer_phone IS NULL
    OR phone IS NULL
    OR wilaya_code IS NULL
    OR wilaya_name IS NULL;


/* =========================================================
   4. OWNER CHECK FUNCTION
   ========================================================= */

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'owner'
    );
$$;


/* =========================================================
   5. DELIVERY ZONES PUBLIC ACCESS
   ========================================================= */

ALTER TABLE public.delivery_zones
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active delivery zones"
ON public.delivery_zones;

CREATE POLICY "Public can view active delivery zones"
ON public.delivery_zones
FOR SELECT
TO anon, authenticated
USING (
    is_active = true
);


/* Owner can manage delivery zones */

DROP POLICY IF EXISTS "Owner can manage delivery zones"
ON public.delivery_zones;

CREATE POLICY "Owner can manage delivery zones"
ON public.delivery_zones
FOR ALL
TO authenticated
USING (
    public.is_owner()
)
WITH CHECK (
    public.is_owner()
);


/* =========================================================
   6. REMOVE OLD ORDER POLICIES
   ========================================================= */

DO $$
DECLARE
    policy_record record;
BEGIN

    FOR policy_record IN
        SELECT
            schemaname,
            tablename,
            policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'orders',
              'order_items'
          )
    LOOP

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            policy_record.policyname,
            policy_record.schemaname,
            policy_record.tablename
        );

    END LOOP;

END
$$;


/* =========================================================
   7. ENABLE RLS
   ========================================================= */

ALTER TABLE public.orders
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_items
ENABLE ROW LEVEL SECURITY;


/* =========================================================
   8. OWNER ORDERS POLICIES
   ========================================================= */

CREATE POLICY "Owner can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    public.is_owner()
);


CREATE POLICY "Owner can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    public.is_owner()
)
WITH CHECK (
    public.is_owner()
);


CREATE POLICY "Owner can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
    public.is_owner()
);


/* =========================================================
   9. OWNER ORDER ITEMS POLICIES
   ========================================================= */

CREATE POLICY "Owner can view order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
    public.is_owner()
);


CREATE POLICY "Owner can update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
    public.is_owner()
)
WITH CHECK (
    public.is_owner()
);


CREATE POLICY "Owner can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
    public.is_owner()
);


/* =========================================================
   10. PLACE ORDER RPC
   ========================================================= */

DROP FUNCTION IF EXISTS public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
);


CREATE OR REPLACE FUNCTION public.place_order(
    p_address text,
    p_customer_email text,
    p_customer_name text,
    p_customer_phone text,
    p_delivery_method text,
    p_items jsonb,
    p_notes text,
    p_wilaya_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$

DECLARE

    v_order_id uuid;

    v_order_number text;

    v_subtotal numeric(12,2) := 0;

    v_delivery_fee numeric(12,2) := 0;

    v_total numeric(12,2) := 0;

    v_wilaya_name text;

    v_item jsonb;

    v_product public.products%ROWTYPE;

    v_product_id bigint;

    v_quantity integer;

    v_line_total numeric(12,2);

    v_zone public.delivery_zones%ROWTYPE;

    v_email text;

    v_phone text;

    v_name text;


BEGIN

    /* =====================================================
       CLEAN INPUT
       ===================================================== */

    v_name :=
        trim(
            coalesce(
                p_customer_name,
                ''
            )
        );


    v_email :=
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
        );


    v_phone :=
        regexp_replace(
            trim(
                coalesce(
                    p_customer_phone,
                    ''
                )
            ),
            '\s+',
            '',
            'g'
        );


    /* =====================================================
       NAME
       ===================================================== */

    IF v_name = '' THEN

        RAISE EXCEPTION
            'اسم العميل مطلوب';

    END IF;


    IF length(v_name) < 2 THEN

        RAISE EXCEPTION
            'اسم العميل قصير جدًا';

    END IF;


    IF length(v_name) > 100 THEN

        RAISE EXCEPTION
            'اسم العميل طويل جدًا';

    END IF;


    /* =====================================================
       EMAIL
       OPTIONAL
       ===================================================== */

    IF v_email IS NOT NULL THEN

        IF v_email !~*
            '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
        THEN

            RAISE EXCEPTION
                'البريد الإلكتروني غير صحيح';

        END IF;

    END IF;


    /* =====================================================
       PHONE
       ===================================================== */

    IF v_phone = '' THEN

        RAISE EXCEPTION
            'رقم الهاتف مطلوب';

    END IF;


    IF v_phone !~
        '^(0[567][0-9]{8}|\+213[567][0-9]{8})$'
    THEN

        RAISE EXCEPTION
            'رقم الهاتف الجزائري غير صحيح';

    END IF;


    /* =====================================================
       DELIVERY METHOD
       ===================================================== */

    IF p_delivery_method NOT IN (
        'home',
        'office'
    )
    THEN

        RAISE EXCEPTION
            'طريقة التوصيل غير صحيحة';

    END IF;


    /* =====================================================
       WILAYA
       ===================================================== */

    IF trim(
        coalesce(
            p_wilaya_code,
            ''
        )
    ) = ''
    THEN

        RAISE EXCEPTION
            'الولاية مطلوبة';

    END IF;


    SELECT *
    INTO v_zone

    FROM public.delivery_zones

    WHERE
        trim(wilaya_code)
        =
        trim(p_wilaya_code)

        AND is_active = true

    LIMIT 1;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'الولاية غير متاحة للتوصيل';

    END IF;


    /* =====================================================
       WILAYA NAME
       ===================================================== */

    v_wilaya_name :=
        COALESCE(
            NULLIF(
                trim(
                    v_zone.wilaya_name_ar
                ),
                ''
            ),

            NULLIF(
                trim(
                    v_zone.wilaya
                ),
                ''
            ),

            NULLIF(
                trim(
                    v_zone.wilaya_name_fr
                ),
                ''
            ),

            NULLIF(
                trim(
                    v_zone.wilaya_name_en
                ),
                ''
            ),

            v_zone.wilaya_code
        );


    /* =====================================================
       DELIVERY PRICE
       ===================================================== */

    IF p_delivery_method = 'home' THEN

        v_delivery_fee :=
            COALESCE(
                v_zone.home_fee,
                0
            );

    ELSE

        v_delivery_fee :=
            COALESCE(
                v_zone.office_fee,
                0
            );

    END IF;


    /* =====================================================
       HOME ADDRESS
       ===================================================== */

    IF p_delivery_method = 'home' THEN

        IF length(
            trim(
                coalesce(
                    p_address,
                    ''
                )
            )
        ) < 5
        THEN

            RAISE EXCEPTION
                'عنوان التوصيل مطلوب';

        END IF;

    END IF;


    /* =====================================================
       CART
       ===================================================== */

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) = 0
    THEN

        RAISE EXCEPTION
            'السلة فارغة';

    END IF;


    /* =====================================================
       ORDER NUMBER
       ===================================================== */

    v_order_number :=
        'AN-'
        ||
        to_char(
            now(),
            'YYYYMMDD'
        )
        ||
        '-'
        ||
        upper(
            substr(
                replace(
                    gen_random_uuid()::text,
                    '-',
                    ''
                ),
                1,
                6
            )
        );


    /* =====================================================
       CREATE ORDER
       ===================================================== */

    INSERT INTO public.orders
    (
        order_number,

        customer_name,

        customer_email,

        customer_phone,

        phone,

        wilaya_code,

        wilaya_name,

        wilaya,

        delivery_method,

        address,

        notes,

        subtotal,

        delivery_fee,

        total,

        status
    )

    VALUES
    (
        v_order_number,

        v_name,

        v_email,

        v_phone,

        v_phone,

        trim(p_wilaya_code),

        v_wilaya_name,

        v_wilaya_name,

        p_delivery_method,

        CASE
            WHEN p_delivery_method = 'home'
            THEN trim(
                coalesce(
                    p_address,
                    ''
                )
            )
            ELSE ''
        END,

        trim(
            coalesce(
                p_notes,
                ''
            )
        ),

        0,

        v_delivery_fee,

        0,

        'new'
    )

    RETURNING id
    INTO v_order_id;


    /* =====================================================
       ORDER ITEMS
       ===================================================== */

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(
            p_items
        )
    LOOP


        BEGIN

            v_product_id :=
                (
                    v_item ->> 'product_id'
                )::bigint;

        EXCEPTION
            WHEN others THEN

                RAISE EXCEPTION
                    'معرف المنتج غير صحيح';

        END;


        BEGIN

            v_quantity :=
                (
                    v_item ->> 'quantity'
                )::integer;

        EXCEPTION
            WHEN others THEN

                RAISE EXCEPTION
                    'كمية المنتج غير صحيحة';

        END;


        IF v_quantity IS NULL
           OR v_quantity <= 0
           OR v_quantity > 99
        THEN

            RAISE EXCEPTION
                'كمية المنتج غير صحيحة';

        END IF;


        /* Lock product */

        SELECT *
        INTO v_product

        FROM public.products

        WHERE id = v_product_id

        FOR UPDATE;


        IF NOT FOUND THEN

            RAISE EXCEPTION
                'أحد المنتجات في السلة غير موجود';

        END IF;


        IF COALESCE(
            v_product.is_active,
            false
        ) = false
        THEN

            RAISE EXCEPTION
                'أحد المنتجات غير متاح حاليًا';

        END IF;


        IF COALESCE(
            v_product.stock,
            0
        ) < v_quantity
        THEN

            RAISE EXCEPTION
                'الكمية المطلوبة غير متوفرة للمنتج: %',
                v_product.name_ar;

        END IF;


        /* Calculate item */

        v_line_total :=
            round(
                COALESCE(
                    v_product.price,
                    0
                )
                *
                v_quantity,
                2
            );


        v_subtotal :=
            v_subtotal
            +
            v_line_total;


        /* Insert item */

        INSERT INTO public.order_items
        (
            order_id,

            product_id,

            product_name,

            quantity,

            unit_price,

            line_total
        )

        VALUES
        (
            v_order_id,

            v_product.id,

            COALESCE(
                v_product.name_ar,
                v_product.name_fr,
                v_product.name_en,
                'Product'
            ),

            v_quantity,

            v_product.price,

            v_line_total
        );


        /* Reduce stock */

        UPDATE public.products

        SET
            stock =
                COALESCE(
                    stock,
                    0
                )
                -
                v_quantity,

            updated_at =
                now()

        WHERE id = v_product.id;


    END LOOP;


    /* =====================================================
       TOTAL
       ===================================================== */

    v_total :=
        round(
            v_subtotal
            +
            v_delivery_fee,
            2
        );


    /* =====================================================
       UPDATE ORDER TOTAL
       ===================================================== */

    UPDATE public.orders

    SET
        subtotal = v_subtotal,

        delivery_fee = v_delivery_fee,

        total = v_total

    WHERE id = v_order_id;


    /* =====================================================
       RETURN
       ===================================================== */

    RETURN jsonb_build_object(

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


END;

$$;


/* =========================================================
   11. RPC SECURITY
   ========================================================= */

REVOKE ALL
ON FUNCTION public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
TO anon;


GRANT EXECUTE
ON FUNCTION public.place_order(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text
)
TO authenticated;


/* =========================================================
   12. OWNER FUNCTION SECURITY
   ========================================================= */

REVOKE ALL
ON FUNCTION public.is_owner()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.is_owner()
TO authenticated;


/* =========================================================
   END
   ========================================================= */
