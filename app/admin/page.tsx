"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  customer_id: string;
  status: string;
  checkout_status: string | null;
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

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .neq("checkout_status", "paid")
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
        console.error("お客さん取得エラー:", customersError);
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
        console.error("履歴のお客さん取得エラー:", customersError);
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

    loadOrders();
    loadHistory();

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
      .subscribe((status, err) => {
        console.log("Realtime status:", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      `${order.nickname}さんの会計を完了しますか？\n\n合計 ¥${total}`
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

  // 会計履歴から追加注文可能な状態に戻す
  const reopenForAdditionalOrder = async (
    customerId: string,
    nickname: string
  ) => {
    const confirmed = window.confirm(
      `${nickname}さんを追加注文可能な状態に戻しますか？\n\n会計済みの注文が現在の注文に戻ります。`
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

  const unservedOrders = orders.filter(
    (order) => order.status !== "served"
  );

  const servedOrders = orders.filter(
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
        className="rounded-xl bg-white p-4 shadow"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold">
              {order.nickname}さん
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {orderDate.date} {orderDate.time}
            </p>
          </div>

          <div className="text-right">
            {showHistory && (
              <span className="text-sm font-bold text-green-600">
                🟢 会計済み
              </span>
            )}

            {!showHistory &&
              order.checkout_status === "requested" && (
                <span className="text-sm font-bold text-orange-600">
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
                className="rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={`font-bold ${
                        isFullyServed
                          ? "text-green-700"
                          : "text-gray-900"
                      }`}
                    >
                      {isFullyServed && "🟢 "}
                      {item.name} × {item.quantity}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      ¥{item.price * item.quantity}
                    </p>

                    <p
                      className={`mt-1 text-sm font-bold ${
                        isFullyServed
                          ? "text-green-600"
                          : "text-orange-600"
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
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                      >
                        ＋ 提供
                      </button>
                    )}

                  {isFullyServed && (
                    <span className="shrink-0 text-sm font-bold text-green-600">
                      提供完了
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t pt-4 text-xl font-bold">
          合計 ¥{total}
        </div>

        <div className="mt-4 border-t pt-4 text-sm text-gray-600">
          <p>注文ID：{order.id}</p>

          {!showHistory && (
            <>
              <p
                className={`mt-1 font-bold ${
                  order.status === "served"
                    ? "text-green-600"
                    : "text-orange-600"
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
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
                >
                  この注文を全部提供済みにする
                </button>
              )}

              <p
                className={`mt-3 font-bold ${
                  order.checkout_status ===
                  "requested"
                    ? "text-orange-600"
                    : "text-gray-600"
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

              {order.checkout_status ===
                "requested" && (
                <button
                  onClick={() =>
                    completeCheckout(order)
                  }
                  className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white"
                >
                  会計済みにする
                </button>
              )}
            </>
          )}

          {showHistory && (
            <button
              onClick={() =>
                reopenForAdditionalOrder(
                  order.customer_id,
                  order.nickname
                )
              }
              className="mt-4 w-full rounded-lg bg-gray-700 px-4 py-3 font-bold text-white"
            >
              追加注文を受け付ける
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold">
        スタッフ画面
      </h1>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setShowHistory(false)}
          className={`rounded-lg px-4 py-2 font-bold ${
            !showHistory
              ? "bg-black text-white"
              : "bg-white text-gray-700"
          }`}
        >
          現在の注文
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className={`rounded-lg px-4 py-2 font-bold ${
            showHistory
              ? "bg-black text-white"
              : "bg-white text-gray-700"
          }`}
        >
          会計履歴
        </button>
      </div>

      {!showHistory ? (
        <>
          <div className="mt-6">
            <h2 className="text-2xl font-bold">
              🟠 未提供
              <span className="ml-2 text-base text-gray-500">
                {unservedOrders.length}件
              </span>
            </h2>

            <div className="mt-4 space-y-4">
              {unservedOrders.map(renderOrder)}

              {unservedOrders.length === 0 && (
                <p className="text-gray-600">
                  未提供の注文はありません。
                </p>
              )}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-bold">
              🟢 提供済み
              <span className="ml-2 text-base text-gray-500">
                {servedOrders.length}件
              </span>
            </h2>

            <div className="mt-4 space-y-4">
              {servedOrders.map(renderOrder)}

              {servedOrders.length === 0 && (
                <p className="text-gray-600">
                  提供済みの注文はありません。
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          {displayOrders.map(renderOrder)}

          {displayOrders.length === 0 && (
            <p className="text-gray-600">
              会計履歴はありません。
            </p>
          )}
        </div>
      )}
    </main>
  );
}