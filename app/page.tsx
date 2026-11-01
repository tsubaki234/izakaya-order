"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  items: {
    productName: string;
    option: string | null;
    price: number;
    quantity: number;
    served_quantity: number;
    status: string;
  }[];
};

const MENU_PRESENTATION: Record<string, { english: string; reading: string; category: string; optionType?: "temperature" | "mixer" }> = {
  "ビール": { english: "Beer", reading: "ビール", category: "Alcohol" },
  "ハイボール": { english: "Highball", reading: "ハイボール", category: "Alcohol" },
  "レモンサワー": { english: "Lemon Sour", reading: "レモンサワー", category: "Alcohol" },
  "コーン茶ハイ": { english: "Corn Tea Highball", reading: "コーンチャハイ", category: "Alcohol" },
  "ウーロンハイ": { english: "Oolong Tea Highball", reading: "ウーロンハイ", category: "Alcohol" },
  "カシス": { english: "Cassis", reading: "カシス", category: "Alcohol", optionType: "mixer" },
  "赤": { english: "Red Wine", reading: "アカ", category: "Wine" },
  "白": { english: "White Wine", reading: "シロ", category: "Wine" },
  "赤ワイン": { english: "Red Wine", reading: "アカワイン", category: "Wine" },
  "白ワイン": { english: "White Wine", reading: "シロワイン", category: "Wine" },
  "オレンジジュース": { english: "Orange Juice", reading: "オレンジジュース", category: "Soft Drinks" },
  "コーヒー": { english: "Coffee", reading: "コーヒー", category: "Soft Drinks", optionType: "temperature" },
  "コーン茶": { english: "Corn Tea", reading: "コーンチャ", category: "Soft Drinks", optionType: "temperature" },
  "ウーロン茶": { english: "Oolong Tea", reading: "ウーロンチャ", category: "Soft Drinks", optionType: "temperature" },
};

const CATEGORY_PRICES: Record<string, number> = {
  Alcohol: 800,
  Wine: 1200,
  "Soft Drinks": 600,
};

const getMenuPresentation = (name: string) => MENU_PRESENTATION[name];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [optionProduct, setOptionProduct] = useState<Product | null>(null);
  const [ordered, setOrdered] = useState(false);
  const [loading, setLoading] = useState(false);

  const [nickname, setNickname] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [checkingCustomer, setCheckingCustomer] = useState(true);

  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([]);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [staffCallPending, setStaffCallPending] = useState(false);
  const [callingStaff, setCallingStaff] = useState(false);
  const [customerTab, setCustomerTab] = useState<"menu" | "orders" | "history">("menu");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [checkoutDisplayOrders, setCheckoutDisplayOrders] = useState<
    CustomerOrder[]
  >([]);

  // 注文を読み込む + Realtime監視
  useEffect(() => {
    if (!customerId) return;

    const loadOrderHistory = async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, checkout_status, payment_method, created_at")
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
      if (hasCheckoutRequest) {
        setCheckoutDisplayOrders(
          orders
            .filter((order) => order.checkout_status === "requested")
            .map((order) => ({
              id: order.id,
              status: "pending",
              checkout_status: order.checkout_status,
              payment_method: order.payment_method,
              created_at: order.created_at,
              items: [],
            }))
        );
      }

      const orderIds = orders.map((order) => order.id);

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "order_id, product_id, quantity, served_quantity, status, option"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error(itemsError);
        return;
      }

      if (!items || items.length === 0) {
        setOrderHistory([]);
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

            return {
              productName: product?.name ?? "不明な商品",
              option: item.option ?? null,
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              status:
                servedQuantity >= item.quantity
                  ? "served"
                  : "pending",
            };
          });

        const allItemsServed =
          orderItems.length > 0 &&
          orderItems.every(
            (item) => item.served_quantity >= item.quantity
          );

        return {
          id: order.id,
          status: allItemsServed ? "served" : "pending",
          checkout_status: order.checkout_status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          items: orderItems,
        };
      });

      setOrderHistory(history);
      if (hasCheckoutRequest) {
        setCheckoutDisplayOrders(
          history.filter((order) => order.checkout_status === "requested")
        );
      }
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
          };

          if (!updatedCustomer.reset_at) return;

          localStorage.removeItem("customer_id");
          setCustomerId(null);
          setNickname("");
          setNicknameInput("");
          setOrderHistory([]);
          setCustomerTab("menu");
          setSelectedCategory("All");
          setCheckoutRequested(false);
          setCheckoutDisplayOrders([]);
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

  // お客様情報を読み込む
  useEffect(() => {
    const loadCustomer = async () => {
      const savedCustomerId = localStorage.getItem("customer_id");

      if (savedCustomerId) {
        const { data, error } = await supabase
          .from("customers")
          .select("id, nickname, reset_at")
          .eq("id", savedCustomerId)
          .single();

        if (!error && data && !data.reset_at) {
          setCustomerId(data.id);
          setNickname(data.nickname);
        } else {
          localStorage.removeItem("customer_id");
        }
      }

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

  // お客様登録
  const registerCustomer = async () => {
    const name = nicknameInput.trim();

    if (!name) {
      alert("ニックネームを入力してください");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        nickname: name,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("登録に失敗しました");
      setLoading(false);
      return;
    }

    localStorage.setItem("customer_id", data.id);

    setCustomerId(data.id);
    setNickname(data.nickname);
    setLoading(false);
  };

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

  // 現在注文中の注文だけ
  const currentOrders = orderHistory.filter(
    (order) =>
      order.checkout_status === "none" &&
      order.items.some(
        (item) => item.served_quantity < item.quantity
      )
  );

  // 提供済みの注文
  const servedOrders = orderHistory.filter((order) =>
    order.items.length > 0 &&
    order.items.every(
      (item) => item.served_quantity >= item.quantity
    )
  );

  // 会計対象の注文
  const checkoutOrders = orderHistory.filter(
    (order) =>
      order.checkout_status === "none"
  );

  // 会計対象の合計
  const orderTotal = checkoutOrders.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (orderSum, item) =>
          orderSum + item.price * item.quantity,
        0
      ),
    0
  );

  // 会計画面に表示する注文
  const checkoutDisplayTotal = checkoutDisplayOrders.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (orderSum, item) =>
          orderSum + item.price * item.quantity,
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
      `支払い方法：${paymentLabel}\n\nお会計を依頼しますか？\n会計依頼後は追加注文できなくなります。`
    );

    if (!confirmed) return;

    // 会計依頼前の注文を会計画面用に保存
    setCheckoutDisplayOrders(
      checkoutOrders.map((order) => ({
        ...order,
        payment_method: paymentMethod,
      }))
    );

    const { error } = await supabase
      .from("orders")
      .update({
        checkout_status: "requested",
        payment_method: paymentMethod,
      })
      .eq("customer_id", customerId)
      .eq("checkout_status", "none");

    if (error) {
      console.error(error);
      alert("お会計の依頼に失敗しました");
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
    if (cart.length === 0 || !customerId || checkoutRequested || loading) {
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

    // すべて販売中なら注文登録
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        table_number: 0,
        customer_id: customerId,
        status: "pending",
        checkout_status: "none",
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);
      alert("注文に失敗しました");
      setLoading(false);
      return;
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      option: item.option,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items);

    if (itemsError) {
      console.error(itemsError);
      alert("注文内容の登録に失敗しました");
      setLoading(false);
      return;
    }

    setCart([]);
    setCartOpen(false);
    setOrdered(true);
    setLoading(false);
  };

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);

    return {
      date: date.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  if (checkingCustomer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100D10] p-6">
        <p className="text-[#F3EDEB]">読み込み中...</p>
      </main>
    );
  }

  if (!customerId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100D10] p-6">
        <div className="w-full max-w-md rounded-md bg-[#1B151A] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h1 className="text-2xl font-black text-[#F3EDEB]">
            myonga
          </h1>

          <p className="mt-3 text-[#C5B7BA]">
            ニックネームを入力してください
          </p>

          <input
            type="text"
            value={nicknameInput}
            onChange={(e) =>
              setNicknameInput(e.target.value)
            }
            placeholder="例：はるき"
            maxLength={20}
            className="mt-4 w-full rounded-md border border-[#49323F] bg-[#261D23] p-3 text-[#F3EDEB] outline-none placeholder:text-[#A18F96] focus:border-[#71364F] focus:ring-2 focus:ring-[#71364F]/20"
          />

          <button
            onClick={registerCustomer}
            disabled={loading}
            className="mt-4 w-full rounded-md bg-[#71364F] px-4 py-3 font-bold text-[#FFF9F5] shadow-sm transition hover:bg-[#87445F] disabled:opacity-50"
          >
            {loading ? "登録中..." : "入店する"}
          </button>
        </div>
      </main>
    );
  }

  if (ordered) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100D10] p-6">
        <div className="w-full max-w-md rounded-md bg-[#1B151A] p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h1 className="text-2xl font-black text-[#F3EDEB]">
            注文しました！
          </h1>

          <p className="mt-3 text-[#C5B7BA]">
            {nickname}様、ご注文ありがとうございます。
          </p>

          <p className="mt-2 text-[#C5B7BA]">
            商品が届くまで少々お待ちください。
          </p>

          <button
            onClick={() => {
              setOrdered(false);
              window.location.reload();
            }}
            className="mt-6 w-full rounded-md bg-[#71364F] px-4 py-3 font-bold text-[#FFF9F5] shadow-sm transition hover:bg-[#87445F]"
          >
            メニューに戻る
          </button>
        </div>
      </main>
    );
  }

  // 会計依頼後の画面
  if (checkoutRequested) {
    return (
      <main style={{ fontFamily: 'Georgia, "Times New Roman", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif' }} className="min-h-screen bg-[#100D10] p-6">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-md bg-[#1B151A] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
            <h1 className="text-2xl font-black text-[#F3EDEB]">
              お会計
            </h1>

            <p className="mt-2 text-[#C5B7BA]">
              {nickname}様
            </p>

            <div className="mt-5 rounded-md bg-[#261D23] p-4 text-center">
              <p className="font-bold text-[#D7B77C]">
                お会計を承りました
              </p>

              <p className="mt-1 text-sm text-[#C5B7BA]">
                スタッフがお会計の準備をしています
              </p>
            </div>

            <div className="mt-4 rounded-md border border-[#49323F] bg-[#261D23] p-3 text-center">
              <p className="text-sm text-[#A18F96]">お支払い方法</p>
              <p className="mt-1 font-bold text-[#F3EDEB]">
                {checkoutDisplayOrders[0]?.payment_method === "cash"
                  ? "現金"
                  : checkoutDisplayOrders[0]?.payment_method === "paypay"
                    ? "PayPay"
                    : "未設定"}
              </p>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-bold text-[#F3EDEB]">
                ご注文履歴
              </h2>

              <div className="mt-4 space-y-4">
                {checkoutDisplayOrders.map((order) => {
                  const orderDate = formatOrderDate(
                    order.created_at
                  );

                  const currentOrderTotal =
                    (order.items ?? []).reduce(
                      (sum, item) =>
                        sum + item.price * item.quantity,
                      0
                    );

                  return (
                    <div
                      key={order.id}
                      className="rounded-md border border-[#49323F] bg-[#261D23] p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-[#F3EDEB]">
                            {orderDate.date}{" "}
                            {orderDate.time}
                          </p>

                          <p className="mt-1 text-sm text-[#C5B7BA]">
                            注文ID：{order.id}
                          </p>
                        </div>

                        <span className="text-sm font-bold text-[#F3EDEB]">
                          ¥{currentOrderTotal.toLocaleString("en-US")}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-[#F3EDEB]"
                          >
                            <span>
                              {item.productName} ×{" "}
                              {item.quantity}
                            </span>

                            <span>
                              ¥{(item.price * item.quantity).toLocaleString("en-US")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 border-t border-[#49323F] pt-5">
              <div className="flex items-center justify-between text-2xl font-bold text-[#F3EDEB]">
                <span>お会計合計</span>
                <span>¥{checkoutDisplayTotal.toLocaleString("en-US")}</span>
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-[#A18F96]">
              お会計が完了するまで追加注文はできません。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'Georgia, "Times New Roman", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif' }} className="min-h-screen bg-[#100D10] p-6 pb-28">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-[0.22em] text-[#F3EDEB]">
          myonga
        </h1>

        <p className="mt-2 text-sm tracking-wide text-[#C5B7BA]">{nickname} 様</p>

        <button
          onClick={callStaff}
          disabled={callingStaff || staffCallPending}
          className={`mt-4 w-full rounded-md border border-[#A9785D]/50 px-4 py-3 font-semibold tracking-wide transition ${
            staffCallPending
              ? "bg-[#382832] text-[#C5B7BA]"
              : "bg-[#71364F] text-[#FFF9F5] hover:bg-[#87445F]"
          } disabled:cursor-not-allowed disabled:opacity-80`}
        >
          {callingStaff
            ? "呼び出し中..."
            : staffCallPending
              ? "🔔 スタッフを呼び出しています"
              : "🔔 スタッフを呼ぶ"}
        </button>
        {staffCallPending && (
          <p className="mt-2 text-center text-xs text-[#A18F96]">
            スタッフが対応を完了すると、もう一度呼び出せます。
          </p>
        )}

        {/* メインタブ */}
        <nav className="mt-7 grid grid-cols-3 gap-2 rounded-md border border-[#49323F] bg-[#1B151A] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
          {([
            ["menu", "メニュー"],
            ["orders", "注文状況"],
            ["history", "注文履歴"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setCustomerTab(tab)}
              className={`relative rounded-md px-2 py-3 text-sm font-bold tracking-wide transition ${
                customerTab === tab
                  ? "bg-[#71364F] text-[#FFF9F5] shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
                  : "text-[#C5B7BA] hover:bg-[#382832]"
              }`}
            >
              {label}
              {tab === "orders" && currentOrders.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#1B151A] bg-[#C83D4D] px-1 text-[10px] font-black text-white">
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
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">MENU</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold tracking-wide text-[#F3EDEB]">Menu</h2>
              </div>
              <span className="text-xs text-[#A18F96]">{products.filter((product) => Boolean(getMenuPresentation(product.name))).length} items</span>
            </div>

            {(() => {
              const catalogProducts = products.filter((product) => Boolean(getMenuPresentation(product.name)));
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
                            ? "border-[#D7B77C] bg-[#382832] text-[#F3D9AE]"
                            : "border-[#49323F] bg-[#1B151A] text-[#C5B7BA] hover:bg-[#382832]"
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
                          <div className="flex items-baseline justify-between border-b border-[#49323F] pb-3 pt-2">
                            <span className="font-serif text-lg tracking-wide text-[#F3EDEB]">{category}</span>
                            <span className="text-sm tracking-wide text-[#D7B77C]">¥{CATEGORY_PRICES[category].toLocaleString("en-US")}</span>
                          </div>
                          {categoryProducts.map((product) => {
                            const presentation = getMenuPresentation(product.name)!;
                            const optionHint = presentation.optionType === "temperature"
                              ? "Hot / Iced available"
                              : presentation.optionType === "mixer"
                                ? "Orange / Soda available"
                                : null;
                            return (
                              <article key={product.id} className="rounded-md border border-[#49323F] bg-gradient-to-br from-[#261D23] to-[#1B151A] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="mb-0.5 text-[10px] tracking-[0.16em] text-[#A18F96]">{presentation.reading}</p>
                                    <p className="font-serif text-lg tracking-wide text-[#F3EDEB]">{presentation.english}</p>
                                    {optionHint && <p className="mt-1 text-[11px] tracking-wide text-[#A18F96]">{optionHint}</p>}
                                    {!product.is_available && <p className="mt-1 text-xs font-semibold tracking-wide text-[#F08A91]">SOLD OUT</p>}
                                  </div>
                                  <button
                                    onClick={() => presentation.optionType ? setOptionProduct(product) : addToCart(product)}
                                    disabled={!product.is_available}
                                    className="shrink-0 rounded-md border border-[#A9785D]/60 bg-[#71364F] px-4 py-2.5 text-sm font-semibold tracking-wide text-[#FFF9F5] transition hover:bg-[#87445F] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[#49323F] disabled:bg-[#382832] disabled:text-[#A18F96]"
                                  >
                                    {product.is_available ? "＋ Add" : "Unavailable"}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </section>
                      );
                    })}
                    {visibleProducts.length === 0 && (
                      <div className="rounded-md border border-dashed border-[#49323F] bg-[#1B151A] p-8 text-center text-sm text-[#A18F96]">
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
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-wide text-[#F3EDEB]">Your Orders</h2>
            </div>
            {currentOrders.length === 0 ? (
              <div className="rounded-md border border-[#49323F] bg-[#1B151A] p-7 text-center">
                <p className="text-sm text-[#C5B7BA]">現在、提供待ちのご注文はありません。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentOrders.map((order) => {
                  const orderDate = formatOrderDate(order.created_at);
                  const currentOrderTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                  const allItemsServed = order.items.length > 0 && order.items.every((item) => item.served_quantity >= item.quantity);
                  const someItemsServed = order.items.some((item) => item.served_quantity > 0);
                  return (
                    <article key={order.id} className="rounded-md border border-[#49323F] bg-[#1B151A] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#F3EDEB]">{orderDate.date} {orderDate.time}</p>
                          <p className="mt-1 text-xs text-[#A18F96]">注文番号 #{order.id}</p>
                        </div>
                        <span className="rounded-full border border-[#A9785D]/50 bg-[#382832] px-3 py-1 text-xs font-bold text-[#D7B77C]">
                          {allItemsServed ? "提供済み" : someItemsServed ? "一部提供" : "提供待ち"}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 border-t border-[#49323F] pt-4">
                        {order.items.map((item, index) => {
                          const served = item.served_quantity;
                          const fullyServed = served >= item.quantity;
                          const partiallyServed = served > 0 && served < item.quantity;
                          return (
                            <div key={index} className="flex items-center justify-between gap-3 text-sm">
                              <span className={fullyServed ? "text-[#D7B77C]" : "text-[#F3EDEB]"}>{getMenuPresentation(item.productName)?.english ?? item.productName}{item.option ? ` · ${item.option}` : ""} × {item.quantity}</span>
                              <span className="shrink-0 text-right text-xs font-semibold text-[#C5B7BA]">
                                {fullyServed ? "提供済み" : partiallyServed ? `${served} / ${item.quantity} 提供済み` : `0 / ${item.quantity} 提供待ち`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 border-t border-[#49323F] pt-3 text-right font-semibold text-[#D7B77C]">¥{currentOrderTotal.toLocaleString("en-US")}</div>
                    </article>
                  );
                })}
              </div>
            )}

            {checkoutOrders.length > 0 && (
              <div className="mt-5 rounded-md border border-[#A9785D]/50 bg-gradient-to-br from-[#382832] to-[#1B151A] p-4">
                <div className="flex items-center justify-between text-lg font-semibold text-[#F3EDEB]">
                  <span>お会計合計</span><span className="text-[#D7B77C]">¥{orderTotal.toLocaleString("en-US")}</span>
                </div>
                <button onClick={() => setShowPaymentModal(true)} className="mt-4 w-full rounded-md bg-[#71364F] px-4 py-3.5 font-bold text-[#FFF9F5] transition hover:bg-[#87445F]">お会計へ進む</button>
              </div>
            )}
          </section>
        )}

        {/* 注文履歴 */}
        {customerTab === "history" && (
          <section className="mt-7">
            <div className="mb-4">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">ORDER HISTORY</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-wide text-[#F3EDEB]">Order History</h2>
            </div>
            {servedOrders.length === 0 ? (
              <div className="rounded-md border border-[#49323F] bg-[#1B151A] p-7 text-center text-sm text-[#A18F96]">提供済みのご注文はまだありません。</div>
            ) : (
              <div className="space-y-4">
                {[...servedOrders].reverse().map((order) => {
                  const orderDate = formatOrderDate(order.created_at);
                  const currentOrderTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                  return (
                    <article key={order.id} className="rounded-md border border-[#49323F] bg-[#1B151A] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#F3EDEB]">{orderDate.date} {orderDate.time}</p>
                          <p className="mt-1 text-xs text-[#A18F96]">注文番号 #{order.id}</p>
                        </div>
                        <span className="rounded-full border border-[#A9785D]/50 bg-[#382832] px-3 py-1 text-xs font-bold text-[#D7B77C]">提供済み</span>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-[#49323F] pt-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between gap-3 text-sm text-[#F3EDEB]">
                            <span>{getMenuPresentation(item.productName)?.english ?? item.productName}{item.option ? ` · ${item.option}` : ""} × {item.quantity}</span>
                            <span className="text-[#C5B7BA]">¥{(item.price * item.quantity).toLocaleString("en-US")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-[#49323F] pt-3 text-right font-semibold text-[#D7B77C]">¥{currentOrderTotal.toLocaleString("en-US")}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
            <div className="w-full max-w-sm rounded-md border border-[#49323F] bg-[#1B151A] p-5 shadow-2xl">
              <h2 className="text-xl font-black text-[#F3EDEB]">
                お支払い方法
              </h2>
              <p className="mt-2 text-sm text-[#C5B7BA]">
                ご希望のお支払い方法を選択してください。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => requestCheckout("cash")}
                  className="rounded-md bg-[#382832] px-4 py-5 font-bold text-[#F3EDEB] transition hover:bg-[#49323F]"
                >
                  💴 現金
                </button>
                <button
                  onClick={() => requestCheckout("paypay")}
                  className="rounded-md bg-[#382832] px-4 py-5 font-bold text-[#F3EDEB] transition hover:bg-[#49323F]"
                >
                  PayPay
                </button>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="mt-4 w-full rounded-md border border-[#49323F] px-4 py-3 font-bold text-[#C5B7BA] transition hover:bg-[#261D23]"
              >
                戻る
              </button>
            </div>
          </div>
        )}


      </div>

      {/* カート固定ボタン */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-md bg-[#71364F] px-5 py-4 font-bold text-[#FFF9F5] shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition hover:bg-[#87445F] active:scale-[0.99]"
      >
        Your Cart
        {cartQuantity > 0 && (
          <>
            <span className="mx-2">・</span>
            {cartQuantity} items
            <span className="mx-2">・</span>
            ¥{total.toLocaleString("en-US")}
          </>
        )}
      </button>

      {/* 商品オプション選択 */}
      {optionProduct && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0A080B]/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-md border border-[#49323F] bg-[#1B151A] p-5 shadow-2xl">
            <p className="text-[10px] tracking-[0.2em] text-[#D7B77C]">SELECT OPTION</p>
            <h2 className="mt-1 font-serif text-2xl text-[#F3EDEB]">{getMenuPresentation(optionProduct.name)?.english}</h2>
            <p className="mt-1 text-xs text-[#A18F96]">{getMenuPresentation(optionProduct.name)?.reading}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(getMenuPresentation(optionProduct.name)?.optionType === "temperature" ? ["Hot", "Iced"] : ["Orange", "Soda"]).map((option) => (
                <button key={option} onClick={() => addToCart(optionProduct, option)} className="rounded-md border border-[#A9785D]/60 bg-[#382832] px-4 py-4 font-serif text-lg text-[#F3EDEB] transition hover:bg-[#49323F]">{option}</button>
              ))}
            </div>
            <button onClick={() => setOptionProduct(null)} className="mt-4 w-full rounded-md border border-[#49323F] px-4 py-3 text-sm text-[#C5B7BA]">Cancel</button>
          </div>
        </div>
      )}

      {/* カート */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A080B]/70">
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl bg-[#1B151A] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#F3EDEB]">
                Your Cart
              </h2>

              <button
                onClick={() => setCartOpen(false)}
                className="rounded-md bg-[#382832] px-3 py-2 text-lg text-[#F3EDEB]"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-[#A18F96]">
                Your cart is empty
              </div>
            ) : (
              <>
                <div className="mt-5 max-h-[50vh] space-y-4 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.option ?? "default"}`}
                      className="border-b border-[#49323F] pb-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#F3EDEB]">
                            {getMenuPresentation(item.name)?.english ?? item.name}{item.option ? ` · ${item.option}` : ""}
                          </p>

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
                          className="h-10 w-10 rounded-md bg-[#382832] text-xl font-bold text-[#F3EDEB]"
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
                          className="h-10 w-10 rounded-md bg-[#382832] text-xl font-bold text-[#F3EDEB]"
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-[#49323F] pt-4">
                  <div className="flex items-center justify-between text-xl font-bold text-[#F3EDEB]">
                    <span>合計</span>
                    <span>¥{total.toLocaleString("en-US")}</span>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={loading}
                    className="mt-4 w-full rounded-md bg-[#71364F] px-4 py-4 font-bold text-[#FFF9F5] shadow-sm transition hover:bg-[#87445F] disabled:opacity-50"
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
    </main>
  );
}