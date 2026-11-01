"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  customer_id: string;
  status: string;
  checkout_status: string | null;
  payment_method: string | null;
  created_at: string;
  nickname: string;
  items: {
    id: number;
    name: string;
    price: number;
    quantity: number;
    served_quantity: number;
    status: string;
  }[];
};

type StaffCall = {
  id: number;
  customer_id: string;
  nickname: string;
  status: string;
  created_at: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category: string | null;
  is_available: boolean;
};

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "calls" | "products" | "history">("orders");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [staffCalls, setStaffCalls] = useState<StaffCall[]>([]);
  const [updatingCallIds, setUpdatingCallIds] = useState<number[]>([]);

  // 商品管理用
  const [products, setProducts] = useState<Product[]>([]);
  const [updatingProductIds, setUpdatingProductIds] = useState<number[]>([]);

  useEffect(() => {
    const loadStaffCalls = async () => {
      const { data, error } = await supabase
        .from("staff_calls")
        .select("id, customer_id, nickname, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("スタッフ呼び出し取得エラー:", error);
        return;
      }

      setStaffCalls(data || []);
    };

    const loadOrders = async () => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .neq("checkout_status", "paid")
        .neq("checkout_status", "cancelled")
        .order("created_at", { ascending: true });

      if (ordersError) {
        console.error("注文取得エラー:", ordersError);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const customerIds = [
        ...new Set(ordersData.map((order) => order.customer_id)),
      ];

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, nickname")
        .in("id", customerIds);

      if (customersError) {
        console.error("お客様取得エラー:", customersError);
        return;
      }

      const orderIds = ordersData.map((order) => order.id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, served_quantity, status"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("注文商品取得エラー:", itemsError);
        return;
      }

      const productIds = [
        ...new Set((itemsData || []).map((item) => item.product_id)),
      ];

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds);

      if (productsError) {
        console.error("商品取得エラー:", productsError);
        return;
      }

      const ordersWithDetails = ordersData.map((order) => {
        const customer = customersData?.find(
          (customer) => customer.id === order.customer_id
        );

        const orderItems = (itemsData || [])
          .filter((item) => item.order_id === order.id)
          .map((item) => {
            const product = productsData?.find(
              (product) => product.id === item.product_id
            );

            const servedQuantity = item.served_quantity ?? 0;

            return {
              id: item.id,
              name: product?.name ?? "不明な商品",
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              status:
                servedQuantity >= item.quantity
                  ? "served"
                  : "pending",
            };
          });

        const allServed =
          orderItems.length > 0 &&
          orderItems.every(
            (item) => item.served_quantity >= item.quantity
          );

        return {
          ...order,
          status: allServed ? "served" : "pending",
          nickname: customer?.nickname ?? "不明",
          items: orderItems,
        };
      });

      const sortedOrders = [...ordersWithDetails].sort((a, b) => {
        const aServed = a.status === "served";
        const bServed = b.status === "served";

        if (aServed !== bServed) {
          return aServed ? 1 : -1;
        }

        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      });

      setOrders(sortedOrders);
    };

    const loadHistory = async () => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("checkout_status", "paid")
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("履歴取得エラー:", ordersError);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setHistoryOrders([]);
        return;
      }

      const customerIds = [
        ...new Set(ordersData.map((order) => order.customer_id)),
      ];

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, nickname")
        .in("id", customerIds);

      if (customersError) {
        console.error("履歴のお客様取得エラー:", customersError);
        return;
      }

      const orderIds = ordersData.map((order) => order.id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, served_quantity, status"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("履歴の商品取得エラー:", itemsError);
        return;
      }

      const productIds = [
        ...new Set((itemsData || []).map((item) => item.product_id)),
      ];

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds);

      if (productsError) {
        console.error("履歴の商品取得エラー:", productsError);
        return;
      }

      const ordersWithDetails = ordersData.map((order) => {
        const customer = customersData?.find(
          (customer) => customer.id === order.customer_id
        );

        const orderItems = (itemsData || [])
          .filter((item) => item.order_id === order.id)
          .map((item) => {
            const product = productsData?.find(
              (product) => product.id === item.product_id
            );

            const servedQuantity = item.served_quantity ?? 0;

            return {
              id: item.id,
              name: product?.name ?? "不明な商品",
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              status:
                servedQuantity >= item.quantity
                  ? "served"
                  : "pending",
            };
          });

        const allServed =
          orderItems.length > 0 &&
          orderItems.every(
            (item) => item.served_quantity >= item.quantity
          );

        return {
          ...order,
          status: allServed ? "served" : "pending",
          nickname: customer?.nickname ?? "不明",
          items: orderItems,
        };
      });

      setHistoryOrders(ordersWithDetails);
    };

    // 商品一覧を取得
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, category, is_available")
        .order("id", { ascending: true });

      if (error) {
        console.error("商品一覧取得エラー:", error);
        return;
      }

      setProducts(data || []);
    };

    loadOrders();
    loadHistory();
    loadProducts();
    loadStaffCalls();

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
          loadHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
          loadHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_items",
        },
        () => {
          loadOrders();
          loadHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
        },
        () => {
          loadProducts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_calls",
        },
        () => {
          loadStaffCalls();
        }
      )
      .subscribe((status, err) => {
        console.log("Realtime status:", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // スタッフ呼び出しを対応済みにする
  const completeStaffCall = async (call: StaffCall) => {
    if (updatingCallIds.includes(call.id)) return;

    setUpdatingCallIds((current) => [...current, call.id]);

    const { error } = await supabase
      .from("staff_calls")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", call.id)
      .eq("status", "pending");

    if (error) {
      console.error("呼び出し対応完了エラー:", error);
      alert("呼び出しを対応済みにできませんでした");
    } else {
      setStaffCalls((current) => current.filter((item) => item.id !== call.id));
    }

    setUpdatingCallIds((current) => current.filter((id) => id !== call.id));
  };

  // 商品の販売状態を切り替える
  const toggleProductAvailability = async (product: Product) => {
    if (updatingProductIds.includes(product.id)) return;

    const nextAvailability = !product.is_available;

    setUpdatingProductIds((current) => [...current, product.id]);

    const { error } = await supabase
      .from("products")
      .update({
        is_available: nextAvailability,
      })
      .eq("id", product.id);

    if (error) {
      console.error("商品状態変更エラー:", error);
      alert("商品の販売状態の変更に失敗しました");
    } else {
      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? {
                ...currentProduct,
                is_available: nextAvailability,
              }
            : currentProduct
        )
      );
    }

    setUpdatingProductIds((current) =>
      current.filter((id) => id !== product.id)
    );
  };

  // 商品を1個提供する
  const serveOneItem = async (
    orderId: number,
    itemId: number
  ) => {
    const targetOrder = orders.find(
      (order) => order.id === orderId
    );

    if (!targetOrder) return;

    const targetItem = targetOrder.items.find(
      (item) => item.id === itemId
    );

    if (!targetItem) return;

    if (targetItem.served_quantity >= targetItem.quantity) {
      return;
    }

    const newServedQuantity =
      targetItem.served_quantity + 1;

    const newStatus =
      newServedQuantity >= targetItem.quantity
        ? "served"
        : "pending";

    const { error } = await supabase
      .from("order_items")
      .update({
        served_quantity: newServedQuantity,
        status: newStatus,
      })
      .eq("id", itemId);

    if (error) {
      console.error(error);
      alert("提供状態の変更に失敗しました");
      return;
    }

    const updatedItems = targetOrder.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            served_quantity: newServedQuantity,
            status: newStatus,
          }
        : item
    );

    const allServed =
      updatedItems.length > 0 &&
      updatedItems.every(
        (item) => item.served_quantity >= item.quantity
      );

    setOrders((currentOrders) =>
      currentOrders
        .map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: updatedItems,
                status: allServed ? "served" : "pending",
              }
            : order
        )
        .sort((a, b) => {
          const aServed = a.status === "served";
          const bServed = b.status === "served";

          if (aServed !== bServed) {
            return aServed ? 1 : -1;
          }

          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );
        })
    );

    await supabase
      .from("orders")
      .update({
        status: allServed ? "served" : "pending",
      })
      .eq("id", orderId);
  };

  // 注文の商品を全部提供済みにする
  const serveAllItems = async (orderId: number) => {
    const targetOrder = orders.find(
      (order) => order.id === orderId
    );

    if (!targetOrder) return;

    for (const item of targetOrder.items) {
      const { error: itemError } = await supabase
        .from("order_items")
        .update({
          served_quantity: item.quantity,
          status: "served",
        })
        .eq("id", item.id);

      if (itemError) {
        console.error(itemError);
        alert("一括提供済みへの変更に失敗しました");
        return;
      }
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        status: "served",
      })
      .eq("id", orderId);

    if (orderError) {
      console.error(orderError);
      alert("注文状態の変更に失敗しました");
      return;
    }

    setOrders((currentOrders) =>
      currentOrders
        .map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: "served",
                items: order.items.map((item) => ({
                  ...item,
                  served_quantity: item.quantity,
                  status: "served",
                })),
              }
            : order
        )
        .sort((a, b) => {
          const aServed = a.status === "served";
          const bServed = b.status === "served";

          if (aServed !== bServed) {
            return aServed ? 1 : -1;
          }

          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );
        })
    );
  };

  // 会計を完了する
  const completeCheckout = async (order: Order) => {
    const total = (order.items ?? []).reduce(
      (sum, item) =>
        sum + item.price * item.quantity,
      0
    );

    const confirmed = window.confirm(
      `${order.nickname}様の会計を完了しますか？\n\n合計 ¥${total}`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .update({
        checkout_status: "paid",
      })
      .eq("customer_id", order.customer_id)
      .eq("checkout_status", "requested");

    if (error) {
      console.error(error);
      alert("会計済みへの変更に失敗しました");
      return;
    }


    setOrders((currentOrders) =>
      currentOrders.filter(
        (currentOrder) =>
          !(
            currentOrder.customer_id ===
              order.customer_id &&
            currentOrder.checkout_status ===
              "requested"
          )
      )
    );
  };

  // お客様の端末をリセットする
  const resetCustomerTerminal = async (
    customerId: string,
    nickname: string
  ) => {
    const confirmed = window.confirm(
      `${nickname}様の端末をリセットしますか？\n\nお客様の画面がニックネーム入力画面に戻ります。`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("customers")
      .update({ reset_at: new Date().toISOString() })
      .eq("id", customerId);

    if (error) {
      console.error("端末リセットエラー:", error);
      alert("端末リセットに失敗しました");
      return;
    }

    alert(`${nickname}様の端末をリセットしました`);
  };

  // 注文をキャンセルする
  const cancelOrder = async (order: Order) => {
    const hasServedItems = order.items.some(
      (item) => item.served_quantity > 0
    );

    if (order.checkout_status !== "none" || hasServedItems) {
      alert("会計依頼済み、または提供を開始した注文はキャンセルできません。");
      return;
    }

    const confirmed = window.confirm(
      `${order.nickname}様の注文（注文ID：${order.id}）をキャンセルしますか？\n\nこの操作は取り消せません。`
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("orders")
      .update({
        checkout_status: "cancelled",
      })
      .eq("id", order.id)
      .eq("checkout_status", "none")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("注文キャンセルエラー:", error);
      alert("注文のキャンセルに失敗しました。注文状態が変わっていないか確認してください。");
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.filter((currentOrder) => currentOrder.id !== order.id)
    );
  };

  // 会計履歴から追加注文可能な状態に戻す
  const reopenForAdditionalOrder = async (
    customerId: string,
    nickname: string
  ) => {
    const confirmed = window.confirm(
      `${nickname}様を追加注文可能な状態に戻しますか？\n\n会計済みの注文が現在の注文に戻ります。`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .update({
        checkout_status: "none",
      })
      .eq("customer_id", customerId)
      .eq("checkout_status", "paid");

    if (error) {
      console.error(error);
      alert("追加注文可能への変更に失敗しました");
      return;
    }

    setHistoryOrders((currentOrders) =>
      currentOrders.filter(
        (order) => order.customer_id !== customerId
      )
    );
  };

  const formatDate = (dateString: string) => {
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

  const displayOrders = showHistory
    ? historyOrders
    : orders;

  const activeCustomers = Array.from(
    orders.reduce((customerMap, order) => {
      const existing = customerMap.get(order.customer_id);

      if (existing) {
        existing.orderCount += 1;
        existing.itemCount += order.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      } else {
        customerMap.set(order.customer_id, {
          customer_id: order.customer_id,
          nickname: order.nickname,
          orderCount: 1,
          itemCount: order.items.reduce(
            (sum, item) => sum + item.quantity,
            0
          ),
        });
      }

      return customerMap;
    }, new Map<string, {
      customer_id: string;
      nickname: string;
      orderCount: number;
      itemCount: number;
    }>())
  ).map(([, customer]) => customer);

  const visibleOrders = selectedCustomerId
    ? orders.filter((order) => order.customer_id === selectedCustomerId)
    : orders;

  const unservedOrders = visibleOrders.filter(
    (order) => order.status !== "served"
  );

  const servedOrders = visibleOrders.filter(
    (order) => order.status === "served"
  );

  const renderOrder = (order: Order) => {
    const total = (order.items ?? []).reduce(
      (sum, item) =>
        sum + item.price * item.quantity,
      0
    );

    const orderDate = formatDate(order.created_at);

    return (
      <div
        key={order.id}
        className="rounded-xl border border-[#49323F] bg-[#1B151A] p-4 shadow-lg shadow-black/20"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-[#F3EDEB]">
              {order.nickname}様
            </p>

            <p className="mt-1 text-sm text-[#C5B7BA]">
              {orderDate.date} {orderDate.time}
            </p>
          </div>

          <div className="text-right">
            {showHistory && (
              <span className="text-sm font-bold text-[#D8B58A]">
                🟢 会計済み
              </span>
            )}

            {!showHistory &&
              order.checkout_status === "requested" && (
                <span className="text-sm font-bold text-[#D7B77C]">
                  🟠 お会計依頼中
                </span>
              )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(order.items ?? []).map((item) => {
            const isFullyServed =
              item.served_quantity >= item.quantity;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-[#49323F] bg-[#261D23] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={`font-bold ${
                        isFullyServed
                          ? "text-[#D8B58A]"
                          : "text-[#F3EDEB]"
                      }`}
                    >
                      {isFullyServed && "🟢 "}
                      {item.name} × {item.quantity}
                    </p>

                    <p className="mt-1 text-sm text-[#C5B7BA]">
                      ¥{item.price * item.quantity}
                    </p>

                    <p
                      className={`mt-1 text-sm font-bold ${
                        isFullyServed
                          ? "text-[#D8B58A]"
                          : "text-[#D7B77C]"
                      }`}
                    >
                      提供済み：{item.served_quantity} /{" "}
                      {item.quantity}
                    </p>
                  </div>

                  {!showHistory &&
                    !isFullyServed && (
                      <button
                        onClick={() =>
                          serveOneItem(
                            order.id,
                            item.id
                          )
                        }
                        className="shrink-0 rounded-lg bg-[#71364F] px-3 py-2 text-sm font-bold text-[#FFF9F5] transition hover:bg-[#87445F]"
                      >
                        ＋ 提供
                      </button>
                    )}

                  {isFullyServed && (
                    <span className="shrink-0 text-sm font-bold text-[#D8B58A]">
                      提供完了
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-[#49323F] pt-4 text-xl font-bold text-[#F3EDEB]">
          合計 ¥{total}
        </div>

        <div className="mt-4 border-t border-[#49323F] pt-4 text-sm text-[#C5B7BA]">
          <p>注文ID：{order.id}</p>

          {!showHistory && (
            <>
              <p
                className={`mt-1 font-bold ${
                  order.status === "served"
                    ? "text-[#D8B58A]"
                    : "text-[#D7B77C]"
                }`}
              >
                状態：
                {order.status === "served"
                  ? "🟢 提供済み"
                  : "🟠 未提供"}
              </p>

              {order.status !== "served" && (
                <button
                  onClick={() =>
                    serveAllItems(order.id)
                  }
                  className="mt-4 w-full rounded-lg bg-[#71364F] px-4 py-3 font-bold text-[#FFF9F5] transition hover:bg-[#87445F]"
                >
                  この注文を全部提供済みにする
                </button>
              )}

              <p
                className={`mt-3 font-bold ${
                  order.checkout_status ===
                  "requested"
                    ? "text-[#D7B77C]"
                    : "text-[#C5B7BA]"
                }`}
              >
                お会計：
                {order.checkout_status ===
                "requested"
                  ? "🟠 お会計依頼中"
                  : order.checkout_status ===
                      "none"
                    ? "未会計"
                    : "未設定"}
              </p>

              {order.checkout_status === "requested" && (
                <p className="mt-2 font-bold text-[#D8B58A]">
                  支払い方法：{order.payment_method === "cash"
                    ? "現金"
                    : order.payment_method === "paypay"
                      ? "PayPay"
                      : "未選択"}
                </p>
              )}

              {order.checkout_status ===
                "requested" && (
                <button
                  onClick={() =>
                    completeCheckout(order)
                  }
                  className="mt-4 w-full rounded-lg bg-[#71364F] px-4 py-3 font-bold text-[#FFF9F5] transition hover:bg-[#87445F]"
                >
                  会計済みにする
                </button>
              )}
              {order.checkout_status === "none" &&
                order.items.every(
                  (item) => item.served_quantity === 0
                ) && (
                  <button
                    onClick={() => cancelOrder(order)}
                    className="mt-3 w-full rounded-lg border border-[#A9785D] bg-[#382832] px-4 py-3 font-bold text-[#F3D9AE] transition hover:bg-[#49323F]"
                  >
                    この注文をキャンセル
                  </button>
                )}
            </>
          )}

          {showHistory && (
            <>
              <p className="mt-2 font-bold text-[#D8B58A]">
                支払い方法：{order.payment_method === "cash"
                  ? "現金"
                  : order.payment_method === "paypay"
                    ? "PayPay"
                    : "未選択（旧データ）"}
              </p>
              <button
                onClick={() =>
                  reopenForAdditionalOrder(
                    order.customer_id,
                    order.nickname
                  )
                }
                className="mt-4 w-full rounded-lg bg-[#382832] px-4 py-3 font-bold text-[#F3EDEB] transition hover:bg-[#49323F]"
              >
                追加注文を受け付ける
              </button>

              <button
                onClick={() =>
                  resetCustomerTerminal(
                    order.customer_id,
                    order.nickname
                  )
                }
                className="mt-3 w-full rounded-lg border border-[#71364F] bg-[#382832] px-4 py-3 font-bold text-[#F3D9AE] transition hover:bg-[#49323F]"
              >
                端末をリセット
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const orderBadgeCount = orders.filter((order) => order.status !== "served" || order.checkout_status === "requested").length;
  const soldOutCount = products.filter((product) => !product.is_available).length;

  const tabs = [
    { id: "orders" as const, label: "注文", badge: orderBadgeCount },
    { id: "customers" as const, label: "お客様", badge: activeCustomers.length },
    { id: "calls" as const, label: "呼び出し", badge: staffCalls.length },
    { id: "products" as const, label: "商品", badge: soldOutCount },
    { id: "history" as const, label: "履歴", badge: 0 },
  ];

  return (
    <main className="min-h-screen bg-[#100D10] px-3 py-5 text-[#F3EDEB] sm:px-6 sm:py-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-3 border-b border-[#49323F] pb-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.34em] text-[#D7B77C]">BAR & MUSIC</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[0.22em] text-[#F3EDEB]">myonga</h1>
            <p className="mt-1 text-xs tracking-wide text-[#A18F96]">STAFF CONSOLE</p>
          </div>
          <span className="rounded-full border border-[#49323F] bg-[#1B151A] px-3 py-1.5 text-xs text-[#C5B7BA]">管理画面</span>
        </header>

        <nav className="sticky top-0 z-30 -mx-3 mb-6 grid grid-cols-5 gap-1 border-y border-[#49323F] bg-[#100D10]/95 px-2 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-[#1B151A] sm:p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowHistory(tab.id === "history");
                if (tab.id !== "customers") setSelectedCustomerId(null);
              }}
              className={`relative flex min-h-12 items-center justify-center rounded-xl px-1 py-2 text-xs font-semibold tracking-wide transition sm:text-sm ${
                activeTab === tab.id
                  ? "bg-[#71364F] text-[#FFF9F5] shadow-[0_5px_16px_rgba(0,0,0,0.28)]"
                  : "text-[#C5B7BA] hover:bg-[#382832]"
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#100D10] bg-[#C83D4D] px-1 text-[10px] font-black leading-none text-white">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {activeTab === "orders" && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">ORDER MANAGEMENT</p>
                <h2 className="mt-1 text-2xl font-semibold">注文管理</h2>
              </div>
              <span className="text-xs text-[#A18F96]">未提供 {unservedOrders.length}件</span>
            </div>
            {selectedCustomerId && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-[#A9785D]/50 bg-[#261D23] px-4 py-3">
                <span className="text-sm text-[#D7B77C]">お客様を絞り込み中</span>
                <button onClick={() => setSelectedCustomerId(null)} className="text-sm font-semibold text-[#F3EDEB] underline underline-offset-4">解除</button>
              </div>
            )}
            <div className="mb-7">
              <h3 className="mb-3 text-sm font-semibold tracking-wide text-[#D7B77C]">未提供</h3>
              <div className="space-y-3">
                {unservedOrders.map(renderOrder)}
                {unservedOrders.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">未提供の注文はありません。</p>}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold tracking-wide text-[#C5B7BA]">提供済み</h3>
              <div className="space-y-3">
                {servedOrders.map(renderOrder)}
                {servedOrders.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">提供済みの注文はありません。</p>}
              </div>
            </div>
          </section>
        )}

        {activeTab === "customers" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">GUESTS</p>
              <h2 className="mt-1 text-2xl font-semibold">お客様一覧</h2>
              <p className="mt-2 text-sm text-[#A18F96]">お客様を選択すると、その方の注文だけを表示します。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeCustomers.map((customer) => {
                const selected = selectedCustomerId === customer.customer_id;
                return (
                  <button key={customer.customer_id} onClick={() => { setSelectedCustomerId(selected ? null : customer.customer_id); setActiveTab("orders"); setShowHistory(false); }} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#D7B77C] bg-[#382832]" : "border-[#49323F] bg-[#1B151A] hover:bg-[#261D23]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#F3EDEB]">{customer.nickname} 様</span>
                      <span className="text-xs text-[#D7B77C]">注文を見る →</span>
                    </div>
                    <p className="mt-2 text-sm text-[#C5B7BA]">{customer.orderCount}件の注文 / 商品 {customer.itemCount}点</p>
                  </button>
                );
              })}
              {activeCustomers.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">現在ご注文中のお客様はいません。</p>}
            </div>
          </section>
        )}

        {activeTab === "calls" && (
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">GUEST ASSISTANCE</p>
                <h2 className="mt-1 text-2xl font-semibold">スタッフ呼び出し</h2>
              </div>
              <span className="rounded-full border border-[#A9785D]/50 bg-[#382832] px-3 py-1 text-sm font-semibold text-[#D7B77C]">未対応 {staffCalls.length}件</span>
            </div>
            <div className="space-y-3">
              {staffCalls.map((call) => (
                <article key={call.id} className="rounded-2xl border border-[#A9785D]/40 bg-gradient-to-br from-[#261D23] to-[#1B151A] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#F3EDEB]">{call.nickname} 様</p>
                      <p className="mt-1 text-xs text-[#D7B77C]">{new Date(call.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 呼び出し</p>
                    </div>
                    <span className="rounded-full bg-[#C83D4D]/15 px-3 py-1 text-xs font-bold text-[#F08A91]">未対応</span>
                  </div>
                  <button onClick={() => completeStaffCall(call)} disabled={updatingCallIds.includes(call.id)} className="mt-4 w-full rounded-xl bg-[#71364F] px-4 py-3 font-semibold text-[#FFF9F5] transition hover:bg-[#87445F] disabled:opacity-50">{updatingCallIds.includes(call.id) ? "更新中..." : "対応済みにする"}</button>
                </article>
              ))}
              {staffCalls.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">未対応の呼び出しはありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "products" && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">MENU CONTROL</p>
                <h2 className="mt-1 text-2xl font-semibold">商品管理</h2>
              </div>
              <span className="text-xs text-[#C5B7BA]">販売中 {products.filter((product) => product.is_available).length} / {products.length}</span>
            </div>
            <p className="mb-4 text-sm text-[#A18F96]">売り切れにすると、お客様側のメニューに表示されなくなります。</p>
            <div className="space-y-3">
              {products.map((product) => {
                const isUpdating = updatingProductIds.includes(product.id);
                return (
                  <article key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#49323F] bg-[#1B151A] p-4">
                    <div className="min-w-0">
                      <p className={`font-semibold ${product.is_available ? "text-[#F3EDEB]" : "text-[#A18F96]"}`}>{product.name}</p>
                      <p className="mt-1 text-sm text-[#C5B7BA]">{product.category || "カテゴリ未設定"} / ¥{product.price.toLocaleString("ja-JP")}</p>
                      <p className={`mt-1 text-xs font-semibold ${product.is_available ? "text-[#D7B77C]" : "text-[#F08A91]"}`}>{product.is_available ? "販売中" : "売り切れ"}</p>
                    </div>
                    <button onClick={() => toggleProductAvailability(product)} disabled={isUpdating} className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold text-[#FFF9F5] transition disabled:opacity-50 ${product.is_available ? "bg-[#382832] hover:bg-[#49323F]" : "bg-[#71364F] hover:bg-[#87445F]"}`}>{isUpdating ? "更新中..." : product.is_available ? "売り切れにする" : "販売中に戻す"}</button>
                  </article>
                );
              })}
              {products.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">商品が登録されていません。</p>}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">PAYMENT HISTORY</p>
              <h2 className="mt-1 text-2xl font-semibold">会計履歴</h2>
            </div>
            <div className="space-y-3">
              {displayOrders.map(renderOrder)}
              {displayOrders.length === 0 && <p className="rounded-xl border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">会計履歴はありません。</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
