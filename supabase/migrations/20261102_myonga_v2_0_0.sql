-- myonga v2.0.0: session metadata and atomic checkout finalization
-- Safe to run repeatedly. Existing orders and payment history are preserved.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS table_number smallint,
  ADD COLUMN IF NOT EXISTS registration_method text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS reset_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_number smallint,
  ADD COLUMN IF NOT EXISTS checkout_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS option text,
  ADD COLUMN IF NOT EXISTS cancelled_quantity integer NOT NULL DEFAULT 0;

ALTER TABLE public.staff_calls
  ADD COLUMN IF NOT EXISTS table_number smallint;

UPDATE public.order_items
SET cancelled_quantity = 0
WHERE cancelled_quantity IS NULL;

-- Legacy zero/out-of-range values are treated as unassigned, never as a real table.
UPDATE public.customers
SET table_number = NULL
WHERE table_number IS NOT NULL AND table_number NOT BETWEEN 1 AND 20;

UPDATE public.orders
SET table_number = NULL
WHERE table_number IS NOT NULL AND table_number NOT BETWEEN 1 AND 20;

UPDATE public.staff_calls
SET table_number = NULL
WHERE table_number IS NOT NULL AND table_number NOT BETWEEN 1 AND 20;

UPDATE public.customers
SET registration_method = 'legacy'
WHERE registration_method IS NULL
   OR registration_method NOT IN ('qr', 'staff', 'legacy');

ALTER TABLE public.customers
  ALTER COLUMN registration_method SET DEFAULT 'legacy',
  ALTER COLUMN registration_method SET NOT NULL;

ALTER TABLE public.order_items
  ALTER COLUMN cancelled_quantity SET DEFAULT 0,
  ALTER COLUMN cancelled_quantity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_table_number_range'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_table_number_range
      CHECK (table_number IS NULL OR table_number BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_table_number_range'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_table_number_range
      CHECK (table_number IS NULL OR table_number BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_calls_table_number_range'
      AND conrelid = 'public.staff_calls'::regclass
  ) THEN
    ALTER TABLE public.staff_calls
      ADD CONSTRAINT staff_calls_table_number_range
      CHECK (table_number IS NULL OR table_number BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_registration_method_check'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_registration_method_check
      CHECK (registration_method IN ('qr', 'staff', 'legacy'));
  END IF;
END $$;

-- Backfill only from existing valid order table numbers; never guess missing values.
WITH latest_valid_order AS (
  SELECT DISTINCT ON (customer_id) customer_id, table_number
  FROM public.orders
  WHERE table_number BETWEEN 1 AND 20
  ORDER BY customer_id, created_at DESC
)
UPDATE public.customers AS c
SET table_number = l.table_number
FROM latest_valid_order AS l
WHERE c.id = l.customer_id
  AND c.table_number IS NULL;

UPDATE public.orders AS o
SET table_number = c.table_number
FROM public.customers AS c
WHERE c.id = o.customer_id
  AND (o.table_number IS NULL OR o.table_number = 0)
  AND c.table_number BETWEEN 1 AND 20;

UPDATE public.staff_calls AS sc
SET table_number = c.table_number
FROM public.customers AS c
WHERE c.id = sc.customer_id
  AND sc.table_number IS NULL
  AND c.table_number BETWEEN 1 AND 20;

-- Keep the existing catalog's availability flags while normalizing names and prices.
UPDATE public.products
SET name = '赤'
WHERE name = '赤ワイン'
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = '赤');

UPDATE public.products
SET name = '白'
WHERE name = '白ワイン'
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = '白');

UPDATE public.products
SET category = 'Alcohol', price = 800
WHERE name IN ('ビール', 'ハイボール', 'レモンサワー', 'コーン茶ハイ', 'ウーロンハイ', 'カシス');

UPDATE public.products
SET category = 'Wine', price = 1200
WHERE name IN ('赤', '白', '赤ワイン', '白ワイン');

UPDATE public.products
SET category = 'Soft Drinks', price = 600
WHERE name IN ('オレンジジュース', 'コーヒー', 'コーン茶', 'ウーロン茶');

INSERT INTO public.products (name, price, category, is_available)
SELECT v.name, v.price, v.category, true
FROM (VALUES
  ('ビール', 800, 'Alcohol'),
  ('ハイボール', 800, 'Alcohol'),
  ('レモンサワー', 800, 'Alcohol'),
  ('コーン茶ハイ', 800, 'Alcohol'),
  ('ウーロンハイ', 800, 'Alcohol'),
  ('カシス', 800, 'Alcohol'),
  ('赤', 1200, 'Wine'),
  ('白', 1200, 'Wine'),
  ('オレンジジュース', 600, 'Soft Drinks'),
  ('コーヒー', 600, 'Soft Drinks'),
  ('コーン茶', 600, 'Soft Drinks'),
  ('ウーロン茶', 600, 'Soft Drinks')
) AS v(name, price, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = v.name
);

CREATE INDEX IF NOT EXISTS customers_active_table_number_idx
  ON public.customers (table_number)
  WHERE reset_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_paid_at_idx
  ON public.orders (paid_at DESC)
  WHERE checkout_status = 'paid';

-- Include the live-screen tables in Supabase Realtime when not already present.
DO $$
DECLARE
  v_table_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['orders', 'order_items', 'products', 'staff_calls', 'customers']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table_name);
    END IF;
  END LOOP;
END $$;

-- Mark all active items for a customer as served in one transaction.
CREATE OR REPLACE FUNCTION public.mark_customer_items_served(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.order_items AS oi
  SET served_quantity = oi.quantity - COALESCE(oi.cancelled_quantity, 0),
      status = 'served'
  FROM public.orders AS o
  WHERE oi.order_id = o.id
    AND o.customer_id = p_customer_id
    AND COALESCE(o.checkout_status, 'none') NOT IN ('paid', 'cancelled')
    AND COALESCE(oi.served_quantity, 0) + COALESCE(oi.cancelled_quantity, 0) < oi.quantity;

  UPDATE public.orders
  SET status = 'served'
  WHERE customer_id = p_customer_id
    AND COALESCE(checkout_status, 'none') NOT IN ('paid', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_items_served(uuid) TO anon, authenticated;

-- Complete all active orders for one customer atomically.
-- This includes additional orders placed after the original checkout request.
-- Locking requested rows prevents a race with cancelCustomerCheckout.
CREATE OR REPLACE FUNCTION public.finalize_customer_checkout(
  p_customer_id uuid,
  p_payment_method text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'paypay') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  -- Block concurrent order inserts for this customer until checkout commits.
  PERFORM 1
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer session not found';
  END IF;

  PERFORM 1
  FROM public.orders
  WHERE customer_id = p_customer_id
    AND checkout_status = 'requested'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active checkout request';
  END IF;

  SELECT COALESCE(
    SUM(p.price * GREATEST(oi.quantity - COALESCE(oi.cancelled_quantity, 0), 0)),
    0
  )
  INTO v_total
  FROM public.orders AS o
  JOIN public.order_items AS oi ON oi.order_id = o.id
  JOIN public.products AS p ON p.id = oi.product_id
  WHERE o.customer_id = p_customer_id
    AND COALESCE(o.checkout_status, 'none') NOT IN ('paid', 'cancelled');

  UPDATE public.orders
  SET checkout_status = 'paid',
      payment_method = p_payment_method,
      paid_at = now()
  WHERE customer_id = p_customer_id
    AND COALESCE(checkout_status, 'none') NOT IN ('paid', 'cancelled');

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_customer_checkout(uuid, text) TO anon, authenticated;

