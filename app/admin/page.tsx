"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/app-version";

type OrderRow = {
  id: number;
  customer_id: string;
  status: string;
  checkout_status: string | null;
  payment_method: string | null;
  created_at: string;
  checkout_requested_at: string | null;
  table_number: number | null;
  paid_at?: string | null;
};

type Order = {
  id: number;
  customer_id: string;
  status: string;
  checkout_status: string | null;
  payment_method: string | null;
  created_at: string;
  checkout_requested_at: string | null;
  table_number: number | null;
  registration_method?: string | null;
  paid_at?: string | null;
  items: {
    id: number;
    name: string;
    option: string | null;
    price: number;
    quantity: number;
    served_quantity: number;
    cancelled_quantity: number;
    status: string;
  }[];
};

type StaffCall = {
  id: number;
  customer_id: string;
  table_number: number | null;
  status: string;
  created_at: string;
};

type CustomerSession = {
  id: string;
  table_number: number | null;
  registration_method: string | null;
  created_at: string;
};

type ProxyCartItem = {
  product: Product;
  quantity: number;
  option: string | null;
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



const MENU_ORDER = ["ビール", "ハイボール", "レモンサワー", "コーン茶ハイ", "ウーロンハイ", "カシス", "赤", "白", "赤ワイン", "白ワイン", "オレンジジュース", "コーヒー", "コーン茶", "ウーロン茶"];
const getMenuPresentation = (name: string) => MENU_PRESENTATION[name];
const tableLabel = (value: number | null | undefined) => value ? `卓番 ${String(value).padStart(2, "0")}` : "卓番未設定";

function MyongaWordmark({ className = "" }: { className?: string }) {
  return (
    <span aria-label="myonga" className={`inline-flex items-center whitespace-nowrap ${className}`}>
      myonga
    </span>
  );
}

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
  const [expandedCheckoutCustomerId, setExpandedCheckoutCustomerId] = useState<string | null>(null);
  const [staffCalls, setStaffCalls] = useState<StaffCall[]>([]);
  const [customerSessions, setCustomerSessions] = useState<CustomerSession[]>([]);
  const [showManualRegister, setShowManualRegister] = useState(false);
  const [manualTableNumber, setManualTableNumber] = useState("1");
  const [expandedHistoryKey, setExpandedHistoryKey] = useState<string | null>(null);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<string | null>(null);
  const [proxyOrderCustomerId, setProxyOrderCustomerId] = useState<string | null>(null);
  const [proxySelectedProductId, setProxySelectedProductId] = useState("");
  const [proxySelectedOption, setProxySelectedOption] = useState("");
  const [proxyQuantity, setProxyQuantity] = useState("1");
  const [proxyCart, setProxyCart] = useState<ProxyCartItem[]>([]);
  const [submittingProxyOrder, setSubmittingProxyOrder] = useState(false);
  const [updatingCallIds, setUpdatingCallIds] = useState<number[]>([]);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationSoundEnabledRef = useRef(false);

  // 商品管理用
  const [products, setProducts] = useState<Product[]>([]);
  const [updatingProductIds, setUpdatingProductIds] = useState<number[]>([]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service Worker登録エラー:", error);
    });
  }, []);

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

  const playStaffCallNotification = () => {
    if (!notificationSoundEnabledRef.current) return;
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(523.25, start);
    oscillator.frequency.setValueAtTime(392, start + 0.2);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.04, start + 0.035);
    gain.gain.setValueAtTime(0.04, start + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.57);
  };

  useEffect(() => {
    const loadStaffCalls = async () => {
      const { data, error } = await supabase
        .from("staff_calls")
        .select("id, customer_id, table_number, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("スタッフ呼び出し取得エラー:", error);
        return;
      }

      setStaffCalls(data || []);
    };

    const loadCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, table_number, registration_method, created_at")
        .is("reset_at", null)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("端末一覧取得エラー:", error);
        return;
      }
      setCustomerSessions((data || []) as CustomerSession[]);
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
        .select("id, table_number, registration_method")
        .in("id", customerIds);

      if (customersError) {
        console.error("お客様取得エラー:", customersError);
        return;
      }

      const orderIds = ordersData.map((order) => order.id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, served_quantity, cancelled_quantity, status, option"
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

      const ordersWithDetails: Order[] = ordersData.map((order: OrderRow): Order => {
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
            const cancelledQuantity = item.cancelled_quantity ?? 0;

            return {
              id: item.id,
              name: product?.name ?? "不明な商品",
              option: item.option ?? null,
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              cancelled_quantity: cancelledQuantity,
              status: cancelledQuantity > 0 ? "cancelled" : servedQuantity >= item.quantity ? "served" : "pending",
            };
          });

        const activeItems = orderItems.filter((item) => item.served_quantity + item.cancelled_quantity < item.quantity);
        const allServed = activeItems.length === 0;

        return {
          ...order,
          status: allServed ? "served" : "pending",
          table_number: customer?.table_number ?? (Number(order.table_number) > 0 ? Number(order.table_number) : null),
          registration_method: customer?.registration_method ?? null,
          items: orderItems,
        };
      });

      const sortedOrders = [...ordersWithDetails.filter((order) => order.items.some((item) => item.quantity > item.cancelled_quantity))].sort((a, b) => {
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
        .select("id, table_number, registration_method")
        .in("id", customerIds);

      if (customersError) {
        console.error("履歴のお客様取得エラー:", customersError);
        return;
      }

      const orderIds = ordersData.map((order) => order.id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, served_quantity, cancelled_quantity, status, option"
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

      const ordersWithDetails: Order[] = ordersData.map((order: OrderRow): Order => {
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
            const cancelledQuantity = item.cancelled_quantity ?? 0;

            return {
              id: item.id,
              name: product?.name ?? "不明な商品",
              option: item.option ?? null,
              price: product?.price ?? 0,
              quantity: item.quantity,
              served_quantity: servedQuantity,
              cancelled_quantity: cancelledQuantity,
              status: cancelledQuantity > 0 ? "cancelled" : servedQuantity >= item.quantity ? "served" : "pending",
            };
          });

        const activeItems = orderItems.filter((item) => item.served_quantity + item.cancelled_quantity < item.quantity);
        const allServed = activeItems.length === 0;

        return {
          ...order,
          status: allServed ? "served" : "pending",
          table_number: customer?.table_number ?? (Number(order.table_number) > 0 ? Number(order.table_number) : null),
          registration_method: customer?.registration_method ?? null,
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

      const availableCatalog = (data || []).filter((product) => Boolean(getMenuPresentation(product.name)));
      const names = new Set(availableCatalog.map((product) => product.name));
      const normalizedCatalog = availableCatalog.filter((product) => {
        if (product.name === "赤ワイン" && names.has("赤")) return false;
        if (product.name === "白ワイン" && names.has("白")) return false;
        return true;
      });
      setProducts(normalizedCatalog.sort((a, b) => MENU_ORDER.indexOf(a.name) - MENU_ORDER.indexOf(b.name)));
    };

    loadOrders();
    loadHistory();
    loadProducts();
    loadStaffCalls();
    loadCustomers();

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
        (payload) => {
          if (payload.eventType === "INSERT") playStaffCallNotification();
          loadStaffCalls();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
        },
        () => {
          loadCustomers();
          loadOrders();
          loadHistory();
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
      loadCustomers();
    }, 20000);

    return () => {
      window.clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const selectedProxyProduct = products.find((product) => String(product.id) === proxySelectedProductId) ?? null;

  const addProxyCartItem = () => {
    if (!selectedProxyProduct) {
      alert("商品を選択してください。");
      return;
    }
    const quantity = Number(proxyQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      alert("数量は1〜99で入力してください。");
      return;
    }
    const optionType = getMenuPresentation(selectedProxyProduct.name)?.optionType;
    const option = optionType ? proxySelectedOption : null;
    if (optionType && !option) {
      alert("商品オプションを選択してください。");
      return;
    }
    setProxyCart((current) => {
      const existing = current.find((item) => item.product.id === selectedProxyProduct.id && item.option === option);
      if (existing) return current.map((item) => item.product.id === selectedProxyProduct.id && item.option === option ? { ...item, quantity: item.quantity + quantity } : item);
      return [...current, { product: selectedProxyProduct, quantity, option }];
    });
    setProxyQuantity("1");
    setProxySelectedOption("");
  };

  const submitProxyOrder = async () => {
    if (!proxyOrderCustomerId || proxyCart.length === 0 || submittingProxyOrder) return;
    const customer = customerSessions.find((entry) => entry.id === proxyOrderCustomerId);
    if (!customer?.table_number) {
      alert("卓番が未設定です。先に卓番を設定してください。");
      return;
    }
    setSubmittingProxyOrder(true);
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      table_number: customer.table_number,
      customer_id: proxyOrderCustomerId,
      status: "pending",
      checkout_status: "none",
    }).select("id").single();
    if (orderError || !order) {
      console.error("代理注文作成エラー:", orderError);
      alert("代理注文を作成できませんでした。");
      setSubmittingProxyOrder(false);
      return;
    }
    const { error: itemsError } = await supabase.from("order_items").insert(proxyCart.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      option: item.option,
    })));
    if (itemsError) {
      console.error("代理注文商品登録エラー:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      alert("代理注文の商品登録に失敗しました。注文を取り消しました。");
      setSubmittingProxyOrder(false);
      return;
    }
    setProxyOrderCustomerId(null);
    setProxyCart([]);
    setProxySelectedProductId("");
    setProxySelectedOption("");
    setSubmittingProxyOrder(false);
    setActiveTab("orders");
  };

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

    if (targetItem.served_quantity + targetItem.cancelled_quantity >= targetItem.quantity) {
      return;
    }

    const newServedQuantity =
      targetItem.served_quantity + 1;

    const { data, error } = await supabase
      .from("order_items")
      .update({
        served_quantity: newServedQuantity,
        status: newServedQuantity + targetItem.cancelled_quantity >= targetItem.quantity ? "served" : "pending",
      })
      .eq("id", itemId)
      .eq("served_quantity", targetItem.served_quantity)
      .eq("cancelled_quantity", targetItem.cancelled_quantity)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) console.error(error);
      alert("提供状態の変更に失敗しました。最新の状態を読み込み直してください。");
      return;
    }

    const updatedItems = targetOrder.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            served_quantity: newServedQuantity,
            status: newServedQuantity + targetItem.cancelled_quantity >= targetItem.quantity ? "served" : "pending",
          }
        : item
    );

    const allServed =
      updatedItems.length > 0 &&
      updatedItems.every(
        (item) => item.served_quantity + item.cancelled_quantity >= item.quantity
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
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity - item.served_quantity - item.cancelled_quantity), 0),
      0
    );
    if (unservedCount === 0) {
      alert("未提供の商品はありません。");
      return;
    }
    const confirmed = window.confirm(
      `${nickname}の未提供商品をすべて提供済みにしますか？\n\n未提供品はございませんか？\n\n対象：${unservedCount}点`
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
      items: order.items.map((item) => ({ ...item, served_quantity: item.quantity - item.cancelled_quantity, status: "served" })),
    })));
  };

  // スタッフ側から会計を開始する
  const startCustomerCheckout = async (customerId: string, nickname: string) => {
    const customerOrders = orders.filter((order) => order.customer_id === customerId && (order.checkout_status === "none" || order.checkout_status === null) && order.items.some((item) => item.quantity > item.cancelled_quantity));
    if (customerOrders.length === 0) {
      alert("会計対象の注文がありません。");
      return;
    }
    const ids = customerOrders.map((order) => order.id);
    const { data, error } = await supabase
      .from("orders")
      .update({ checkout_status: "requested", checkout_requested_at: new Date().toISOString(), payment_method: null })
      .in("id", ids)
      .or("checkout_status.eq.none,checkout_status.is.null")
      .select("id");
    if (error || !data || data.length !== ids.length) {
      console.error("スタッフ会計開始エラー:", error);
      alert(`${nickname}のお会計を開始できませんでした。注文状態を再確認してください。`);
      return;
    }
    setOrders((current) => current.map((order) => ids.includes(order.id) ? { ...order, checkout_status: "requested", payment_method: null } : order));
    setActiveTab("checkout");
  };

  // スタッフが会計依頼を取り消す。支払い方法も必ずリセットする。
  const cancelCustomerCheckout = async (customerId: string, nickname: string) => {
    const confirmed = window.confirm(`${nickname}のお会計依頼を取り消しますか？\n\nお客様の画面は注文画面に戻り、支払い方法を選び直せるようになります。`);
    if (!confirmed) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ checkout_status: "none", checkout_requested_at: null, payment_method: null })
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
    // DB側の単一トランザクションで、会計依頼後に追加された注文も含めて確定する。
    // 依頼取消と同時に操作された場合も、RPC側で行ロックと状態確認を行う。
    const { data, error } = await supabase.rpc("finalize_customer_checkout", {
      p_customer_id: customerId,
      p_payment_method: paymentMethod,
    });
    if (error) {
      console.error("会計完了エラー:", error);
      alert("会計済みに変更できませんでした。注文状態を再確認してください。");
      return;
    }
    setOrders((current) => current.filter((order) => order.customer_id !== customerId));
    setCheckoutPaymentCustomerId(null);
    setExpandedCheckoutCustomerId(null);
    alert(`会計を完了しました。\\n確定金額：¥${Number(data ?? 0).toLocaleString("ja-JP")}`);
  };

  // 会計完了前に提供漏れを確認し、会計依頼後の追加注文も含める
  const completeCustomerCheckout = async (customerId: string, nickname: string) => {
    const customerOrders = orders.filter((order) => order.customer_id === customerId);
    const hasCheckoutRequest = customerOrders.some((order) => order.checkout_status === "requested");
    const activeOrders = customerOrders.filter((order) => order.checkout_status !== "paid" && order.checkout_status !== "cancelled");
    if (!hasCheckoutRequest || activeOrders.length === 0) return;
    const total = activeOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * (item.quantity - item.cancelled_quantity), 0), 0);
    const unservedCount = activeOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity - item.served_quantity - item.cancelled_quantity), 0), 0);
    const confirmed = window.confirm(`${nickname}のお会計を完了しますか？\\n\\n未提供品はございませんか？\\n\\n未提供：${unservedCount}点\\n合計：¥${total.toLocaleString("ja-JP")}\\n\\n会計依頼後の追加注文も含みます。`);
    if (!confirmed) return;
    const methods = [...new Set(activeOrders.map((order) => order.payment_method).filter(Boolean))];
    if (methods.length === 1) {
      await finalizeCustomerCheckout(customerId, methods[0] as "cash" | "paypay");
    } else {
      setCheckoutPaymentCustomerId(customerId);
    }
  };

  // お客様の端末をリセットする。未会計の注文が残っている場合は誤操作防止のため停止する。
  const resetCustomerTerminal = async (customerId: string, label: string) => {
    if (orders.some((order) => order.customer_id === customerId)) {
      alert("未会計の注文が残っているため端末をリセットできません。先に会計を完了してください。");
      return;
    }
    const confirmed = window.confirm(`${label}の端末をリセットしますか？\n\n注文・会計履歴は保持されます。`);
    if (!confirmed) return;
    const { error } = await supabase.from("customers").update({ reset_at: new Date().toISOString() }).eq("id", customerId).is("reset_at", null);
    if (error) {
      console.error("端末リセットエラー:", error);
      alert("端末リセットに失敗しました");
      return;
    }
    setCustomerSessions((current) => current.filter((customer) => customer.id !== customerId));
  };

  const resetAllTerminals = async () => {
    const eligible = customerSessions.filter((customer) => !orders.some((order) => order.customer_id === customer.id));
    if (eligible.length === 0) {
      alert("リセットできる端末がありません。未会計の注文が残っていないか確認してください。");
      return;
    }
    const confirmed = window.confirm(`未会計の注文がない${eligible.length}台の端末を一括リセットしますか？\n\n注文・会計履歴は保持されます。`);
    if (!confirmed) return;
    const ids = eligible.map((customer) => customer.id);
    const { error } = await supabase.from("customers").update({ reset_at: new Date().toISOString() }).in("id", ids).is("reset_at", null);
    if (error) {
      console.error("一括端末リセットエラー:", error);
      alert("一括リセットに失敗しました");
      return;
    }
    setCustomerSessions((current) => current.filter((customer) => !ids.includes(customer.id)));
    setSelectedCustomerId(null);
  };

  const registerManualCustomer = async () => {
    const number = Number(manualTableNumber);
    if (!Number.isInteger(number) || number < 1 || number > 20) {
      alert("卓番は1〜20から選択してください。");
      return;
    }
    const label = tableLabel(number);
    const { data, error } = await supabase.from("customers").insert({
      nickname: label,
      table_number: number,
      registration_method: "staff",
    }).select("id, table_number, registration_method, created_at").single();
    if (error || !data) {
      console.error("手動端末登録エラー:", error);
      alert("端末登録に失敗しました。");
      return;
    }
    setCustomerSessions((current) => [...current, data as CustomerSession]);
    setShowManualRegister(false);
    setSelectedCustomerId(data.id);
  };

  const updateCustomerTableNumber = async (customerId: string, nextValue: string) => {
    const number = Number(nextValue);
    if (!Number.isInteger(number) || number < 1 || number > 20) return;
    const { error } = await supabase.from("customers").update({ table_number: number, nickname: tableLabel(number) }).eq("id", customerId);
    if (error) {
      console.error("卓番修正エラー:", error);
      alert("卓番を変更できませんでした。");
      return;
    }
    const [ordersUpdate, callsUpdate] = await Promise.all([
      supabase.from("orders").update({ table_number: number }).eq("customer_id", customerId),
      supabase.from("staff_calls").update({ table_number: number, nickname: tableLabel(number) }).eq("customer_id", customerId),
    ]);
    if (ordersUpdate.error || callsUpdate.error) {
      console.error("関連卓番更新エラー:", ordersUpdate.error || callsUpdate.error);
      alert("お客様の卓番は変更しましたが、関連データの一部を更新できませんでした。再読み込みして確認してください。");
    }
    setCustomerSessions((current) => current.map((customer) => customer.id === customerId ? { ...customer, table_number: number } : customer));
    setOrders((current) => current.map((order) => order.customer_id === customerId ? { ...order, table_number: number } : order));
    setHistoryOrders((current) => current.map((order) => order.customer_id === customerId ? { ...order, table_number: number } : order));
  };

  // 商品単位で未提供分をキャンセルする（提供済み分は維持）
  const cancelOrderItem = async (order: Order, item: Order["items"][number]) => {
    const remaining = Math.max(0, item.quantity - item.served_quantity - item.cancelled_quantity);
    if (remaining <= 0 || (order.checkout_status !== "none" && order.checkout_status !== null)) return;
    const confirmed = window.confirm(
      `${tableLabel(order.table_number)}の「${getMenuPresentation(item.name)?.english ?? item.name}」をキャンセルしますか？\n\n未提供分 ${remaining}点をキャンセルします。\n提供済みの商品はそのまま残ります。`
    );
    if (!confirmed) return;

    const nextCancelled = item.cancelled_quantity + remaining;
    const { data, error } = await supabase
      .from("order_items")
      .update({ cancelled_quantity: nextCancelled, status: "served" })
      .eq("id", item.id)
      .eq("served_quantity", item.served_quantity)
      .eq("cancelled_quantity", item.cancelled_quantity)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("商品キャンセルエラー:", error);
      alert("商品のキャンセルに失敗しました。提供状態が更新されていないか確認してください。");
      return;
    }

    setOrders((current) => current.map((currentOrder) => currentOrder.id !== order.id ? currentOrder : ({
      ...currentOrder,
      items: currentOrder.items.map((currentItem) => currentItem.id === item.id ? { ...currentItem, cancelled_quantity: nextCancelled, status: "served" } : currentItem),
      status: currentOrder.items.every((currentItem) => currentItem.id === item.id ? currentItem.served_quantity + nextCancelled >= currentItem.quantity : currentItem.served_quantity + currentItem.cancelled_quantity >= currentItem.quantity) ? "served" : "pending",
    })));
  };

  // 会計履歴から追加注文可能な状態に戻す
  const reopenForAdditionalOrder = async (
    customerId: string,
    nickname: string
  ) => {
    const confirmed = window.confirm(
      `${nickname}を追加注文可能な状態に戻しますか？\n\n会計済みの注文が現在の注文に戻ります。`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .update({
        checkout_status: "none",
        paid_at: null,
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

  const activeCustomers = customerSessions.map((customer) => {
    const customerOrders = orders.filter((order) => order.customer_id === customer.id);
    return {
      customer_id: customer.id,
      table_number: customer.table_number,
      registration_method: customer.registration_method,
      orderCount: customerOrders.length,
      orders: customerOrders,
      itemCount: customerOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
    };
  }).sort((a, b) => (a.table_number ?? 99) - (b.table_number ?? 99));

  const visibleOrders = selectedCustomerId
    ? orders.filter((order) => order.customer_id === selectedCustomerId)
    : orders;

  const groupOrdersByCustomer = (source: Order[]) => {
    const grouped = new Map<string, { customer_id: string; table_number: number | null; orders: Order[] }>();
    source.forEach((order) => {
      const existing = grouped.get(order.customer_id);
      if (existing) existing.orders.push(order);
      else grouped.set(order.customer_id, { customer_id: order.customer_id, table_number: order.table_number, orders: [order] });
    });
    return Array.from(grouped.values()).map((group) => ({
      ...group,
      orders: [...group.orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }));
  };

  const visibleCustomerGroups = groupOrdersByCustomer(visibleOrders);
  const checkoutCustomerIds = new Set(orders.filter((order) => order.checkout_status === "requested").map((order) => order.customer_id));
  const checkoutCustomerGroups = groupOrdersByCustomer(orders.filter((order) => checkoutCustomerIds.has(order.customer_id)));
  const historyDateGroups = Array.from(historyOrders.reduce((dateMap, order) => {
    const timestamp = order.paid_at ?? order.created_at;
    const dateKey = new Date(timestamp).toLocaleDateString("sv-SE");
    const existing = dateMap.get(dateKey);
    if (existing) existing.push(order);
    else dateMap.set(dateKey, [order]);
    return dateMap;
  }, new Map<string, Order[]>()).entries()).map(([dateKey, dateOrders]) => ({
    dateKey,
    label: new Date(`${dateKey}T00:00:00`).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }),
    customers: groupOrdersByCustomer(dateOrders),
  })).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const unservedOrders = visibleOrders.filter(
    (order) => order.status !== "served"
  );

  const renderOrder = (order: Order) => {
    const total = (order.items ?? []).reduce(
      (sum, item) =>
        sum + item.price * (item.quantity - item.cancelled_quantity),
      0
    );

    const orderDate = formatDate(order.created_at);

    return (
      <div
        key={order.id}
        className="rounded-md border border-[#6A243D] bg-[#261019] p-4 shadow-lg shadow-black/20"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#C5B7BA]">
            <span className="rounded-sm bg-[#35131F] px-2.5 py-1.5">{orderDate.date}</span>
            <span className="rounded-sm bg-[#35131F] px-2.5 py-1.5">{orderDate.time}</span>
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
            const remainingQuantity = Math.max(0, item.quantity - item.served_quantity - item.cancelled_quantity);
            const isCancelled = item.cancelled_quantity >= item.quantity;
            const isFullyServed = remainingQuantity === 0 && !isCancelled;

            return (
              <div
                key={item.id}
                className="rounded-md border border-[#6A243D] bg-[#35131F] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={`font-bold ${
                        isCancelled ? "text-[#A18F96] line-through" : isFullyServed ? "text-[#D8B58A]" : "text-[#F3EDEB]"
                      }`}
                    >
                      {isFullyServed && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#D8B58A] align-middle" />}
                      {getMenuPresentation(item.name)?.english ?? item.name} × {item.quantity}
                      {item.cancelled_quantity > 0 && <span className="ml-2 text-xs font-semibold text-[#F08A91]">{isCancelled ? "キャンセル済み" : `一部キャンセル ${item.cancelled_quantity}点`}</span>}
                    </p>
                    {item.option && (
                      <span className="mt-1 inline-flex rounded-sm border border-[#C65A73]/60 bg-[#4A182A] px-2.5 py-1 text-xs font-bold tracking-wide text-[#F3D9AE]">
                        {item.option.toUpperCase()}
                      </span>
                    )}

                    <p className="mt-1 text-sm text-[#C5B7BA]">
                      ¥{(item.price * (item.quantity - item.cancelled_quantity)).toLocaleString("en-US")}
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
                    remainingQuantity > 0 && (
                      <button
                        onClick={() =>
                          serveOneItem(
                            order.id,
                            item.id
                          )
                        }
                        className="shrink-0 rounded-md bg-[#A51D43] px-3 py-2 text-sm font-bold text-[#FFF9F5] transition hover:bg-[#C02A52]"
                      >
                        ＋ 提供
                      </button>
                    )}

                  {!showHistory && (order.checkout_status === "none" || order.checkout_status === null) && remainingQuantity > 0 && (
                    <button type="button" onClick={() => cancelOrderItem(order, item)} className="shrink-0 rounded-md border border-[#C83D4D]/50 px-3 py-2 text-xs font-semibold text-[#F08A91] hover:bg-[#C83D4D]/10">キャンセル</button>
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

        <div className="mt-4 border-t border-[#6A243D] pt-4 text-xl font-bold text-[#F3EDEB]">
          合計 ¥{total.toLocaleString("en-US")}
        </div>

        <div className="mt-4 border-t border-[#6A243D] pt-4 text-sm text-[#C5B7BA]">
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
                    tableLabel(order.table_number)
                  )
                }
                className="mt-4 w-full rounded-md bg-[#4A182A] px-4 py-3 font-bold text-[#F3EDEB] transition hover:bg-[#6A243D]"
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
    { id: "customers" as const, label: "お客様", icon: "users" as const, badge: 0 },
    { id: "calls" as const, label: "呼び出し", icon: "phone" as const, badge: staffCalls.length },
    { id: "products" as const, label: "商品", icon: "package" as const, badge: soldOutCount },
    { id: "history" as const, label: "履歴", icon: "receipt" as const, badge: 0 },
  ];

  return (
    <main style={{ fontFamily: '"Avenir Next", Avenir, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }} className="min-h-screen bg-[#16070D] px-3 py-5 text-[#F3EDEB] sm:px-6 sm:py-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-3 border-b border-[#6A243D] pb-5">
          <div>
            
            <h1 className="mt-1 font-serif text-3xl font-medium tracking-[0.16em] text-[#F3EDEB]"><MyongaWordmark /></h1>
            <p className="mt-1 text-xs tracking-wide text-[#A18F96]">STAFF CONSOLE</p>
          </div>
          <button
            type="button"
            onClick={toggleNotificationSound}
            aria-pressed={notificationSoundEnabled}
            className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${notificationSoundEnabled ? "border-[#C65A73] bg-[#4A182A] text-[#F3D9AE]" : "border-[#6A243D] bg-[#261019] text-[#C5B7BA]"}`}
          >
            <span className="inline-flex items-center gap-2"><AdminIcon name="volume-2" size={16} />通知音 {notificationSoundEnabled ? "ON" : "OFF"}</span>
          </button>
        </header>

        <nav className="sticky top-0 z-30 -mx-3 mb-6 grid grid-cols-6 gap-1 border-y border-[#6A243D] bg-[#16070D]/95 px-2 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-lg sm:border sm:bg-[#261019] sm:p-2">
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
                  ? "bg-[#A51D43] text-[#FFF9F5] shadow-[0_5px_16px_rgba(0,0,0,0.28)]"
                  : "text-[#C5B7BA] hover:bg-[#4A182A]"
              }`}
            >
              <AdminIcon name={tab.icon} size={19} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#16070D] bg-[#C83D4D] px-1 text-[10px] font-black leading-none text-white">
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
                <h2 className="mt-1 font-serif text-2xl font-medium">注文管理</h2>
              </div>
              <span className="text-xs text-[#A18F96]">未提供 {unservedOrders.length}件</span>
            </div>
            {selectedCustomerId && (
              <div className="mb-4 flex items-center justify-between rounded-md border border-[#C65A73]/50 bg-[#35131F] px-4 py-3">
                <span className="text-sm text-[#D7B77C]">お客様を絞り込み中</span>
                <button onClick={() => setSelectedCustomerId(null)} className="text-sm font-semibold text-[#F3EDEB] underline underline-offset-4">解除</button>
              </div>
            )}
            <div className="space-y-4">
              {visibleCustomerGroups.map((group) => {
                const groupUnserved = group.orders.reduce((count, order) => count + order.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.served_quantity - item.cancelled_quantity), 0), 0);
                const groupItemCount = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity - item.cancelled_quantity, 0), 0);
                return (
                  <section key={group.customer_id} className="rounded-md border border-[#6A243D] bg-[#261019] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <div>
                        <h3 className="font-serif text-base font-medium text-[#F3EDEB]">{tableLabel(group.table_number)}</h3>
                        <p className="text-[10px] text-[#8F8288]">ID：{group.customer_id.slice(0, 8)}</p>
                        <p className="mt-0.5 text-xs text-[#A18F96]">{group.orders.length}件の注文 ・ 商品 {groupItemCount}点</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {groupUnserved > 0 && <span className="text-xs font-semibold text-[#E0525B]">● 未提供 {groupUnserved}点</span>}
                        <button type="button" onClick={() => serveAllCustomerItems(group.customer_id, tableLabel(group.table_number))} disabled={group.orders.every((order) => order.items.every((item) => item.served_quantity + item.cancelled_quantity >= item.quantity))} className="rounded-md border border-[#C65A73]/60 bg-[#4A182A] px-3 py-2 text-[11px] font-semibold text-[#F3D9AE] transition hover:bg-[#6A243D] disabled:cursor-not-allowed disabled:opacity-40">全品提供済みにする</button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {group.orders.map(renderOrder)}
                    </div>
                  </section>
                );
              })}
              {visibleCustomerGroups.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">現在、注文はありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "customers" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">GUESTS</p>
              <h2 className="mt-1 font-serif text-2xl font-medium">お客様一覧</h2>
              <p className="mt-2 text-sm text-[#A18F96]">卓番とIDで端末を管理します。同じ卓番の重複登録も可能です。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowManualRegister(true)} className="rounded-md bg-[#A51D43] px-3 py-2.5 text-xs font-semibold text-[#FFF9F5]">＋ 端末を手動登録</button>
                <button type="button" onClick={resetAllTerminals} className="rounded-md border border-[#C65A73]/60 bg-[#4A182A] px-3 py-2.5 text-xs font-semibold text-[#F2C8D1]">全端末リセット</button>
              </div>
            </div>
            <div className="space-y-3">
              {activeCustomers.map((customer) => {
                const selected = selectedCustomerId === customer.customer_id;
                const customerTotal = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * (item.quantity - item.cancelled_quantity), 0), 0);
                const totalQuantity = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity - item.cancelled_quantity, 0), 0);
                const servedQuantity = customer.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.served_quantity, 0), 0);
                const hasCheckoutRequest = customer.orders.some((order) => order.checkout_status === "requested");
                return (
                  <article key={customer.customer_id} className="overflow-hidden rounded-md border border-[#6A243D] bg-[#261019]">
                    <div className="flex items-center gap-2 p-3 sm:p-4">
                      <button type="button" onClick={() => setSelectedCustomerId(selected ? null : customer.customer_id)} className="min-w-0 flex-1 rounded-md px-1 py-1 text-left hover:bg-[#35131F]">
                        <span className="block text-xl font-semibold text-[#F3EDEB]">{tableLabel(customer.table_number)}</span>
                        <span className="mt-0.5 block text-[10px] text-[#8F8288]">ID：{customer.customer_id.slice(0, 8)}</span>
                        {customer.table_number !== null && activeCustomers.filter((entry) => entry.table_number === customer.table_number).length > 1 && <span className="mt-1 inline-flex rounded-sm bg-[#7A1C36]/30 px-2 py-0.5 text-[10px] font-semibold text-[#F0A2B3]">卓番重複</span>}
                        <span className="mt-1 block text-xs text-[#A18F96]">{selected ? "詳細を閉じる −" : "詳細を見る ＋"}</span>
                      </button>

                    </div>
                    {selected && (
                      <div className="border-t border-[#6A243D] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-lg font-medium text-[#F3EDEB]">{tableLabel(customer.table_number)}</h3>
                            <p className="mt-0.5 text-[10px] text-[#8F8288]">ID：{customer.customer_id.slice(0, 8)}</p>
                          </div>
                          <span className={`text-xs font-semibold ${servedQuantity >= totalQuantity ? "text-[#D8B58A]" : "text-[#E0525B]"}`}>提供済み {servedQuantity} / {totalQuantity}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-sm bg-[#35131F] p-3"><p className="text-xs text-[#A18F96]">会計金額</p><p className="mt-1 text-lg font-bold text-[#F3EDEB]">¥{customerTotal.toLocaleString("ja-JP")}</p></div>
                          <div className="rounded-sm bg-[#35131F] p-3"><p className="text-xs text-[#A18F96]">注文・商品</p><p className="mt-1 text-lg font-bold text-[#F3EDEB]">{customer.orderCount}件 / {totalQuantity}点</p></div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-[#C5B7BA]">
                          <span>卓番修正</span>
                          <select value={String(customer.table_number ?? "")} onChange={(event) => updateCustomerTableNumber(customer.customer_id, event.target.value)} className="rounded border border-[#6A243D] bg-[#35131F] px-2 py-1 text-[#F3EDEB]">
                            <option value="" disabled>未設定</option>
                            {Array.from({ length: 20 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{String(number).padStart(2, "0")}</option>)}
                          </select>
                        </div>
                        <p className="mt-3 text-sm text-[#C5B7BA]">会計状態：{hasCheckoutRequest ? "お会計依頼中" : "未会計"}</p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          {hasCheckoutRequest ? (
                            <button type="button" onClick={() => cancelCustomerCheckout(customer.customer_id, tableLabel(customer.table_number))} className="flex-1 rounded-md border border-[#C83D4D]/60 bg-[#4A182A] px-3 py-3 text-sm font-semibold text-[#F08A91]">会計依頼を取り消す</button>
                          ) : customer.orders.length > 0 ? (
                            <button type="button" onClick={() => startCustomerCheckout(customer.customer_id, tableLabel(customer.table_number))} className="flex-1 rounded-md bg-[#A51D43] px-3 py-3 text-sm font-semibold text-[#FFF9F5]">この卓のお会計をする</button>
                          ) : (
                            <span className="text-xs text-[#8F8288]">注文待ち</span>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => { setProxyOrderCustomerId(customer.customer_id); setProxyCart([]); setProxySelectedProductId(""); setProxySelectedOption(""); }} className="rounded-md border border-[#C65A73]/60 bg-[#4A182A] px-3 py-3 text-sm font-semibold text-[#F2D8DF]">スタッフが代理注文する</button>
                          <button type="button" disabled={customer.orders.length > 0} onClick={() => resetCustomerTerminal(customer.customer_id, tableLabel(customer.table_number))} className="rounded-md border border-[#A51D43]/70 bg-[#35131F] px-3 py-3 text-sm font-semibold text-[#F2C8D1] disabled:cursor-not-allowed disabled:opacity-40">端末をリセット</button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {customer.orders.map(renderOrder)}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {activeCustomers.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">現在利用中の端末はありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "checkout" && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">CHECKOUT</p><h2 className="mt-1 font-serif text-2xl font-medium">お会計</h2></div>
              <span className="text-xs text-[#A18F96]">依頼中 {checkoutCustomerGroups.length}卓</span>
            </div>
            <div className="space-y-3">
              {checkoutCustomerGroups.map((group) => {
                const total = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * (item.quantity - item.cancelled_quantity), 0), 0);
                const requestTimes = group.orders.filter((order) => order.checkout_status === "requested").map((order) => order.checkout_requested_at).filter(Boolean) as string[];
                const requestTime = requestTimes.length > 0 ? requestTimes.sort()[0] : null;
                const expanded = expandedCheckoutCustomerId === group.customer_id;
                return <section key={group.customer_id} className="overflow-hidden rounded-md border border-[#6A243D] bg-[#261019]">
                  <button type="button" onClick={() => setExpandedCheckoutCustomerId(expanded ? null : group.customer_id)} className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#35131F]">
                    <span className="min-w-0">
                      <span className="block font-serif font-medium text-[#F3EDEB]">{tableLabel(group.table_number)}</span>
                      <span className="mt-0.5 block text-[10px] text-[#8F8288]">ID：{group.customer_id.slice(0, 8)}</span>
                      <span className="mt-2 block text-xs text-[#A18F96]">依頼時間：{requestTime ? new Date(requestTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "不明（旧データ）"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xl font-semibold text-[#F3EDEB]">¥{total.toLocaleString("ja-JP")}</span>
                      <span className="mt-1 block text-xs text-[#A18F96]">{expanded ? "詳細を閉じる −" : "詳細を見る ＋"}</span>
                    </span>
                  </button>
                  {expanded && <div className="border-t border-[#6A243D] p-4">
                    <div className="space-y-3">{group.orders.map(renderOrder)}</div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => cancelCustomerCheckout(group.customer_id, tableLabel(group.table_number))} className="rounded-md border border-[#C83D4D]/60 bg-[#4A182A] px-3 py-3 text-sm font-semibold text-[#F08A91]">会計を取り消す</button>
                      <button type="button" onClick={() => completeCustomerCheckout(group.customer_id, tableLabel(group.table_number))} className="rounded-md bg-[#A51D43] px-3 py-3 text-sm font-semibold text-[#FFF9F5]">会計を完了する</button>
                    </div>
                  </div>}
                </section>;
              })}
              {checkoutCustomerGroups.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">現在、お会計依頼はありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "calls" && (
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">GUEST ASSISTANCE</p>
                <h2 className="mt-1 font-serif text-2xl font-medium">スタッフ呼び出し</h2>
              </div>
              <span className="rounded-full border border-[#C65A73]/50 bg-[#4A182A] px-3 py-1 text-sm font-semibold text-[#D7B77C]">未対応 {staffCalls.length}件</span>
            </div>
            <div className="space-y-3">
              {staffCalls.map((call) => (
                <article key={call.id} className="rounded-lg border border-[#C65A73]/40 bg-gradient-to-br from-[#35131F] to-[#261019] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#F3EDEB]">{tableLabel(call.table_number)}</p>
                      <p className="text-[10px] text-[#8F8288]">ID：{call.customer_id.slice(0, 8)}</p>
                      <p className="mt-1 text-xs text-[#D7B77C]">{new Date(call.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 呼び出し</p>
                    </div>
                    <span className="rounded-full bg-[#C83D4D]/15 px-3 py-1 text-xs font-bold text-[#F08A91]">未対応</span>
                  </div>
                  <button onClick={() => completeStaffCall(call)} disabled={updatingCallIds.includes(call.id)} className="mt-4 w-full rounded-md bg-[#A51D43] px-4 py-3 font-semibold text-[#FFF9F5] transition hover:bg-[#C02A52] disabled:opacity-50">{updatingCallIds.includes(call.id) ? "更新中..." : "対応済みにする"}</button>
                </article>
              ))}
              {staffCalls.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">未対応の呼び出しはありません。</p>}
            </div>
          </section>
        )}

        {activeTab === "products" && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">MENU CONTROL</p>
                <h2 className="mt-1 font-serif text-2xl font-medium">商品管理</h2>
              </div>
              <span className="text-xs text-[#C5B7BA]">販売中 {products.filter((product) => product.is_available).length} / {products.length}</span>
            </div>
            <p className="mb-4 text-sm text-[#A18F96]">売り切れにすると、お客様側には「売り切れ」と表示され、注文できなくなります。</p>
            <div className="space-y-3">
              {products.map((product) => {
                const isUpdating = updatingProductIds.includes(product.id);
                return (
                  <article key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#6A243D] bg-[#261019] p-4">
                    <div className="min-w-0">
                      <p className={`font-sans text-base ${product.is_available ? "text-[#F3EDEB]" : "text-[#A18F96]"}`}>{getMenuPresentation(product.name)?.english ?? product.name}</p>
                      <p className="mt-0.5 text-xs tracking-wide text-[#A18F96]">{getMenuPresentation(product.name)?.reading ?? ""}</p>
                      <p className="mt-1 text-sm text-[#C5B7BA]">{getMenuPresentation(product.name)?.category ?? product.category ?? "Uncategorized"} / ¥{product.price.toLocaleString("en-US")}</p>
                      <p className={`mt-1 text-xs font-semibold ${product.is_available ? "text-[#D7B77C]" : "text-[#F08A91]"}`}>{product.is_available ? "販売中" : "売り切れ"}</p>
                    </div>
                    <button onClick={() => toggleProductAvailability(product)} disabled={isUpdating} className={`shrink-0 rounded-md px-3 py-2.5 text-xs font-bold text-[#FFF9F5] transition disabled:opacity-50 ${product.is_available ? "bg-[#4A182A] hover:bg-[#6A243D]" : "bg-[#A51D43] hover:bg-[#C02A52]"}`}>{isUpdating ? "更新中..." : product.is_available ? "売り切れにする" : "販売中に戻す"}</button>
                  </article>
                );
              })}
              {products.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">商品が登録されていません。</p>}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section>
            <div className="mb-5">
              <p className="text-[10px] font-semibold tracking-[0.28em] text-[#D7B77C]">PAYMENT HISTORY</p>
              <h2 className="mt-1 font-serif text-2xl font-medium">会計履歴</h2>
            </div>
            <div className="space-y-5">
              {historyDateGroups.map((day) => (
                <section key={day.dateKey} className="space-y-3">
                  <button type="button" onClick={() => setExpandedHistoryDate(expandedHistoryDate === day.dateKey ? null : day.dateKey)} className="flex w-full items-center justify-between border-b border-[#6A243D] pb-2 text-left text-sm font-semibold text-[#E8C8D1]">
                    <span>{day.label}</span>
                    <span className="text-xs text-[#A18F96]">{expandedHistoryDate === day.dateKey ? "閉じる −" : `${day.customers.length}件・開く ＋`}</span>
                  </button>
                  {expandedHistoryDate === day.dateKey && day.customers.map((group) => {
                    const key = `${day.dateKey}:${group.customer_id}`;
                    const expanded = expandedHistoryKey === key;
                    const total = group.orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.price * (item.quantity - item.cancelled_quantity), 0), 0);
                    const paidTimes = group.orders.map((order) => order.paid_at).filter(Boolean).sort();
                    const paidAt = paidTimes[paidTimes.length - 1] ?? null;
                    const resettable = !orders.some((order) => order.customer_id === group.customer_id);
                    return (
                      <article key={group.customer_id} className="overflow-hidden rounded-md border border-[#6A243D] bg-[#261019]">
                        <div className="flex items-center gap-2 p-3">
                          <button type="button" onClick={() => setExpandedHistoryKey(expanded ? null : key)} className="min-w-0 flex-1 text-left">
                            <span className="block text-lg font-semibold text-[#F3EDEB]">{tableLabel(group.table_number)}</span>
                            <span className="mt-0.5 block text-[10px] text-[#8F8288]">ID：{group.customer_id.slice(0, 8)}</span>
                            <span className="mt-1 block text-xs text-[#A18F96]">会計完了：{paidAt ? new Date(paidAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "時刻未記録（旧データ）"}</span>
                          </button>
                          <div className="shrink-0 text-right">
                            <span className="block text-lg font-semibold text-[#F3EDEB]">¥{total.toLocaleString("ja-JP")}</span>
                            <span className="block text-[10px] text-[#A18F96]">{expanded ? "詳細を閉じる −" : "詳細を見る ＋"}</span>
                          </div>
                          <button type="button" disabled={!resettable} onClick={() => resetCustomerTerminal(group.customer_id, tableLabel(group.table_number))} className="shrink-0 rounded-md border border-[#A51D43] bg-[#4A182A] px-2.5 py-2 text-[10px] font-semibold text-[#F2C8D1] disabled:opacity-40"><AdminIcon name="refresh-ccw" size={14} /></button>
                        </div>
                        {expanded && <div className="space-y-3 border-t border-[#6A243D] p-3">{group.orders.map(renderOrder)}</div>}
                      </article>
                    );
                  })}
                </section>
              ))}
              {historyDateGroups.length === 0 && <p className="rounded-md border border-[#6A243D] bg-[#261019] p-6 text-center text-sm text-[#A18F96]">会計履歴はありません。</p>}
            </div>
          </section>
        )}

        {showManualRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
            <div className="w-full max-w-sm rounded-md border border-[#6A243D] bg-[#261019] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-[#F3EDEB]">端末を手動登録</h2>
              <p className="mt-2 text-sm text-[#C5B7BA]">スマートフォンを利用できないお客様の卓番を選択してください。</p>
              <label className="mt-4 block text-xs text-[#A18F96]">卓番</label>
              <select value={manualTableNumber} onChange={(event) => setManualTableNumber(event.target.value)} className="mt-1 w-full rounded border border-[#6A243D] bg-[#35131F] px-3 py-3 text-[#F3EDEB]">
                {Array.from({ length: 20 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{String(number).padStart(2, "0")}</option>)}
              </select>
              <p className="mt-2 text-xs text-[#8F8288]">同じ卓番が登録済みでも、新しい端末として登録します。</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowManualRegister(false)} className="rounded-md border border-[#6A243D] px-3 py-3 text-sm text-[#C5B7BA]">戻る</button>
                <button type="button" onClick={registerManualCustomer} className="rounded-md bg-[#A51D43] px-3 py-3 text-sm font-semibold text-white">登録する</button>
              </div>
            </div>
          </div>
        )}

        {proxyOrderCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-[#6A243D] bg-[#261019] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-[#F3EDEB]">スタッフ代理注文</h2>
              <p className="mt-1 text-sm text-[#C5B7BA]">{tableLabel(customerSessions.find((customer) => customer.id === proxyOrderCustomerId)?.table_number)} ・ ID：{proxyOrderCustomerId.slice(0, 8)}</p>
              <label className="mt-4 block text-xs text-[#A18F96]">商品</label>
              <select value={proxySelectedProductId} onChange={(event) => { setProxySelectedProductId(event.target.value); setProxySelectedOption(""); }} className="mt-1 w-full rounded border border-[#6A243D] bg-[#35131F] px-3 py-3 text-[#F3EDEB]">
                <option value="">商品を選択</option>
                {products.filter((product) => product.is_available).map((product) => <option key={product.id} value={product.id}>{getMenuPresentation(product.name)?.english ?? product.name} · ¥{product.price.toLocaleString("ja-JP")}</option>)}
              </select>
              {selectedProxyProduct && getMenuPresentation(selectedProxyProduct.name)?.optionType && (
                <>
                  <label className="mt-3 block text-xs text-[#A18F96]">オプション</label>
                  <select value={proxySelectedOption} onChange={(event) => setProxySelectedOption(event.target.value)} className="mt-1 w-full rounded border border-[#6A243D] bg-[#35131F] px-3 py-3 text-[#F3EDEB]">
                    <option value="">選択してください</option>
                    {(getMenuPresentation(selectedProxyProduct.name)?.optionType === "temperature" ? ["Hot", "Ice"] : ["Orange", "Soda"]).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </>
              )}
              <div className="mt-3 flex items-end gap-2">
                <label className="flex-1 text-xs text-[#A18F96]">数量<input type="number" min="1" max="99" value={proxyQuantity} onChange={(event) => setProxyQuantity(event.target.value)} className="mt-1 w-full rounded border border-[#6A243D] bg-[#35131F] px-3 py-3 text-[#F3EDEB]" /></label>
                <button type="button" onClick={addProxyCartItem} className="rounded-md bg-[#A51D43] px-4 py-3 text-sm font-semibold text-white">追加</button>
              </div>
              <div className="mt-4 space-y-2">
                {proxyCart.map((item, index) => <div key={`${item.product.id}-${item.option ?? "none"}`} className="flex items-center justify-between gap-2 rounded border border-[#6A243D] bg-[#35131F] p-3 text-sm"><span>{getMenuPresentation(item.product.name)?.english ?? item.product.name}{item.option ? ` · ${item.option}` : ""} × {item.quantity}</span><button type="button" onClick={() => setProxyCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs text-[#F0A2B3]">削除</button></div>)}
                {proxyCart.length === 0 && <p className="py-5 text-center text-sm text-[#8F8288]">商品が追加されていません。</p>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#6A243D] pt-3"><span className="text-sm text-[#A18F96]">合計</span><strong className="text-lg text-[#F3EDEB]">¥{proxyCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("ja-JP")}</strong></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setProxyOrderCustomerId(null); setProxyCart([]); }} className="rounded-md border border-[#6A243D] px-3 py-3 text-sm text-[#C5B7BA]">閉じる</button>
                <button type="button" onClick={submitProxyOrder} disabled={proxyCart.length === 0 || submittingProxyOrder} className="rounded-md bg-[#A51D43] px-3 py-3 text-sm font-semibold text-white disabled:opacity-50">{submittingProxyOrder ? "登録中..." : "注文を確定"}</button>
              </div>
            </div>
          </div>
        )}

        {checkoutPaymentCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
            <div className="w-full max-w-sm rounded-md border border-[#6A243D] bg-[#261019] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-[#F3EDEB]">支払い方法を選択</h2>
              <p className="mt-2 text-sm text-[#C5B7BA]">スタッフ側から会計を開始したお客様です。実際の支払い方法を選択してください。</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => finalizeCustomerCheckout(checkoutPaymentCustomerId, "cash")} className="rounded-md bg-[#4A182A] px-3 py-4 font-semibold text-[#F3EDEB]">現金</button>
                <button type="button" onClick={() => finalizeCustomerCheckout(checkoutPaymentCustomerId, "paypay")} className="rounded-md bg-[#4A182A] px-3 py-4 font-semibold text-[#F3EDEB]">PayPay</button>
              </div>
              <button type="button" onClick={() => setCheckoutPaymentCustomerId(null)} className="mt-3 w-full rounded-md border border-[#6A243D] px-3 py-2 text-sm text-[#C5B7BA]">戻る</button>
            </div>
          </div>
        )}

        <footer className="mt-8 pb-2 text-center text-[9px] tracking-[0.14em] text-[#76515E]">{APP_VERSION}</footer>
      </div>
    </main>
  );
}
