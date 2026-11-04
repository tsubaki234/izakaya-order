-- myonga: close a customer terminal atomically when checkout is finalized.
-- Safe to run repeatedly. Existing order and payment history is preserved.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS checkout_completed_at timestamptz;

-- The trigger serializes every new order against finalize_customer_checkout
-- by taking the same customer-row lock. It also protects staff proxy orders.
CREATE OR REPLACE FUNCTION public.guard_closed_customer_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_checkout_completed_at timestamptz;
  v_reset_at timestamptz;
BEGIN
  -- Preserve legacy orders that are not attached to a customer session.
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT checkout_completed_at, reset_at
    INTO v_checkout_completed_at, v_reset_at
  FROM public.customers
  WHERE id = NEW.customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer session not found';
  END IF;

  IF v_reset_at IS NOT NULL OR v_checkout_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer session is closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_closed_customer_order_insert ON public.orders;

CREATE TRIGGER guard_closed_customer_order_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_closed_customer_order_insert();

REVOKE ALL ON FUNCTION public.guard_closed_customer_order_insert() FROM PUBLIC;

-- Also prevent adding detail rows to an order after its customer session closes.
-- Customer row is locked before the order row to match checkout lock ordering.
CREATE OR REPLACE FUNCTION public.guard_closed_customer_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid;
  v_checkout_completed_at timestamptz;
  v_reset_at timestamptz;
  v_checkout_status text;
BEGIN
  SELECT customer_id
    INTO v_customer_id
  FROM public.orders
  WHERE id = NEW.order_id;

  IF NOT FOUND OR v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT checkout_completed_at, reset_at
    INTO v_checkout_completed_at, v_reset_at
  FROM public.customers
  WHERE id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND OR v_reset_at IS NOT NULL OR v_checkout_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer session is closed';
  END IF;

  SELECT checkout_status
    INTO v_checkout_status
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_checkout_status, 'none') IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Order is already closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_closed_customer_order_item_insert ON public.order_items;

CREATE TRIGGER guard_closed_customer_order_item_insert
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.guard_closed_customer_order_item_insert();

REVOKE ALL ON FUNCTION public.guard_closed_customer_order_item_insert() FROM PUBLIC;

-- Replace the existing RPC while preserving its original amount calculation.
-- A customer session can be finalized only once and is closed in the same
-- transaction as marking all of its active orders paid.
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
  v_checkout_completed_at timestamptz;
  v_reset_at timestamptz;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'paypay') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT checkout_completed_at, reset_at
    INTO v_checkout_completed_at, v_reset_at
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer session not found';
  END IF;

  IF v_reset_at IS NOT NULL OR v_checkout_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer session is already closed';
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

  UPDATE public.customers
  SET checkout_completed_at = now()
  WHERE id = p_customer_id
    AND reset_at IS NULL
    AND checkout_completed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer session could not be closed';
  END IF;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_customer_checkout(uuid, text) TO anon, authenticated;

-- Create an order and all of its item rows atomically. This prevents checkout
-- from finalizing between the orders INSERT and order_items INSERT requests.
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_customer_id uuid,
  p_items jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_table_number smallint;
  v_checkout_completed_at timestamptz;
  v_reset_at timestamptz;
  v_order_id bigint;
  v_inserted_count integer;
  v_expected_count integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items must be a JSON array';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required';
  END IF;

  SELECT table_number, checkout_completed_at, reset_at
    INTO v_table_number, v_checkout_completed_at, v_reset_at
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer session not found';
  END IF;

  IF v_reset_at IS NOT NULL OR v_checkout_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer session is closed';
  END IF;

  IF v_table_number IS NULL OR v_table_number NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Customer table number is not set';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(product_id bigint, quantity integer, option text)
    WHERE item.product_id IS NULL
       OR item.quantity IS NULL
       OR item.quantity < 1
       OR item.quantity > 99
  ) THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;

  v_expected_count := jsonb_array_length(p_items);

  INSERT INTO public.orders (table_number, customer_id, status, checkout_status)
  VALUES (v_table_number, p_customer_id, 'pending', 'none')
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, quantity, option)
  SELECT
    v_order_id,
    item.product_id,
    item.quantity,
    item.option
  FROM jsonb_to_recordset(p_items) AS item(product_id bigint, quantity integer, option text)
  JOIN public.products AS product
    ON product.id = item.product_id
   AND product.is_available = true;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count <> v_expected_count THEN
    RAISE EXCEPTION 'One or more products are unavailable';
  END IF;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
