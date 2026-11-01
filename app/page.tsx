"use client";

import { useEffect, useRef, useState } from "react";
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
    option: string | null;
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



const getMenuPresentation = (name: string) => MENU_PRESENTATION[name];

type AdminIconName = "clipboard-list" | "users" | "wallet" | "package" | "receipt" | "phone" | "volume-2" | "refresh-ccw";

function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "shrink-0",
  };

  switch (name) {
    case "clipboard-list":
      return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 9h6M9 13h6M9 17h3" /><path d="M9 2.8h6v3H9z" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "wallet":
      return <svg {...common}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12v2" /></svg>;
    case "package":
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></svg>;
    case "receipt":
      return <svg {...common}><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case "phone":
      return <svg {...common}><path d="M5 4h4l2 5-2.5 1.8a15 15 0 0 0 4.7 4.7L15 13l5 2v4a2 2 0 0 1-2 2C9 21 3 15 3 6a2 2 0 0 1 2-2Z" /></svg>;
    case "volume-2":
      return <svg {...common}><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11" /></svg>;
    case "refresh-ccw":
      return <svg {...common}><path d="M3 11a9 9 0 0 1 15.4-6.4L21 7" /><path d="M21 3v4h-4M21 13a9 9 0 0 1-15.4 6.4L3 17" /><path d="M3 21v-4h4" /></svg>;
  }
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "checkout" | "customers" | "calls" | "products" | "history">("orders");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [checkoutPaymentCustomerId, setCheckoutPaymentCustomerId] = useState<string | null>(null);
  const [staffCalls, setStaffCalls] = useState<StaffCall[]>([]);
  const [updatingCallIds, setUpdatingCallIds] = useState<number[]>([]);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationSoundEnabledRef = useRef(false);

  // 商品管理用
  const [products, setProducts] = useState<Product[]>([]);
  const [updatingProductIds, setUpdatingProductIds] = useState<number[]>([]);

  const toggleNotificationSound = async () => {
    const nextEnabled = !notificationSoundEnabled;
    if (nextEnabled) {
      try {
        const context = audioContextRef.current ?? new window.AudioContext();
        audioContextRef.current = context;
        await context.resume();
      } catch (error) {
        console.error("通知音を有効にできませんでした:", error);
        alert("このブラウザでは通知音を有効にできませんでした。ブラウザの設定を確認してください。");
        return;
      }
    }
    notificationSoundEnabledRef.current = nextEnabled;
    setNotificationSoundEnabled(nextEnabled);
  };

  const playOrderNotification = () => {
    if (!notificationSoundEnabledRef.current) return;
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(659.25, start);
    oscillator.frequency.setValueAtTime(783.99, start + 0.18);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.035, start + 0.035);
    gain.gain.setValueAtTime(0.035, start + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  };

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
        .or("checkout_status.is.null,checkout_status.not.in.(paid,cancelled)")
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
          "id, order_id, product_id, quantity, served_quantity, status, option"
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
          "id, order_id, product_id, quantity, served_quantity, status, option"
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

      setProducts((data || []).filter((product) => Boolean(getMenuPresentation(product.name))));
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
          playOrderNotification();
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
          event: "INSERT",
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
          event: "DELETE",
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

    // Realtimeが一時的に切断された場合に備え、20秒ごとに同期する
    const refreshInterval = window.setInterval(() => {
      loadOrders();
      loadHistory();
      loadProducts();
      loadStaffCalls();
    }, 20000);

    return () => {
      window.clearInterval(refreshInterval);
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

  // お客様単位で未提供商品を一括提供済みにする（DB側RPCで一括処理）
  const serveAllCustomerItems = async (customerId: string, nickname: string) => {
    const customerOrders = orders.filter((order) => order.customer_id === customerId);
    const unservedCount = customerOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity - item.served_quantity), 0),
      0
    );
    if (unservedCount === 0) {
      alert("未提供の商品はありません。");
      return;
    }
    const confirmed = window.confirm(
      `${nickname}様の未提供商品をすべて提供済みにしますか？\n\n未提供品はございませんか？\n\n対象：${unservedCount}点`
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc("mark_customer_items_served", {
      p_customer_id: customerId,
    });
    if (error) {
      console.error("お客様単位の一括提供エラー:", error);
      alert("一括提供済みへの変更に失敗しました。SQLの追加と権限を確認してください。");
      return;
    }
    setOrders((current) => current.map((order) => order.customer_id !== customerId ? order : ({
      ...order,
      status: "served",
      items: order.items.map((item) => ({ ...item, served_quantity: item.quantity, status: "served" })),
    })));
  };

  // スタッフ側から会計を開始する
  const startCustomerCheckout = async (customerId: string, nickname: string) => {
    const customerOrders = orders.filter((order) => order.customer_id === customerId && (order.checkout_status === "none" || order.checkout_status === null));
    if (customerOrders.length === 0) {
      alert("会計対象の注文がありません。");
      return;
    }
    const ids = customerOrders.map((order) => order.id);
    const { data, error } = await supabase
      .from("orders")
      .update({ checkout_status: "requested", payment_method: null })
      .in("id", ids)
      .select("id");
    if (error || !data || data.length !== ids.length) {
      console.error("スタッフ会計開始エラー:", error);
      alert("会計を開始できませんでした。注文状態を再確認してください。");
      return;
    }
    setOrders((current) => current.map((order) => ids.includes(order.id) ? { ...order, checkout_status: "requested", payment_method: null } : order));
    setActiveTab("checkout");
  };

  // スタッフが会計依頼を取り消す。支払い方法も必ずリセットする。
  const cancelCustomerCheckout = async (customerId: string, nickname: string) => {
    const confirmed = window.confirm(`${nickname}様のお会計依頼を取り消しますか？\n\nお客様の画面は注文画面に戻り、支払い方法を選び直せるようになります。`);
    if (!confirmed) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ checkout_status: "none", payment_method: null })
      .eq("customer_id", customerId)
      .eq("checkout_status", "requested")
      .select("id");
    if (error || !data || data.length === 0) {
      console.error("会計依頼取消エラー:", error);
      alert("会計依頼を取り消せませんでした。");
      return;
    }
    const ids = data.map((row) => row.id);
    setOrders((current) => current.map((order) => ids.includes(order.id) ? { ...order, checkout_status: "none", payment_method: null } : order));
  };

  const finalizeCustomerCheckout = async (customerId: string, paymentMethod: "cash" | "paypay") => {
    const { data, error } = await supabase
      .from("orders")
      .update({ checkout_status: "paid", payment_method: paymentMethod })
      .eq("customer_id", customerId)
      .eq("checkout_status", "requested")
      .select("id");
    if (error || !data || data.length === 0) {
      console.error("会計完了エラー:", error);
      alert("会計済みに変更できませんでした。状態を再確認してください。");
      return;
    }
    const paidIds = data.map((row) => row.id);
    setOrders((current) => current.filter((order) => !paidIds.includes(order.id)));
    setCheckoutPaymentCustomerId(null);
  };

  // 会計完了前に提供漏れを確認し、必要なら支払い方法をスタッフが選択
  const completeCustomerCheckout = async (customerId: string, nickname: string) => {
    const customerOrders = orders.filter((order) => order.customer_id === customerId && order.checkout_status === "requested");
    if (customerOrders.length === 0) return;
    const total = customerOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
    const unservedCount = customerOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity - item.served_quantity), 0), 0);
    const confirmed = window.confirm(`${nickname}様のお会計を完了しますか？\n\n未提供品はございませんか？\n\n未提供：${unservedCount}点\n合計：¥${total.toLocaleString("ja-JP")}`);
    if (!confirmed) return;
    const methods = [...new Set(customerOrders.map((order) => order.payment_method).filter(Boolean))];
    if (methods.length === 1) {
      await finalizeCustomerCheckout(customerId, methods[0] as "cash" | "paypay");
    } else {
      setCheckoutPaymentCustomerId(customerId);
    }
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
        weekday: "short",
      }),
      time: date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const activeCustomers = Array.from(
    orders.reduce((customerMap, order) => {
      const existing = customerMap.get(order.customer_id);

      if (existing) {
        existing.orderCount += 1;
        existing.orders.push(order);
        existing.itemCount += order.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      } else {
        customerMap.set(order.customer_id, {
          customer_id: order.customer_id,
          nickname: order.nickname,
          orderCount: 1,
          orders: [order],
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
      orders: Order[];
    }>())
  ).map(([, customer]) => customer);

  const visibleOrders = selectedCustomerId
    ? orders.filter((order) => order.customer_id === selectedCustomerId)
    : orders;

  const groupOrdersByCustomer = (source: Order[]) => {
    const grouped = new Map<string, { customer_id: string; nickname: string; orders: Order[] }>();
    source.forEach((order) => {
      const existing = grouped.get(order.customer_id);
      if (existing) existing.orders.push(order);
      else grouped.set(order.customer_id, { customer_id: order.customer_id, nickname: order.nickname, orders: [order] });
    });
    return Array.from(grouped.values()).map((group) => ({
      ...group,
      orders: [...group.orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }));
  };

  const visibleCustomerGroups = groupOrdersByCustomer(visibleOrders);
  const historyCustomerGroups = groupOrdersByCustomer(historyOrders);

  const unservedOrders = visibleOrders.filter(
    (order) => order.status !== "served"
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
        className="rounded-md border border-[#49323F] bg-[#1B151A] p-4 shadow-lg shadow-black/20"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#C5B7BA]">
            <span className="rounded-sm bg-[#261D23] px-2.5 py-1.5">{orderDate.date}</span>
            <span className="rounded-sm bg-[#261D23] px-2.5 py-1.5">{orderDate.time}</span>
          </div>

          <div className="text-right">
            {showHistory && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#D8B58A]">
                <span className="h-2 w-2 rounded-full bg-[#D8B58A]" />会計済み
              </span>
            )}

            {!showHistory &&
              order.checkout_status === "requested" && (
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[#E0525B]">
                  <span className="h-2 w-2 rounded-full bg-[#E0525B]" />お会計依頼中
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
                className="rounded-md border border-[#49323F] bg-[#261D23] p-3"
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
                      {isFullyServed && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#D8B58A] align-middle" />}
                      {getMenuPresentation(item.name)?.english ?? item.name} × {item.quantity}
                    </p>
                    {item.option && (
                      <span className="mt-1 inline-flex rounded-sm border border-[#A9785D]/60 bg-[#382832] px-2.5 py-1 text-xs font-bold tracking-wide text-[#F3D9AE]">
                        {item.option.toUpperCase()}
                      </span>
                    )}

                    <p className="mt-1 text-sm text-[#C5B7BA]">
                      ¥{(item.price * item.quantity).toLocaleString("en-US")}
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
                        className="shrink-0 rounded-md bg-[#71364F] px-3 py-2 text-sm font-bold text-[#FFF9F5] transition hover:bg-[#87445F]"
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
          合計 ¥{total.toLocaleString("en-US")}
        </div>

        <div className="mt-4 border-t border-[#49323F] pt-4 text-sm text-[#C5B7BA]">
          <p>注文ID：{order.id}</p>

          {!showHistory && (
            <>
              <p
                className={`mt-1 font-bold ${
                  order.status === "served"
                    ? "text-[#D8B58A]"
                    : "text-[#E0525B]"
                }`}
              >
                状態：
                {order.status === "served"
                  ? "● 提供済み"
                  : "● 未提供"}
              </p>

              <p
                className={`mt-3 font-bold ${
                  order.checkout_status ===
                  "requested"
                    ? "text-[#E0525B]"
                    : "text-[#C5B7BA]"
                }`}
              >
                お会計：
                {order.checkout_status ===
                "requested"
                  ? "お会計依頼中"
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

              {order.checkout_status === "none" &&
                order.items.every(
                  (item) => item.served_quantity === 0
                ) && (
                  <button
                    onClick={() => cancelOrder(order)}
                    className="mt-3 w-full rounded-md border border-[#A9785D] bg-[#382832] px-4 py-3 font-bold text-[#F3D9AE] transition hover:bg-[#49323F]"
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
                className="mt-4 w-full rounded-md bg-[#382832] px-4 py-3 font-bold text-[#F3EDEB] transition hover:bg-[#49323F]"
              >
                追加注文を受け付ける
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
    { id: "orders" as const, label: "注文", icon: "clipboard-list" as const, badge: orderBadgeCount },
    { id: "checkout" as const, label: "お会計", icon: "wallet" as const, badge: orders.filter((order) => order.checkout_status === "requested").length },
    { id: "customers" as const, label: "お客様", icon: "users" as const, badge: activeCustomers.length },
    { id: "calls" as const, label: "呼び出し", icon: "phone" as const, badge: staffCalls.length },
    { id: "products" as const, label: "商品", icon: "package" as const, badge: soldOutCount },
    { id: "history" as const, label: "履歴", icon: "receipt" as const, badge: 0 },
  ];

  return (
    <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="min-h-screen bg-[#100D10] px-3 py-5 text-[#F3EDEB] sm:px-6 sm:py-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-3 border-b border-[#49323F] pb-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.34em] text-[#D7B77C]">BAR & MUSIC</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[0.22em] text-[#F3EDEB]">myonga</h1>
            <p className="mt-1 text-xs tracking-wide text-[#A18F96]">STAFF CONSOLE</p>
          </div>
          <button
            type="button"
            onClick={toggleNotificationSound}
            aria-pressed={notificationSoundEnabled}
            className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${notificationSoundEnabled ? "border-[#A9785D] bg-[#382832] text-[#F3D9AE]" : "border-[#49323F] bg-[#1B151A] text-[#C5B7BA]"}`}
          >
            <span className="inline-flex items-center gap-2"><AdminIcon name="volume-2" size={16} />通知音 {notificationSoundEnabled ? "ON" : "OFF"}</span>
          </button>
        </header>

        <nav className="sticky top-0 z-30 -mx-3 mb-6 grid grid-cols-6 gap-1 border-y border-[#49323F] bg-[#100D10]/95 px-2 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-lg sm:border sm:bg-[#1B151A] sm:p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowHistory(tab.id === "history");
                if (tab.id !== "customers") setSelectedCustomerId(null);
              }}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold tracking-wide transition sm:text-xs ${
                activeTab === tab.id
                  ? "bg-[#71364F] text-[#FFF9F5] shadow-[0_5px_16px_rgba(0,0,0,0.28)]"
                  : "text-[#C5B7BA] hover:bg-[#382832]"
              }`}
            >
              <AdminIcon name={tab.icon} size={19} />
              <span>{tab.label}</span>
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
              <div className="mb-4 flex items-center justify-between rounded-md border border-[#A9785D]/50 bg-[#261D23] px-4 py-3">
                <span className="text-sm text-[#D7B77C]">お客様を絞り込み中</span>
                <button onClick={() => setSelectedCustomerId(null)} className="text-sm font-semibold text-[#F3EDEB] underline underline-offset-4">解除</button>
              </div>
            )}
            <div className="space-y-4">
              {visibleCustomerGroups.map((group) => {
                const groupUnserved = group.orders.filter((order) => order.status !== "served").length;
                const groupItemCount = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
                return (
                  <section key={group.customer_id} className="rounded-md border border-[#49323F] bg-[#1B151A] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <div>
                        <h3 className="text-base font-semibold text-[#F3EDEB]">{group.nickname} 様</h3>
                        <p className="text-[10px] text-[#8F8288]">ID：{group.customer_id.slice(0, 8)}</p>
                        <p className="mt-0.5 text-xs text-[#A18F96]">{group.orders.length}件の注文 ・ 商品 {groupItemCount}点</p>
                      </div>
                      {groupUnserved > 0 && <span className="shrink-0 text-xs font-semibold text-[#E0525B]">● 未提供 {groupUnserved}件</span>}
                    </div>
                    <div className="space-y-3">
                      {group.orders.map(renderOrder)}
                    </div>
                  </section>
                );
              })}
              {visibleCustomerGroups.length === 0 && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">現在、注文はありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "customers" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">GUESTS</p>
              <h2 className="mt-1 text-2xl font-semibold">お客様一覧</h2>
              <p className="mt-2 text-sm text-[#A18F96]">お客様を選択すると、注文・提供状況・会計金額を確認できます。</p>
            </div>
            <div className="space-y-3">
              {activeCustomers.map((customer) => {
                const selected = selectedCustomerId === customer.customer_id;
                const customerTotal = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
                const totalQuantity = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
                const servedQuantity = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.served_quantity, 0), 0);
                const hasCheckoutRequest = customer.orders.some((order) => order.checkout_status === "requested");
                return (
                  <article key={customer.customer_id} className="overflow-hidden rounded-md border border-[#49323F] bg-[#1B151A]">
                    <div className="flex items-center gap-2 p-3 sm:p-4">
                      <button type="button" onClick={() => setSelectedCustomerId(selected ? null : customer.customer_id)} className="min-w-0 flex-1 rounded-md px-1 py-1 text-left hover:bg-[#261D23]">
                        <span className="block font-semibold text-[#F3EDEB]">{customer.nickname} 様</span>
                        <span className="mt-0.5 block text-[10px] text-[#8F8288]">ID：{customer.customer_id.slice(0, 8)}</span>
                        <span className="mt-1 block text-xs text-[#A18F96]">{selected ? "詳細を閉じる −" : "詳細を見る ＋"}</span>
                      </button>
                      <button type="button" onClick={() => serveAllCustomerItems(customer.customer_id, customer.nickname)} disabled={servedQuantity >= totalQuantity} className="shrink-0 rounded-md border border-[#A9785D]/60 bg-[#382832] px-3 py-2.5 text-[11px] font-semibold leading-snug text-[#F3D9AE] transition hover:bg-[#49323F] disabled:cursor-not-allowed disabled:border-[#49323F] disabled:bg-[#261D23] disabled:text-[#8F8288] sm:px-3 sm:text-xs">
                        {servedQuantity >= totalQuantity ? "全て提供済み" : "全品提供済みにする"}
                      </button>
                    </div>
                    {selected && (
                      <div className="border-t border-[#49323F] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-[#F3EDEB]">{customer.nickname} 様</h3>
                            <p className="mt-0.5 text-[10px] text-[#8F8288]">GUEST ID：{customer.customer_id.slice(0, 8)}</p>
                          </div>
                          <span className={`text-xs font-semibold ${servedQuantity >= totalQuantity ? "text-[#D8B58A]" : "text-[#E0525B]"}`}>提供済み {servedQuantity} / {totalQuantity}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-sm bg-[#261D23] p-3"><p className="text-xs text-[#A18F96]">会計金額</p><p className="mt-1 text-lg font-bold text-[#F3EDEB]">¥{customerTotal.toLocaleString("ja-JP")}</p></div>
                          <div className="rounded-sm bg-[#261D23] p-3"><p className="text-xs text-[#A18F96]">注文・商品</p><p className="mt-1 text-lg font-bold text-[#F3EDEB]">{customer.orderCount}件 / {totalQuantity}点</p></div>
                        </div>
                        <p className="mt-3 text-sm text-[#C5B7BA]">会計状態：{hasCheckoutRequest ? "お会計依頼中" : "未会計"}</p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          {!hasCheckoutRequest ? (
                            <button type="button" onClick={() => startCustomerCheckout(customer.customer_id, customer.nickname)} className="flex-1 rounded-md bg-[#71364F] px-3 py-3 text-sm font-semibold text-[#FFF9F5]">このお客様のお会計をする</button>
                          ) : (
                            <button type="button" onClick={() => cancelCustomerCheckout(customer.customer_id, customer.nickname)} className="flex-1 rounded-md border border-[#C83D4D]/60 bg-[#382832] px-3 py-3 text-sm font-semibold text-[#F08A91]">会計依頼を取り消す</button>
                          )}
                        </div>
                        <div className="mt-4 space-y-3">
                          {customer.orders.map(renderOrder)}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {activeCustomers.length === 0 && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">現在ご注文中のお客様はいません。</p>}
            </div>
          </section>
        )}

        {activeTab === "checkout" && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">CHECKOUT</p><h2 className="mt-1 text-2xl font-semibold">お会計</h2></div>
              <span className="text-xs text-[#A18F96]">依頼中 {orders.filter((order) => order.checkout_status === "requested").length}件</span>
            </div>
            <div className="space-y-4">
              {groupOrdersByCustomer(orders.filter((order) => order.checkout_status === "requested")).map((group) => {
                const total = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0), 0);
                const unserved = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity - item.served_quantity), 0), 0);
                const payment = group.orders.find((order) => order.payment_method)?.payment_method;
                return <section key={group.customer_id} className="rounded-md border border-[#49323F] bg-[#1B151A] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#F3EDEB]">{group.nickname} 様</h3><p className="text-[10px] text-[#8F8288]">GUEST ID：{group.customer_id.slice(0, 8)}</p></div><span className="text-sm font-bold text-[#E0525B]">● お会計依頼中</span></div>
                  <div className="mt-3 space-y-3">{group.orders.map(renderOrder)}</div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#49323F] pt-3"><span className="text-sm text-[#C5B7BA]">合計</span><strong className="text-xl">¥{total.toLocaleString("ja-JP")}</strong></div>
                  <p className="mt-2 text-sm text-[#C5B7BA]">支払い方法：{payment === "cash" ? "現金" : payment === "paypay" ? "PayPay" : "未選択（スタッフが選択）"}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => cancelCustomerCheckout(group.customer_id, group.nickname)} className="rounded-md border border-[#C83D4D]/60 bg-[#382832] px-3 py-3 text-sm font-semibold text-[#F08A91]">会計を取り消す</button><button type="button" onClick={() => completeCustomerCheckout(group.customer_id, group.nickname)} className="rounded-md bg-[#71364F] px-3 py-3 text-sm font-semibold text-[#FFF9F5]">会計を完了する</button></div>
                  {unserved > 0 && <p className="mt-2 text-xs font-semibold text-[#E0525B]">未提供商品が {unserved} 点あります</p>}
                </section>;
              })}
              {orders.every((order) => order.checkout_status !== "requested") && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">現在、お会計依頼はありません。</p>}
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
                <article key={call.id} className="rounded-lg border border-[#A9785D]/40 bg-gradient-to-br from-[#261D23] to-[#1B151A] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#F3EDEB]">{call.nickname} 様</p>
                      <p className="text-[10px] text-[#8F8288]">ID：{call.customer_id.slice(0, 8)}</p>
                      <p className="mt-1 text-xs text-[#D7B77C]">{new Date(call.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 呼び出し</p>
                    </div>
                    <span className="rounded-full bg-[#C83D4D]/15 px-3 py-1 text-xs font-bold text-[#F08A91]">未対応</span>
                  </div>
                  <button onClick={() => completeStaffCall(call)} disabled={updatingCallIds.includes(call.id)} className="mt-4 w-full rounded-md bg-[#71364F] px-4 py-3 font-semibold text-[#FFF9F5] transition hover:bg-[#87445F] disabled:opacity-50">{updatingCallIds.includes(call.id) ? "更新中..." : "対応済みにする"}</button>
                </article>
              ))}
              {staffCalls.length === 0 && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">未対応の呼び出しはありません。</p>}
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
            <p className="mb-4 text-sm text-[#A18F96]">売り切れにすると、お客様側には SOLD OUT と表示され、注文できなくなります。</p>
            <div className="space-y-3">
              {products.map((product) => {
                const isUpdating = updatingProductIds.includes(product.id);
                return (
                  <article key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#49323F] bg-[#1B151A] p-4">
                    <div className="min-w-0">
                      <p className={`font-sans text-base ${product.is_available ? "text-[#F3EDEB]" : "text-[#A18F96]"}`}>{getMenuPresentation(product.name)?.english ?? product.name}</p>
                      <p className="mt-0.5 text-xs tracking-wide text-[#A18F96]">{getMenuPresentation(product.name)?.reading ?? ""}</p>
                      <p className="mt-1 text-sm text-[#C5B7BA]">{getMenuPresentation(product.name)?.category ?? product.category ?? "Uncategorized"} / ¥{product.price.toLocaleString("en-US")}</p>
                      <p className={`mt-1 text-xs font-semibold ${product.is_available ? "text-[#D7B77C]" : "text-[#F08A91]"}`}>{product.is_available ? "販売中" : "売り切れ"}</p>
                    </div>
                    <button onClick={() => toggleProductAvailability(product)} disabled={isUpdating} className={`shrink-0 rounded-md px-3 py-2.5 text-xs font-bold text-[#FFF9F5] transition disabled:opacity-50 ${product.is_available ? "bg-[#382832] hover:bg-[#49323F]" : "bg-[#71364F] hover:bg-[#87445F]"}`}>{isUpdating ? "更新中..." : product.is_available ? "売り切れにする" : "販売中に戻す"}</button>
                  </article>
                );
              })}
              {products.length === 0 && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">商品が登録されていません。</p>}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">PAYMENT HISTORY</p>
              <h2 className="mt-1 text-2xl font-semibold">会計履歴</h2>
            </div>
            <div className="space-y-4">
              {historyCustomerGroups.map((group) => (
                <section key={group.customer_id} className="rounded-md border border-[#49323F] bg-[#1B151A] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><h3 className="text-base font-semibold text-[#F3EDEB]">{group.nickname} 様</h3><p className="text-[10px] text-[#8F8288]">GUEST ID：{group.customer_id.slice(0, 8)}</p></div><button type="button" onClick={() => resetCustomerTerminal(group.customer_id, group.nickname)} className="shrink-0 rounded-md border border-[#71364F] bg-[#382832] px-3 py-2 text-xs font-semibold text-[#F3D9AE]"><span className="inline-flex items-center gap-1.5"><AdminIcon name="refresh-ccw" size={14} />端末をリセット</span></button></div>
                  <div className="space-y-3">{group.orders.map(renderOrder)}</div>
                </section>
              ))}
              {historyCustomerGroups.length === 0 && <p className="rounded-md border border-[#49323F] bg-[#1B151A] p-6 text-center text-sm text-[#A18F96]">会計履歴はありません。</p>}
            </div>
          </section>
        )}
        {checkoutPaymentCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
            <div className="w-full max-w-sm rounded-md border border-[#49323F] bg-[#1B151A] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-[#F3EDEB]">支払い方法を選択</h2>
              <p className="mt-2 text-sm text-[#C5B7BA]">スタッフ側から会計を開始したお客様です。実際の支払い方法を選択してください。</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => finalizeCustomerCheckout(checkoutPaymentCustomerId, "cash")} className="rounded-md bg-[#382832] px-3 py-4 font-semibold text-[#F3EDEB]">現金</button>
                <button type="button" onClick={() => finalizeCustomerCheckout(checkoutPaymentCustomerId, "paypay")} className="rounded-md bg-[#382832] px-3 py-4 font-semibold text-[#F3EDEB]">PayPay</button>
              </div>
              <button type="button" onClick={() => setCheckoutPaymentCustomerId(null)} className="mt-3 w-full rounded-md border border-[#49323F] px-3 py-2 text-sm text-[#C5B7BA]">戻る</button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
