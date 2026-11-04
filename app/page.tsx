"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/app-version";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
};

type CartItem = Product & {
  quantity: number;
  option: string | null;
};

type CustomerOrder = {
  id: number;
  status: string;
  checkout_status: string | null;
  payment_method: string | null;
  created_at: string;
  checkout_requested_at: string | null;
  items: {
    productName: string;
    option: string | null;
    price: number;
    quantity: number;
    served_quantity: number;
    cancelled_quantity: number;
    status: string;
  }[];
};

const MENU_PRESENTATION: Record<string, { english: string; reading: string; category: string; optionType?: "temperature" | "mixer" }> = {
  "ビール": { english: "Beer", reading: "ビール", category: "Alcohol" },
  "ハイボール": { english: "Highball", reading: "ハイボール", category: "Alcohol" },
  "レモンサワー": { english: "Lemon sour", reading: "レモンサワー", category: "Alcohol" },
  "コーン茶ハイ": { english: "Corn tea high", reading: "コーン茶ハイ", category: "Alcohol" },
  "ウーロンハイ": { english: "Oolong tea high", reading: "ウーロンハイ", category: "Alcohol" },
  "カシス": { english: "Cassis", reading: "カシス", category: "Alcohol", optionType: "mixer" },
  "赤": { english: "Red", reading: "赤", category: "Wine" },
  "白": { english: "White", reading: "白", category: "Wine" },
  "赤ワイン": { english: "Red", reading: "赤", category: "Wine" },
  "白ワイン": { english: "White", reading: "白", category: "Wine" },
  "オレンジジュース": { english: "Orange", reading: "オレンジ", category: "Soft Drinks" },
  "コーヒー": { english: "Coffee", reading: "コーヒー", category: "Soft Drinks", optionType: "temperature" },
  "コーン茶": { english: "Corn tea", reading: "コーン茶", category: "Soft Drinks", optionType: "temperature" },
  "ウーロン茶": { english: "Oolong tea", reading: "ウーロン茶", category: "Soft Drinks", optionType: "temperature" },
};

const CATEGORY_PRICES: Record<string, number> = {
  Alcohol: 800,
  Wine: 1200,
  "Soft Drinks": 600,
};

const MENU_ORDER = ["ビール", "ハイボール", "レモンサワー", "コーン茶ハイ", "ウーロンハイ", "カシス", "赤", "白", "赤ワイン", "白ワイン", "オレンジジュース", "コーヒー", "コーン茶", "ウーロン茶"];
const getMenuPresentation = (name: string) => MENU_PRESENTATION[name];

function MyongaWordmark({ className = "" }: { className?: string }) {
  return (
    <span aria-label="myonga" className={`inline-flex items-center whitespace-nowrap ${className}`}>
      myonga
    </span>
  );
}

type CustomerIconName = "shopping-bag" | "clipboard-list" | "history";
function CustomerIcon({ name }: { name: CustomerIconName }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "shopping-bag") return <svg {...common}><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>;
  if (name === "clipboard-list") return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 9h6M9 13h6M9 17h3"/><path d="M9 2.8h6v3H9z"/></svg>;
  return <svg {...common}><path d="M4 5h16v16H4z"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h7"/></svg>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [optionProduct, setOptionProduct] = useState<Product | null>(null);
  const [ordered, setOrdered] = useState(false);
  const [lastPlacedItems, setLastPlacedItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState("");
  const [checkingCustomer, setCheckingCustomer] = useState(true);
  const nickname = tableNumber ? `卓番 ${String(tableNumber).padStart(2, "0")}` : "卓番未設定";

  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([]);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [staffCallPending, setStaffCallPending] = useState(false);
  const [callingStaff, setCallingStaff] = useState(false);
  const [customerTab, setCustomerTab] = useState<"menu" | "orders" | "history">("menu");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // 注文を読み込む + Realtime監視
  useEffect(() => {
    if (!customerId) return;

    const loadOrderHistory = async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, checkout_status, payment_method, created_at, checkout_requested_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true });

      if (ordersError) {
        console.error(ordersError);
        return;
      }

      if (!orders || orders.length === 0) {
        setOrderHistory([]);
        setCheckoutRequested(false);
        return;
      }

      const hasCheckoutRequest = orders.some(
        (order) => order.checkout_status === "requested"
      );

      setCheckoutRequested(hasCheckoutRequest);

      const orderIds = orders.map((order) => order.id);

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "order_id, product_id, quantity, served_quantity, cancelled_quantity, status, option"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error(itemsError);
        return;
      }

      if (!items || items.length === 0) {
        const emptyItemHistory = orders.map((order) => ({
          id: order.id,
          status: "pending",
          checkout_status: order.checkout_status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          checkout_requested_at: order.checkout_requested_at,
          items: [],
        }));
        setOrderHistory(emptyItemHistory);
        return;
      }

      const productIds = [
        ...new Set(items.map((item) => item.product_id)),
      ];

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds);

      if (productsError) {
        console.error(productsError);
        return;
      }

      const history = orders.map((order) => {
        const orderItems = items
          .filter((item) => item.order_id === order.id)
          .map((item) => {
            const product = products?.find(
              (product) =>
                String(product.id) === String(item.product_id)
            );

            const servedQuantity = item.served_quantity ?? 0;
            const cancelledQuantity = item.cancelled_quantity ?? 0;

            return {
              productName: product?.name ?? "不明な商品",
              option: item.option ?? null,
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              cancelled_quantity: cancelledQuantity,
              status: cancelledQuantity > 0 ? "cancelled" : servedQuantity >= item.quantity ? "served" : "pending",
            };
          });

        const allItemsServed =
          orderItems.length > 0 &&
          orderItems.every(
            (item) => item.served_quantity + item.cancelled_quantity >= item.quantity
          );

        return {
          id: order.id,
          status: allItemsServed ? "served" : "pending",
          checkout_status: order.checkout_status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          checkout_requested_at: order.checkout_requested_at,
          items: orderItems,
        };
      });

      setOrderHistory(history);
    };

    loadOrderHistory();

    const channel = supabase
      .channel(`customer-orders-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          loadOrderHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          loadOrderHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  // スタッフ呼び出し状態を読み込み、スタッフ側の対応完了を監視
  useEffect(() => {
    if (!customerId) return;

    const loadPendingCall = async () => {
      const { data, error } = await supabase
        .from("staff_calls")
        .select("id")
        .eq("customer_id", customerId)
        .eq("status", "pending")
        .limit(1);

      if (error) {
        console.error("呼び出し状態取得エラー:", error);
        return;
      }

      setStaffCallPending((data || []).length > 0);
    };

    loadPendingCall();

    const channel = supabase
      .channel(`customer-staff-calls-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_calls",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const call = payload.new as { status?: string };
          if (call.status === "completed") {
            setStaffCallPending(false);
          } else if (call.status === "pending") {
            setStaffCallPending(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  // スタッフを呼び出す
  const callStaff = async () => {
    if (!customerId || callingStaff || staffCallPending) return;

    setCallingStaff(true);

    const { error } = await supabase.from("staff_calls").insert({
      customer_id: customerId,
      nickname,
      table_number: tableNumber,
    });

    if (error) {
      console.error("スタッフ呼び出しエラー:", error);
      alert("スタッフの呼び出しに失敗しました。通信状況を確認して、もう一度お試しください。");
      setCallingStaff(false);
      return;
    }

    setStaffCallPending(true);
    setCallingStaff(false);
  };

  // スタッフからの端末リセットを監視
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`customer-reset-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customers",
          filter: `id=eq.${customerId}`,
        },
        (payload) => {
          const updatedCustomer = payload.new as {
            reset_at?: string | null;
            checkout_completed_at?: string | null;
            table_number?: number | null;
          };

          if (updatedCustomer.table_number) setTableNumber(Number(updatedCustomer.table_number));
          if (updatedCustomer.checkout_completed_at) setCheckoutCompleted(true);
          if (!updatedCustomer.reset_at) return;

          localStorage.removeItem("customer_id");
          setCustomerId(null);
          setTableNumber(null);
          setRegistrationError("");
          setOrderHistory([]);
          setCustomerTab("menu");
          setSelectedCategory("All");
          setCheckoutRequested(false);
          setCheckoutCompleted(false);
          setCart([]);
          setCartOpen(false);
          setOrdered(false);
          setCheckingCustomer(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  // QRコードの卓番、または端末に保存されたセッションを読み込む
  useEffect(() => {
    const loadCustomer = async () => {
      const params = new URLSearchParams(window.location.search);
      const rawTable = params.get("table");
      const requestedTable = rawTable && /^\d{1,2}$/.test(rawTable) ? Number(rawTable) : null;
      const validRequestedTable = requestedTable !== null && requestedTable >= 1 && requestedTable <= 20 ? requestedTable : null;
      if (rawTable && !validRequestedTable) {
        setRegistrationError("番号札のQRコードを確認してください。卓番は1〜20です。");
        setCheckingCustomer(false);
        return;
      }

      const savedCustomerId = localStorage.getItem("customer_id");
      if (savedCustomerId) {
        const { data, error } = await supabase
          .from("customers")
          .select("id, table_number, reset_at, checkout_completed_at")
          .eq("id", savedCustomerId)
          .maybeSingle();

        if (!error && data && !data.reset_at) {
          if (!validRequestedTable && !data.table_number) {
            localStorage.removeItem("customer_id");
          } else if (validRequestedTable && data.table_number && Number(data.table_number) !== validRequestedTable) {
            setRegistrationError(`この端末は卓番${String(data.table_number).padStart(2, "0")}で登録済みです。スタッフにお声がけください。`);
            setCheckingCustomer(false);
            return;
          }
          if (validRequestedTable && !data.table_number) {
            const { error: updateError } = await supabase.from("customers").update({ table_number: validRequestedTable }).eq("id", savedCustomerId);
            if (updateError) console.error("卓番更新エラー:", updateError);
          }
          if (validRequestedTable || data.table_number) {
            setCustomerId(data.id);
            setTableNumber(validRequestedTable ?? Number(data.table_number));
            setCheckoutCompleted(Boolean(data.checkout_completed_at));
            setCheckingCustomer(false);
            return;
          }
        }
        localStorage.removeItem("customer_id");
      }

      if (!validRequestedTable) {
        setRegistrationError("番号札のQRコードを読み取ってください。スマートフォンをお持ちでない場合はスタッフにお声がけください。");
        setCheckingCustomer(false);
        return;
      }

      const tableLabel = `卓番 ${String(validRequestedTable).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("customers")
        .insert({
          nickname: tableLabel,
          table_number: validRequestedTable,
          registration_method: "qr",
        })
        .select("id, table_number")
        .single();

      if (error || !data) {
        console.error("QR受付エラー:", error);
        setRegistrationError("受付に失敗しました。通信状況を確認して、スタッフにお声がけください。");
        setCheckingCustomer(false);
        return;
      }

      localStorage.setItem("customer_id", data.id);
      setCustomerId(data.id);
      setTableNumber(Number(data.table_number));
      setCheckingCustomer(false);
    };

    loadCustomer();
  }, []);

  // 商品を読み込む
  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("id");

      if (error) {
        console.error(error);
        return;
      }

      setProducts(data || []);
    };

    loadProducts();

    const channel = supabase
      .channel("customer-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  // 商品をカートに追加（オプション別に別行として管理）
  const addToCart = (product: Product, option: string | null = null) => {
    if (!product.is_available) return;
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id && item.option === option
      );
      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id && item.option === option
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...currentCart, { ...product, quantity: 1, option }];
    });
    setOptionProduct(null);
  };

  // カートの個数を変更
  const changeCartQuantity = (
    productId: number,
    option: string | null,
    amount: number
  ) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId && item.option === option
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const cartQuantity = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const categoryItemCount = products.filter((product) => {
    const presentation = getMenuPresentation(product.name);
    const legacyDuplicate = (product.name === "赤ワイン" && products.some((entry) => entry.name === "赤")) || (product.name === "白ワイン" && products.some((entry) => entry.name === "白"));
    return Boolean(presentation) && !legacyDuplicate && (selectedCategory === "All" || presentation?.category === selectedCategory);
  }).length;

  // 現在注文中の注文だけ
  const currentOrders = orderHistory.filter(
    (order) =>
      (order.checkout_status === "none" || order.checkout_status === null || order.checkout_status === "requested") &&
      order.items.some(
        (item) => item.cancelled_quantity < item.quantity && item.served_quantity + item.cancelled_quantity < item.quantity
      )
  );

  // 提供完了した注文、または会計済みの注文（未提供確認後に会計した場合も含む）
  const servedOrders = orderHistory.filter((order) =>
    order.items.length > 0 && (
      order.checkout_status === "paid" ||
      order.items.every((item) => item.served_quantity + item.cancelled_quantity >= item.quantity)
    )
  );

  // 会計対象の注文
  const checkoutOrders = orderHistory.filter(
    (order) => (order.checkout_status === "none" || order.checkout_status === null) && order.items.some((item) => item.cancelled_quantity < item.quantity)
  );

  // 会計対象の合計
  const orderTotal = checkoutOrders.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (orderSum, item) =>
          orderSum + item.price * (item.quantity - item.cancelled_quantity),
        0
      ),
    0
  );


  // お会計依頼
  const requestCheckout = async (paymentMethod: "cash" | "paypay") => {
    if (!customerId) return;

    if (checkoutOrders.length === 0) {
      alert("現在お会計できる注文がありません");
      return;
    }

    const paymentLabel = paymentMethod === "cash" ? "現金" : "PayPay";
    const confirmed = window.confirm(
      `支払い方法：${paymentLabel}\n\nお会計を依頼しますか？\n会計依頼中も追加注文できます。`
    );

    if (!confirmed) return;

    // 会計依頼前の注文を会計画面用に保存
    const targetOrderIds = checkoutOrders.map((order) => order.id);
    const { data, error } = await supabase
      .from("orders")
      .update({
        checkout_status: "requested",
        checkout_requested_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq("customer_id", customerId)
      .in("id", targetOrderIds)
      .or("checkout_status.eq.none,checkout_status.is.null")
      .select("id");

    if (error || !data || data.length !== targetOrderIds.length) {
      console.error("会計依頼更新エラー:", error);
      alert("お会計の依頼に失敗しました。注文状態を再読み込みして、もう一度お試しください。");
      return;
    }

    setCart([]);
    setCartOpen(false);
    setCheckoutRequested(true);
    setShowPaymentModal(false);

    alert("お会計を承りました");
  };

  // 注文する
  const placeOrder = async () => {
    if (cart.length === 0 || !customerId || loading || checkoutCompleted) {
      return;
    }

    setLoading(true);

    // 注文直前にSupabaseから商品の最新の販売状態を取得
    const productIds = cart.map((item) => item.id);

    const { data: latestProducts, error: productsError } = await supabase
      .from("products")
      .select("id, name, is_available")
      .in("id", productIds);

    // 最新状態を取得できなければ、安全のため注文を中止
    if (productsError || !latestProducts) {
      console.error(productsError);
      alert("商品の販売状態を確認できませんでした。通信状況を確認して、もう一度お試しください。");
      setLoading(false);
      return;
    }

    // 売り切れ、または商品情報が取得できなかった商品を確認
    const unavailableItems = cart.filter((item) => {
      const latestProduct = latestProducts.find(
        (product) => String(product.id) === String(item.id)
      );

      return !latestProduct || latestProduct.is_available !== true;
    });

    // 売り切れ商品があれば注文せず、メニューとカートから削除
    if (unavailableItems.length > 0) {
      const unavailableIds = unavailableItems.map((item) => item.id);
      const unavailableNames = unavailableItems.map((item) => item.name).join("、");

      setProducts((currentProducts) =>
        currentProducts.filter(
          (product) => !unavailableIds.some((id) => String(id) === String(product.id))
        )
      );

      setCart((currentCart) =>
        currentCart.filter(
          (item) => !unavailableIds.some((id) => String(id) === String(item.id))
        )
      );

      alert(
        `以下の商品は売り切れになりました。\n\n${unavailableNames}\n\nカートから削除しました。残りの商品をご確認ください。`
      );
      setLoading(false);
      return;
    }

    // 注文と商品明細をDB側の単一トランザクションで登録する
    const { error: orderError } = await supabase.rpc("create_customer_order", {
      p_customer_id: customerId,
      p_items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        option: item.option,
      })),
    });

    if (orderError) {
      console.error(orderError);
      const message = String(orderError.message ?? "");
      alert(message.includes("session is closed")
        ? "この端末は会計済みです。追加注文する場合はスタッフにお声がけください。"
        : message.includes("unavailable")
          ? "売り切れの商品が含まれています。メニューを更新して、もう一度お試しください。"
          : "注文に失敗しました");
      setLoading(false);
      return;
    }

    setLastPlacedItems([...cart]);
    setCart([]);
    setCartOpen(false);
    setOrdered(true);
    setLoading(false);
  };

  const lastPlacedTotal = lastPlacedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);

    return {
      date: date.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }),
      time: date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  if (checkingCustomer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#16070D] p-6">
        <p className="text-[#F3EDEB]">読み込み中...</p>
      </main>
    );
  }

  if (!customerId) {
    return (
      <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="flex min-h-screen items-center justify-center bg-[#16070D] p-6">
        <div className="w-full max-w-md rounded-md bg-[#261019] p-7 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h1 className="font-serif text-3xl font-medium tracking-[0.18em] text-[#F3EDEB]"><MyongaWordmark /></h1>
          <p className="mt-5 text-sm leading-7 text-[#C5B7BA]">{registrationError || "番号札のQRコードを読み取ってください。"}</p>
          <p className="mt-4 text-xs text-[#8F8288]">スマートフォンをお持ちでない場合は、スタッフにお声がけください。</p>
          <p className="mt-8 text-[9px] tracking-[0.12em] text-[#76515E]">{APP_VERSION}</p>
        </div>
      </main>
    );
  }

  if (checkoutCompleted) {
    return (
      <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="flex min-h-screen items-center justify-center bg-[#16070D] p-6">
        <div className="w-full max-w-md rounded-md bg-[#261019] p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h1 className="font-serif text-3xl font-medium tracking-[0.16em] text-[#F3EDEB]"><MyongaWordmark /></h1>
          <p className="mt-7 text-xl font-semibold text-[#F3EDEB]">お会計が完了しました</p>
          <p className="mt-3 text-sm leading-7 text-[#C5B7BA]">ご利用ありがとうございました。<br />この端末では追加注文を受け付けていません。<br />ご用の際はスタッフにお声がけください。</p>
          <p className="mt-8 text-[9px] tracking-[0.12em] text-[#76515E]">{APP_VERSION}</p>
        </div>
      </main>
    );
  }

  if (ordered) {
    return (
      <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="flex min-h-screen items-center justify-center bg-[#16070D] p-6">
        <div className="w-full max-w-md rounded-md bg-[#261019] p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h1 className="font-serif text-2xl font-medium text-[#F3EDEB]">
            ご注文を受け付けました
          </h1>

          <p className="mt-3 text-[#C5B7BA]">
            <span className="block">卓番 {String(tableNumber).padStart(2, "0")} のご注文ありがとうございます。</span>
            <span className="mt-1 block text-[10px] tracking-wide text-[#8F8288]">ID：{customerId?.slice(0, 8)}</span>
          </p>

          <div className="mt-5 rounded-md border border-[#6A243D] bg-[#35131F] p-4 text-left">
            <p className="mb-3 text-sm font-semibold text-[#D7B77C]">注文内容</p>
            <div className="space-y-2">
              {lastPlacedItems.map((item) => (
                <div key={`${item.id}-${item.option ?? "default"}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-[#F3EDEB]">{getMenuPresentation(item.name)?.english ?? item.name}{item.option ? ` · ${item.option}` : ""} × {item.quantity}</span>
                  <span className="shrink-0 text-[#C5B7BA]">¥{(item.price * item.quantity).toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-[#6A243D] pt-3 text-right font-semibold text-[#F3EDEB]">合計 ¥{lastPlacedTotal.toLocaleString("ja-JP")}</div>
          </div>

          <p className="mt-4 text-sm text-[#C5B7BA]">
            商品が届くまで少々お待ちください。
          </p>

          <button
            onClick={() => {
              setOrdered(false);
              setCustomerTab("orders");
            }}
            className="mt-6 w-full rounded-md bg-[#A51D43] px-4 py-3 font-semibold text-[#FFF9F5] shadow-sm transition hover:bg-[#C02A52]"
          >
            注文状況を見る
          </button>
        </div>
      </main>
    );
  }


  return (
    <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="min-h-screen bg-[#16070D] p-6 pb-28">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-serif text-3xl font-medium tracking-[0.16em] text-[#F3EDEB]"><MyongaWordmark /></h1>

        <p className="mt-2 text-sm tracking-wide text-[#C5B7BA]">卓番 {String(tableNumber).padStart(2, "0")}</p>
        <p className="mt-0.5 text-[10px] tracking-wide text-[#8F8288]">ID：{customerId?.slice(0, 8)}</p>

        <button
          onClick={callStaff}
          disabled={callingStaff || staffCallPending}
          className={`mt-4 w-full rounded-md border border-[#C65A73]/50 px-4 py-3 font-semibold tracking-wide transition ${
            staffCallPending
              ? "bg-[#4A182A] text-[#C5B7BA]"
              : "bg-[#A51D43] text-[#FFF9F5] hover:bg-[#C02A52]"
          } disabled:cursor-not-allowed disabled:opacity-80`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            {callingStaff ? "呼び出し中..." : staffCallPending ? "スタッフを呼び出しています" : "スタッフを呼ぶ"}
          </span>
        </button>
        {staffCallPending && (
          <p className="mt-2 text-center text-xs text-[#A18F96]">
            スタッフが対応を完了すると、もう一度呼び出せます。
          </p>
        )}
        {checkoutRequested && (
          <div className="mt-3 rounded-md border border-[#9A2444]/60 bg-[#3A1422] p-3">
            <p className="text-sm font-semibold text-[#F4DDE4]">お会計依頼中</p>
            <p className="mt-1 text-xs leading-5 text-[#D8B9C3]">お会計時にこの画面を表示してレジまでお越しください。追加注文も引き続きご利用いただけます。</p>
          </div>
        )}

        {/* メインタブ */}
        <nav className="mt-7 grid grid-cols-3 gap-2 rounded-md border border-[#6A243D] bg-[#261019] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
          {([
            ["menu", "メニュー", "shopping-bag"],
            ["orders", "注文状況", "clipboard-list"],
            ["history", "注文履歴", "history"],
          ] as const).map(([tab, label, iconName]) => (
            <button
              key={tab}
              onClick={() => setCustomerTab(tab)}
              className={`relative rounded-md px-2 py-3 text-sm font-bold tracking-wide transition ${
                customerTab === tab
                  ? "bg-[#A51D43] text-[#FFF9F5] shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
                  : "text-[#C5B7BA] hover:bg-[#4A182A]"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><CustomerIcon name={iconName} />{label}</span>
              {tab === "orders" && currentOrders.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#261019] bg-[#C83D4D] px-1 text-[10px] font-black text-white">
                  {currentOrders.length > 99 ? "99+" : currentOrders.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* メニュー */}
        {customerTab === "menu" && (
          <section className="mt-7">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="font-serif text-2xl font-medium tracking-wide text-[#F3EDEB]">Menu</h2>
              </div>
              <span className="text-xs text-[#A18F96]">{categoryItemCount} items</span>
            </div>

            {(() => {
              const menuProducts = products.filter((product) => Boolean(getMenuPresentation(product.name)));
              const menuNames = new Set(menuProducts.map((product) => product.name));
              const catalogProducts = menuProducts
                .filter((product) => {
                  if (product.name === "赤ワイン" && menuNames.has("赤")) return false;
                  if (product.name === "白ワイン" && menuNames.has("白")) return false;
                  return true;
                })
                .sort((a, b) => MENU_ORDER.indexOf(a.name) - MENU_ORDER.indexOf(b.name));
              const categories = ["All", "Alcohol", "Wine", "Soft Drinks"];
              const visibleProducts = selectedCategory === "All"
                ? catalogProducts
                : catalogProducts.filter((product) => getMenuPresentation(product.name)?.category === selectedCategory);
              return (
                <>
                  <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`shrink-0 rounded-md border px-4 py-2 text-sm font-semibold transition ${
                          selectedCategory === category
                            ? "border-[#D7B77C] bg-[#4A182A] text-[#F3D9AE]"
                            : "border-[#6A243D] bg-[#261019] text-[#C5B7BA] hover:bg-[#4A182A]"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {(selectedCategory === "All" ? ["Alcohol", "Wine", "Soft Drinks"] : [selectedCategory]).map((category) => {
                      const categoryProducts = visibleProducts.filter((product) => getMenuPresentation(product.name)?.category === category);
                      if (categoryProducts.length === 0) return null;
                      return (
                        <section key={category} className="space-y-3">
                          <div className="flex items-baseline justify-between border-b border-[#6A243D] pb-3 pt-2">
                            <span className="font-serif text-lg font-medium tracking-normal text-[#F3EDEB]">{category}</span>
                            <span className="text-sm tracking-wide text-[#D7B77C]">¥{CATEGORY_PRICES[category].toLocaleString("en-US")}</span>
                          </div>
                          {categoryProducts.map((product) => {
                            const presentation = getMenuPresentation(product.name)!;
                            const optionHint = presentation.optionType === "temperature"
                              ? "Hot / Ice"
                              : presentation.optionType === "mixer"
                                ? "Orange / Soda"
                                : null;
                            return (
                              <article key={product.id} className="rounded-md border border-[#6A243D] bg-gradient-to-br from-[#35131F] to-[#261019] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="mb-0.5 text-xs tracking-[0.12em] text-[#B8A8AD]">{presentation.reading}</p>
                                    <p className="font-sans text-lg font-medium tracking-normal text-[#F3EDEB]">{presentation.english}</p>
                                    {optionHint && <p className="mt-1 text-[11px] tracking-wide text-[#A18F96]">{optionHint}</p>}
                                    {!product.is_available && <p className="mt-1 text-xs font-semibold tracking-wide text-[#F08A91]">売り切れ</p>}
                                  </div>
                                  <button
                                    onClick={() => presentation.optionType ? setOptionProduct(product) : addToCart(product)}
                                    disabled={!product.is_available}
                                    className="shrink-0 rounded-md border border-[#C65A73]/60 bg-[#A51D43] px-4 py-2.5 text-sm font-semibold tracking-wide text-[#FFF9F5] transition hover:bg-[#C02A52] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[#6A243D] disabled:bg-[#4A182A] disabled:text-[#A18F96]"
                                  >
                                    {product.is_available ? "＋ 追加" : "売り切れ"}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </section>
                      );
                    })}
                    {visibleProducts.length === 0 && (
                      <div className="rounded-md border border-dashed border-[#6A243D] bg-[#261019] p-8 text-center text-sm text-[#A18F96]">
                        このカテゴリの商品はありません。
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* 注文状況 */}
        {customerTab === "orders" && (
          <section className="mt-7">
            <div className="mb-4">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">YOUR ORDERS</p>
              <h2 className="mt-1 font-serif text-2xl font-medium tracking-wide text-[#F3EDEB]">Your Orders</h2>
            </div>
            {currentOrders.length === 0 ? (
              <div className="rounded-md border border-[#6A243D] bg-[#261019] p-7 text-center">
                <p className="text-sm text-[#C5B7BA]">現在、提供待ちのご注文はありません。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentOrders.map((order) => {
                  const orderDate = formatOrderDate(order.created_at);
                  const currentOrderTotal = order.items.reduce((sum, item) => sum + item.price * (item.quantity - item.cancelled_quantity), 0);
                  const activeItems = order.items.filter((item) => item.served_quantity + item.cancelled_quantity < item.quantity);
                  const allItemsServed = activeItems.length === 0;
                  const someItemsServed = order.items.some((item) => item.served_quantity > 0);
                  return (
                    <article key={order.id} className="rounded-md border border-[#6A243D] bg-[#261019] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-sm bg-[#35131F] px-2.5 py-1 text-sm font-medium text-[#F3EDEB]">{orderDate.date}</span>
                            <span className="rounded-sm bg-[#35131F] px-2.5 py-1 text-sm font-medium text-[#F3EDEB]">{orderDate.time}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#A18F96]">注文番号 #{order.id}</p>
                        </div>
                        <span className="rounded-full border border-[#C65A73]/50 bg-[#4A182A] px-3 py-1 text-xs font-bold text-[#D7B77C]">
                          {allItemsServed ? "提供済み" : someItemsServed ? "一部提供" : "提供待ち"}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 border-t border-[#6A243D] pt-4">
                        {order.items.map((item, index) => {
                          const served = item.served_quantity;
                          const fullyServed = served + item.cancelled_quantity >= item.quantity;
                          const partiallyServed = served > 0 && served + item.cancelled_quantity < item.quantity;
                          return (
                            <div key={index} className="flex items-center justify-between gap-3 text-sm">
                              <span className={item.cancelled_quantity > 0 ? "text-[#A18F96]" : fullyServed ? "text-[#D7B77C]" : "text-[#F3EDEB]"}>
                                {getMenuPresentation(item.productName)?.english ?? item.productName} × {item.quantity}
                                {item.option && <span className="ml-2 inline-flex rounded-sm border border-[#C65A73]/60 bg-[#4A182A] px-2 py-0.5 text-[11px] font-bold text-[#F3D9AE]">{item.option.toUpperCase()}</span>}
                              </span>
                              <span className="shrink-0 text-right text-xs font-semibold text-[#C5B7BA]">
                                {item.cancelled_quantity >= item.quantity ? "キャンセル済み" : item.cancelled_quantity > 0 ? `${item.cancelled_quantity}点キャンセル・${served}点提供済み` : fullyServed ? "提供済み" : partiallyServed ? `${served} / ${item.quantity} 提供済み` : `0 / ${item.quantity} 提供待ち`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 border-t border-[#6A243D] pt-3 text-right font-semibold text-[#D7B77C]">¥{currentOrderTotal.toLocaleString("en-US")}</div>
                    </article>
                  );
                })}
              </div>
            )}


          </section>
        )}

        {/* 注文履歴 */}
        {customerTab === "history" && (
          <section className="mt-7">
            <div className="mb-4">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">ORDER HISTORY</p>
              <h2 className="mt-1 font-serif text-2xl font-medium tracking-wide text-[#F3EDEB]">Order History</h2>
            </div>
            {servedOrders.length === 0 ? (
              <div className="rounded-md border border-[#6A243D] bg-[#261019] p-7 text-center text-sm text-[#A18F96]">提供済みのご注文はまだありません。</div>
            ) : (
              <div className="space-y-4">
                {[...servedOrders].reverse().map((order) => {
                  const orderDate = formatOrderDate(order.created_at);
                  const currentOrderTotal = order.items.reduce((sum, item) => sum + item.price * (item.quantity - item.cancelled_quantity), 0);
                  return (
                    <article key={order.id} className="rounded-md border border-[#6A243D] bg-[#261019] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-sm bg-[#35131F] px-2.5 py-1 text-sm font-medium text-[#F3EDEB]">{orderDate.date}</span>
                            <span className="rounded-sm bg-[#35131F] px-2.5 py-1 text-sm font-medium text-[#F3EDEB]">{orderDate.time}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#A18F96]">注文番号 #{order.id}</p>
                        </div>
                        <span className="rounded-full border border-[#C65A73]/50 bg-[#4A182A] px-3 py-1 text-xs font-bold text-[#D7B77C]">{order.items.every((item) => item.cancelled_quantity >= item.quantity) ? "キャンセル済み" : order.items.some((item) => item.cancelled_quantity > 0) ? "キャンセル商品あり" : "提供済み"}</span>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-[#6A243D] pt-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between gap-3 text-sm text-[#F3EDEB]">
                            <span className={item.cancelled_quantity > 0 ? "text-[#A18F96] line-through" : ""}>{getMenuPresentation(item.productName)?.english ?? item.productName} × {item.quantity}{item.option && <span className="ml-2 inline-flex rounded-sm border border-[#C65A73]/60 bg-[#4A182A] px-2 py-0.5 text-[11px] font-bold text-[#F3D9AE]">{item.option.toUpperCase()}</span>}
                              {item.cancelled_quantity > 0 && <span className="ml-2 text-xs font-semibold text-[#F08A91] no-underline">{item.cancelled_quantity >= item.quantity ? "キャンセル済み" : `一部キャンセル（${item.cancelled_quantity}点）`}</span>}</span>
                            <span className="shrink-0 text-right text-xs text-[#C5B7BA]">
                              ¥{(item.price * (item.quantity - item.cancelled_quantity)).toLocaleString("en-US")}
                              <span className="block text-[10px] text-[#A18F96]">{item.cancelled_quantity >= item.quantity ? "キャンセル済み" : item.cancelled_quantity > 0 ? `一部キャンセル ${item.cancelled_quantity}点` : item.served_quantity >= item.quantity ? "提供済み" : "提供待ち"}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-[#6A243D] pt-3 text-right font-semibold text-[#D7B77C]">¥{currentOrderTotal.toLocaleString("en-US")}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
            <div className="w-full max-w-sm rounded-md border border-[#6A243D] bg-[#261019] p-5 shadow-2xl">
              <h2 className="text-xl font-black text-[#F3EDEB]">
                お支払い方法
              </h2>
              <p className="mt-2 text-sm text-[#C5B7BA]">
                ご希望のお支払い方法を選択してください。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => requestCheckout("cash")}
                  className="rounded-md bg-[#4A182A] px-4 py-5 font-bold text-[#F3EDEB] transition hover:bg-[#6A243D]"
                >
                  現金
                </button>
                <button
                  onClick={() => requestCheckout("paypay")}
                  className="rounded-md bg-[#4A182A] px-4 py-5 font-bold text-[#F3EDEB] transition hover:bg-[#6A243D]"
                >
                  PayPay
                </button>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="mt-4 w-full rounded-md border border-[#6A243D] px-4 py-3 font-bold text-[#C5B7BA] transition hover:bg-[#35131F]"
              >
                戻る
              </button>
            </div>
          </div>
        )}


      </div>

      {/* カート・お会計の固定ボタン */}
      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md gap-2">
        <button
          onClick={() => setCartOpen(true)}
          className={`${checkoutOrders.length > 0 ? "flex-1" : "w-full"} rounded-md border border-[#C65A73]/50 bg-[#4A182A] px-4 py-4 font-semibold text-[#FFF9F5] shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition hover:bg-[#6A243D] active:scale-[0.99]`}
        >
          カート{cartQuantity > 0 ? ` ・ ${cartQuantity}点 ・ ¥${total.toLocaleString("ja-JP")}` : "を見る"}
        </button>
        {checkoutOrders.length > 0 && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex-1 rounded-md bg-[#A51D43] px-4 py-4 font-semibold text-[#FFF9F5] shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition hover:bg-[#C02A52] active:scale-[0.99]"
          >
            お会計へ ・ ¥{orderTotal.toLocaleString("ja-JP")}
          </button>
        )}
      </div>

      {/* 商品オプション選択 */}
      {optionProduct && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0A080B]/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-md border border-[#6A243D] bg-[#261019] p-5 shadow-2xl">
            <p className="text-[10px] tracking-[0.2em] text-[#D7B77C]">SELECT OPTION</p>
            <h2 className="mt-1 font-sans text-2xl text-[#F3EDEB]">{getMenuPresentation(optionProduct.name)?.english}</h2>
            <p className="mt-1 text-xs text-[#A18F96]">{getMenuPresentation(optionProduct.name)?.reading}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(getMenuPresentation(optionProduct.name)?.optionType === "temperature" ? ["Hot", "Ice"] : ["Orange", "Soda"]).map((option) => (
                <button key={option} onClick={() => addToCart(optionProduct, option)} className="rounded-md border border-[#C65A73]/60 bg-[#4A182A] px-4 py-4 font-sans text-lg text-[#F3EDEB] transition hover:bg-[#6A243D]">{option}</button>
              ))}
            </div>
            <button onClick={() => setOptionProduct(null)} className="mt-4 w-full rounded-md border border-[#6A243D] px-4 py-3 text-sm text-[#C5B7BA]">戻る</button>
          </div>
        </div>
      )}

      {/* カート */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A080B]/70">
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl bg-[#261019] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-medium text-[#F3EDEB]">
                カート
              </h2>

              <button
                onClick={() => setCartOpen(false)}
                className="rounded-md bg-[#4A182A] px-3 py-2 text-lg text-[#F3EDEB]"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-[#A18F96]">
                カートは空です
              </div>
            ) : (
              <>
                <div className="mt-5 max-h-[50vh] space-y-4 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.option ?? "default"}`}
                      className="border-b border-[#6A243D] pb-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#F3EDEB]">
                            {getMenuPresentation(item.name)?.english ?? item.name}
                          </p>
                          {item.option && <span className="mt-1 inline-flex rounded-sm border border-[#C65A73]/60 bg-[#4A182A] px-2 py-0.5 text-[11px] font-bold text-[#F3D9AE]">{item.option.toUpperCase()}</span>}

                          <p className="text-sm text-[#C5B7BA]">
                            ¥{item.price.toLocaleString("en-US")} ×{" "}
                            {item.quantity}
                          </p>
                        </div>

                        <p className="font-bold text-[#F3EDEB]">
                          ¥{(item.price * item.quantity).toLocaleString("en-US")}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <button
                          onClick={() =>
                            changeCartQuantity(
                              item.id,
                              item.option,
                              -1
                            )
                          }
                          className="h-10 w-10 rounded-md bg-[#4A182A] text-xl font-bold text-[#F3EDEB]"
                        >
                          −
                        </button>

                        <span className="font-bold text-[#F3EDEB]">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            changeCartQuantity(
                              item.id,
                              item.option,
                              1
                            )
                          }
                          className="h-10 w-10 rounded-md bg-[#4A182A] text-xl font-bold text-[#F3EDEB]"
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-[#6A243D] pt-4">
                  <div className="flex items-center justify-between text-xl font-bold text-[#F3EDEB]">
                    <span>合計</span>
                    <span>¥{total.toLocaleString("en-US")}</span>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={loading}
                    className="mt-4 w-full rounded-md bg-[#A51D43] px-4 py-4 font-bold text-[#FFF9F5] shadow-sm transition hover:bg-[#C02A52] disabled:opacity-50"
                  >
                    {loading
                      ? "注文中..."
                      : "注文する"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <footer className="mt-10 pb-2 text-center text-[9px] tracking-[0.14em] text-[#76515E]">{APP_VERSION}</footer>
    </main>
  );
}