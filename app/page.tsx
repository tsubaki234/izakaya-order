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
};

type CustomerOrder = {
  id: number;
  status: string;
  checkout_status: string | null;
  created_at: string;
  items: {
    productName: string;
    price: number;
    quantity: number;
    served_quantity: number;
    status: string;
  }[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [loading, setLoading] = useState(false);

  const [nickname, setNickname] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [checkingCustomer, setCheckingCustomer] = useState(true);

  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([]);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);

  // 注文を読み込む + Realtime監視
  useEffect(() => {
    if (!customerId) return;

    const loadOrderHistory = async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, checkout_status, created_at")
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
          "order_id, product_id, quantity, served_quantity, status"
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
          created_at: order.created_at,
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

  // お客さん情報を読み込む
  useEffect(() => {
    const loadCustomer = async () => {
      const savedCustomerId = localStorage.getItem("customer_id");

      if (savedCustomerId) {
        const { data, error } = await supabase
          .from("customers")
          .select("id, nickname")
          .eq("id", savedCustomerId)
          .single();

        if (!error && data) {
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
        .eq("is_available", true)
        .order("id");

      if (error) {
        console.error(error);
        return;
      }

      setProducts(data || []);
    };

    loadProducts();
  }, []);

  // お客さん登録
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

  // カートに追加
  const addToCart = (product: Product) => {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  // カートの個数を変更
  const changeCartQuantity = (
    productId: number,
    amount: number
  ) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity + amount,
              }
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

  // お会計依頼
  const requestCheckout = async () => {
    if (!customerId) return;

    if (checkoutOrders.length === 0) {
      alert("現在お会計できる注文がありません");
      return;
    }

    const confirmed = window.confirm(
      "お会計しますか？\n\nスタッフがお会計の準備をします。\n会計依頼後は追加注文できなくなります。"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .update({
        checkout_status: "requested",
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

    alert("お会計を承りました");
  };

  // 注文する
  const placeOrder = async () => {
    if (cart.length === 0 || !customerId || checkoutRequested) {
      return;
    }

    setLoading(true);

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
      <main className="flex min-h-screen items-center justify-center bg-[#171c1a] p-6">
        <p className="text-[#f1f3f1]">読み込み中...</p>
      </main>
    );
  }

  if (!customerId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171c1a] p-6">
        <div className="w-full max-w-md rounded-2xl bg-[#242a27] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <h1 className="text-2xl font-black text-[#f1f3f1]">
            ON AIR
          </h1>

          <p className="mt-3 text-[#aeb7b2]">
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
            className="mt-4 w-full rounded-xl border border-[#39423e] bg-[#303733] p-3 text-[#f1f3f1] outline-none placeholder:text-[#89938e] focus:border-[#456f68] focus:ring-2 focus:ring-[#456f68]/20"
          />

          <button
            onClick={registerCustomer}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-[#456f68] px-4 py-3 font-bold text-[#f5f7f6] shadow-sm transition hover:bg-[#528077] disabled:opacity-50"
          >
            {loading ? "登録中..." : "入店する"}
          </button>
        </div>
      </main>
    );
  }

  if (ordered) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171c1a] p-6">
        <div className="w-full max-w-md rounded-2xl bg-[#242a27] p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <h1 className="text-2xl font-black text-[#f1f3f1]">
            注文しました！
          </h1>

          <p className="mt-3 text-[#aeb7b2]">
            {nickname}さん、ご注文ありがとうございます。
          </p>

          <p className="mt-2 text-[#aeb7b2]">
            商品が届くまで少々お待ちください。
          </p>

          <button
            onClick={() => {
              setOrdered(false);
              window.location.reload();
            }}
            className="mt-6 w-full rounded-xl bg-[#456f68] px-4 py-3 font-bold text-[#f5f7f6] shadow-sm transition hover:bg-[#528077]"
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
      <main className="min-h-screen bg-[#171c1a] p-6">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl bg-[#242a27] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            <h1 className="text-2xl font-black text-[#f1f3f1]">
              お会計
            </h1>

            <p className="mt-2 text-[#aeb7b2]">
              {nickname}さん
            </p>

            <div className="mt-5 rounded-lg bg-[#292f2c] p-4 text-center">
              <p className="font-bold text-[#d7a866]">
                お会計を承りました
              </p>

              <p className="mt-1 text-sm text-[#aeb7b2]">
                スタッフがお会計の準備をしています
              </p>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-bold text-[#f1f3f1]">
                ご注文履歴
              </h2>

              <div className="mt-4 space-y-4">
                {checkoutOrders.map((order) => {
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
                      className="rounded-lg border border-[#414b46] bg-[#303733] p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-[#f1f3f1]">
                            {orderDate.date}{" "}
                            {orderDate.time}
                          </p>

                          <p className="mt-1 text-sm text-[#aeb7b2]">
                            注文ID：{order.id}
                          </p>
                        </div>

                        <span className="text-sm font-bold text-[#f1f3f1]">
                          ¥{currentOrderTotal}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-[#f1f3f1]"
                          >
                            <span>
                              {item.productName} ×{" "}
                              {item.quantity}
                            </span>

                            <span>
                              ¥
                              {item.price *
                                item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 border-t border-[#414b46] pt-5">
              <div className="flex items-center justify-between text-2xl font-bold text-[#f1f3f1]">
                <span>お会計合計</span>
                <span>¥{orderTotal}</span>
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-[#aeb7b2]">
              お会計が完了するまで追加注文はできません。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#171c1a] p-6 pb-28">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-black tracking-tight text-[#f1f3f1]">
          ON AIR
        </h1>

        <p className="mt-2 text-[#aeb7b2]">
          {nickname}さん
        </p>

        {/* ページ切り替え */}
        <div className="mt-6 flex rounded-lg bg-[#242a27] p-1 shadow">
          <button
            onClick={() => setShowOrderHistory(false)}
            className={`flex-1 rounded-md px-4 py-2 font-bold ${
              !showOrderHistory
                ? "bg-[#456f68] text-[#f5f7f6]"
                : "bg-[#292f2c] text-[#aeb7b2] hover:bg-[#343c38]"
            }`}
          >
            現在の注文
          </button>

          <button
            onClick={() => setShowOrderHistory(true)}
            className={`flex-1 rounded-md px-4 py-2 font-bold ${
              showOrderHistory
                ? "bg-[#456f68] text-[#f5f7f6]"
                : "bg-[#292f2c] text-[#aeb7b2] hover:bg-[#343c38]"
            }`}
          >
            注文履歴
          </button>
        </div>

        {/* 現在の注文 */}
        {!showOrderHistory && (
          <>
            <div className="mt-6">
              <h2 className="text-xl font-black text-[#f1f3f1]">
                現在の注文
              </h2>

              {currentOrders.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#242a27] p-6 text-center shadow">
                  <p className="text-[#89938e]">
                    現在提供待ちの注文はありません。
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {currentOrders.map((order) => {
                    const orderDate = formatOrderDate(
                      order.created_at
                    );

                    const currentOrderTotal =
                      (order.items ?? []).reduce(
                        (sum, item) =>
                          sum +
                          item.price * item.quantity,
                        0
                      );

                    const allItemsServed =
                      order.items.length > 0 &&
                      order.items.every(
                        (item) =>
                          item.served_quantity >=
                          item.quantity
                      );

                    const someItemsServed =
                      order.items.some(
                        (item) =>
                          item.served_quantity > 0
                      );

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl bg-[#242a27] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-[#f1f3f1]">
                              {orderDate.date}{" "}
                              {orderDate.time}
                            </p>

                            <p className="mt-1 text-sm text-[#aeb7b2]">
                              注文ID：{order.id}
                            </p>
                          </div>

                          <span
                            className={`font-bold ${
                              allItemsServed
                                ? "text-[#82b995]"
                                : "text-[#d7a866]"
                            }`}
                          >
                            {allItemsServed
                              ? "🟢 提供済み"
                              : someItemsServed
                              ? "🟠 一部提供"
                              : "🟠 提供待ち"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {order.items.map(
                            (item, index) => {
                              const servedQuantity =
                                item.served_quantity;

                              const isFullyServed =
                                servedQuantity >=
                                item.quantity;

                              const isPartiallyServed =
                                servedQuantity > 0 &&
                                servedQuantity <
                                  item.quantity;

                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between"
                                >
                                  <span
                                    className={
                                      isFullyServed
                                        ? "text-[#8fbd9e]"
                                        : "text-[#edf0ee]"
                                    }
                                  >
                                    {isFullyServed &&
                                      "🟢 "}
                                    {item.productName} ×{" "}
                                    {item.quantity}
                                  </span>

                                  <div className="flex items-center gap-3">
                                    <span className="text-[#f1f3f1]">
                                      ¥
                                      {item.price *
                                        item.quantity}
                                    </span>

                                    <span
                                      className={`text-sm font-bold ${
                                        isFullyServed
                                          ? "text-[#82b995]"
                                          : "text-[#d7a866]"
                                      }`}
                                    >
                                      {isFullyServed
                                        ? "提供済み"
                                        : isPartiallyServed
                                        ? `${servedQuantity} / ${item.quantity} 提供済み`
                                        : `0 / ${item.quantity} 提供待ち`}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>

                        <div className="mt-3 border-t border-[#414b46] pt-3 text-right font-bold text-[#f1f3f1]">
                          ¥{currentOrderTotal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 会計 */}
            {checkoutOrders.length > 0 && (
              <div className="mt-6 rounded-2xl bg-[#242a27] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between text-xl font-bold text-[#f1f3f1]">
                  <span>現在のお会計</span>
                  <span>¥{orderTotal}</span>
                </div>

                <button
                  onClick={requestCheckout}
                  className="mt-4 w-full rounded-lg bg-[#456f68] px-4 py-3 font-bold text-[#f5f7f6] transition hover:bg-[#528077]"
                >
                  お会計
                </button>
              </div>
            )}
          </>
        )}

        {/* 注文履歴 */}
        {showOrderHistory && (
          <div className="mt-6">
            <h2 className="text-xl font-black text-[#f1f3f1]">
              注文履歴
            </h2>

            {servedOrders.length === 0 ? (
              <div className="mt-4 rounded-xl bg-[#242a27] p-6 text-center shadow">
                <p className="text-[#89938e]">
                  まだ注文履歴はありません。
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {[...servedOrders]
                  .reverse()
                  .map((order) => {
                    const orderDate = formatOrderDate(
                      order.created_at
                    );

                    const currentOrderTotal =
                      (order.items ?? []).reduce(
                        (sum, item) =>
                          sum +
                          item.price * item.quantity,
                        0
                      );

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl bg-[#242a27] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-[#f1f3f1]">
                              {orderDate.date}{" "}
                              {orderDate.time}
                            </p>

                            <p className="mt-1 text-sm text-[#aeb7b2]">
                              注文ID：{order.id}
                            </p>
                          </div>

                          <span className="font-bold text-[#82b995]">
                            🟢 提供済み
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {order.items.map(
                            (item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between text-[#f1f3f1]"
                              >
                                <span>
                                  {item.productName} ×{" "}
                                  {item.quantity}
                                </span>

                                <span>
                                  ¥
                                  {item.price *
                                    item.quantity}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div className="mt-4 border-t border-[#414b46] pt-3 text-right text-lg font-bold text-[#f1f3f1]">
                          ¥{currentOrderTotal}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* メニュー */}
        <div className="mt-8">
          <h2 className="text-xl font-black text-[#f1f3f1]">
            メニュー
          </h2>

          <div className="mt-4 space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl bg-[#242a27] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
              >
                <h3 className="text-lg font-bold text-[#f1f3f1]">
                  {product.name}
                </h3>

                <p className="text-[#aeb7b2]">
                  ¥{product.price}
                </p>

                <button
                  onClick={() => addToCart(product)}
                  className="mt-3 w-full rounded-xl bg-[#456f68] px-4 py-3 font-bold text-[#f5f7f6] shadow-sm transition hover:bg-[#528077] active:scale-[0.98]"
                >
                  カートに追加
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* カート固定ボタン */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl bg-[#456f68] px-5 py-4 font-bold text-[#f5f7f6] shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:bg-[#528077] active:scale-[0.99]"
      >
        🛒 カート
        {cartQuantity > 0 && (
          <>
            <span className="mx-2">・</span>
            {cartQuantity}点
            <span className="mx-2">・</span>
            ¥{total}
          </>
        )}
      </button>

      {/* カート */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl bg-[#242a27] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#f1f3f1]">
                カート
              </h2>

              <button
                onClick={() => setCartOpen(false)}
                className="rounded-full bg-[#303733] px-3 py-2 text-lg text-[#f1f3f1]"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-[#89938e]">
                カートは空です
              </div>
            ) : (
              <>
                <div className="mt-5 max-h-[50vh] space-y-4 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="border-b border-[#414b46] pb-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#f1f3f1]">
                            {item.name}
                          </p>

                          <p className="text-sm text-[#aeb7b2]">
                            ¥{item.price} ×{" "}
                            {item.quantity}
                          </p>
                        </div>

                        <p className="font-bold text-[#f1f3f1]">
                          ¥{item.price * item.quantity}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <button
                          onClick={() =>
                            changeCartQuantity(
                              item.id,
                              -1
                            )
                          }
                          className="h-10 w-10 rounded-lg bg-[#3f4844] text-xl font-bold text-[#f1f3f1]"
                        >
                          −
                        </button>

                        <span className="font-bold text-[#f1f3f1]">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            changeCartQuantity(
                              item.id,
                              1
                            )
                          }
                          className="h-10 w-10 rounded-lg bg-[#3f4844] text-xl font-bold text-[#f1f3f1]"
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-[#414b46] pt-4">
                  <div className="flex items-center justify-between text-xl font-bold text-[#f1f3f1]">
                    <span>合計</span>
                    <span>¥{total}</span>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl bg-[#527d65] px-4 py-4 font-bold text-[#f5f7f6] shadow-sm transition hover:bg-[#629477] disabled:opacity-50"
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