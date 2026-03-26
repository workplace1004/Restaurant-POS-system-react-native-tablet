import { useState, useCallback, useEffect } from 'react';

const FUNCTION_BUTTON_SLOT_COUNT = 4;
const FUNCTION_BUTTON_ALLOWED_IDS = [
  'tables',
  'weborders',
  'in-wacht',
  'geplande-orders',
  'reservaties',
  'verkopers'
];
const normalizeFunctionButtonsLayout = (value) => {
  if (!Array.isArray(value)) return Array(FUNCTION_BUTTON_SLOT_COUNT).fill('');
  const next = Array(FUNCTION_BUTTON_SLOT_COUNT).fill('');
  const used = new Set();
  for (let i = 0; i < FUNCTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || '').trim();
    if (!candidate) continue;
    if (!FUNCTION_BUTTON_ALLOWED_IDS.includes(candidate)) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  return next;
};

export function usePos(API, socket, selectedTableId = null, focusedOrderId = null) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [webordersCount, setWebordersCount] = useState(0);
  const [weborders, setWeborders] = useState([]);
  const [inPlanningCount, setInPlanningCount] = useState(0);
  const [inWaitingCount, setInWaitingCount] = useState(0);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [savedPositioningLayoutByCategory, setSavedPositioningLayoutByCategory] = useState({});
  const [savedPositioningColorByCategory, setSavedPositioningColorByCategory] = useState({});
  const [savedFunctionButtonsLayout, setSavedFunctionButtonsLayout] = useState(() =>
    Array(FUNCTION_BUTTON_SLOT_COUNT).fill('')
  );
  const [tableLayouts, setTableLayouts] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(false);

  const safeJson = (res) => res.json().catch(() => null);
  const roundCurrency = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const fetchCategories = useCallback(async () => {
    const res = await fetch(`${API}/categories`);
    const data = await safeJson(res);
    if (Array.isArray(data)) {
      setCategories(data);
      if (data.length && !selectedCategoryId) setSelectedCategoryId(data[0].id);
    }
  }, [API]);

  const fetchProducts = useCallback(async (categoryId) => {
    if (!categoryId) return;
    const res = await fetch(`${API}/categories/${categoryId}/products`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setProducts(data);
  }, [API]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`${API}/orders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setOrders(data);
  }, [API]);

  const fetchWebordersCount = useCallback(async () => {
    const res = await fetch(`${API}/weborders/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setWebordersCount(data.count);
  }, [API]);

  const fetchWeborders = useCallback(async () => {
    const res = await fetch(`${API}/weborders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setWeborders(data);
  }, [API]);

  const fetchInPlanningCount = useCallback(async () => {
    const res = await fetch(`${API}/orders/in-planning/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setInPlanningCount(data.count);
  }, [API]);

  const fetchInWaitingCount = useCallback(async () => {
    const res = await fetch(`${API}/orders/in-waiting/count`);
    const data = await safeJson(res);
    if (data && typeof data.count === 'number') setInWaitingCount(data.count);
  }, [API]);

  const fetchTables = useCallback(async () => {
    const res = await fetch(`${API}/tables`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setTables(data);
  }, [API]);

  const fetchOrderHistory = useCallback(async () => {
    const res = await fetch(`${API}/orders/history`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setHistoryOrders(data);
  }, [API]);

  const fetchSubproductsForProduct = useCallback(
    async (productId) => {
      if (!productId) return [];
      const res = await fetch(`${API}/products/${productId}/subproducts`);
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    },
    [API]
  );

  const fetchSavedPositioningLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/product-positioning-layout`);
      const data = await safeJson(res);
      const value = data?.value;
      setSavedPositioningLayoutByCategory(value && typeof value === 'object' ? value : {});
    } catch {
      setSavedPositioningLayoutByCategory({});
    }
  }, [API]);

  const fetchSavedPositioningColors = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/product-positioning-colors`);
      const data = await safeJson(res);
      const value = data?.value;
      setSavedPositioningColorByCategory(value && typeof value === 'object' ? value : {});
    } catch {
      setSavedPositioningColorByCategory({});
    }
  }, [API]);

  const fetchSavedFunctionButtonsLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings/function-buttons-layout`);
      const data = await safeJson(res);
      setSavedFunctionButtonsLayout(normalizeFunctionButtonsLayout(data?.value));
    } catch {
      setSavedFunctionButtonsLayout(Array(FUNCTION_BUTTON_SLOT_COUNT).fill(''));
    }
  }, [API]);

  const fetchTableLayouts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rooms`);
      const rooms = await safeJson(res);
      if (!Array.isArray(rooms)) {
        setTableLayouts({});
        return;
      }
      const layouts = {};
      for (const r of rooms) {
        const id = r?.id;
        if (!id) continue;
        try {
          layouts[id] = r.layoutJson != null && r.layoutJson !== '' ? JSON.parse(r.layoutJson) : { tables: [] };
        } catch {
          layouts[id] = { tables: [] };
        }
      }
      setTableLayouts(layouts);
    } catch {
      setTableLayouts({});
    }
  }, [API]);

  useEffect(() => {
    if (!socket?.on) return;
    const handler = (order) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === order.id);
        const next = idx >= 0 ? [...prev.slice(0, idx), order, ...prev.slice(idx + 1)] : [order, ...prev];
        return next;
      });
      if (order?.status === 'paid' || order?.status === 'in_planning') {
        fetchTables();
      }
    };
    const clearHandler = () => {
      fetchOrders();
      fetchTables();
    };
    socket.on('order:updated', handler);
    socket.on('orders:cleared', clearHandler);
    return () => {
      socket.off('order:updated', handler);
      socket.off('orders:cleared', clearHandler);
    };
  }, [socket, fetchOrders, fetchTables]);

  const currentOrderCandidates = orders.filter((o) => {
    if (o?.status !== 'open') return false;
    if (selectedTableId) return o?.tableId === selectedTableId;
    return !o?.tableId;
  });
  // When viewing an in_waiting or in_planning order, show it without changing status
  const focusedOrderFromWaiting = focusedOrderId ? orders.find((o) => o?.id === focusedOrderId && o?.status === 'in_waiting') : null;
  const focusedOrderFromPlanning = focusedOrderId ? orders.find((o) => o?.id === focusedOrderId && o?.status === 'in_planning') : null;
  const focusedOrder = focusedOrderId
    ? (focusedOrderFromWaiting || focusedOrderFromPlanning || currentOrderCandidates.find((o) => o?.id === focusedOrderId))
    : null;
  const currentOrder = focusedOrder || currentOrderCandidates.reduce((latest, candidate) => {
    if (!latest) return candidate;
    const latestTime = new Date(latest?.createdAt || 0).getTime();
    const candidateTime = new Date(candidate?.createdAt || 0).getTime();
    return candidateTime >= latestTime ? candidate : latest;
  }, null);

  const addItemToOrder = useCallback(
    async (product, quantity = 1, tableId = null) => {
      const notes = product?.subproductName || undefined;
      let orderId = currentOrder?.id;
      if (tableId && currentOrder?.id) {
        try {
          // If current table order is already saved to table, start a new open order on next product add.
          const savedRes = await fetch(`${API}/settings/table-saved-orders`);
          const savedData = await safeJson(savedRes);
          const rawList = Array.isArray(savedData?.value) ? savedData.value : [];
          const savedIds = new Set(
            rawList
              .map((entry) => {
                if (typeof entry === 'string') return String(entry || '').trim();
                if (entry && typeof entry === 'object') return String(entry.orderId ?? entry.id ?? '').trim();
                return '';
              })
              .filter(Boolean)
          );
          if (savedIds.has(String(currentOrder.id))) {
            orderId = null;
          }
        } catch {
          // Keep current behavior if settings lookup fails.
        }
      }
      if (!orderId) {
        const createRes = await fetch(`${API}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId: tableId || null,
            items: [{ productId: product.id, quantity, price: product.price, notes }]
          })
        });
        const created = await safeJson(createRes);
        if (created?.id) {
          orderId = created.id;
          setOrders((prev) => [created, ...prev]);
          return created?.items?.[0]?.id || null;
        }
        return null;
      }
      if (tableId && !currentOrder?.tableId) {
        await fetch(`${API}/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId })
        });
      }
      const prevIds = new Set((currentOrder?.items || []).map((i) => i.id));
      await fetch(`${API}/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity, price: product.price, notes })
      });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) {
        setOrders(list);
        const updatedOrder = list.find((o) => o.id === orderId);
        if (updatedOrder?.items?.length) {
          const createdItem = updatedOrder.items.find((i) => !prevIds.has(i.id));
          return createdItem?.id || null;
        }
      }
      return null;
    },
    [API, currentOrder]
  );

  const appendSubproductNoteToItem = useCallback(
    async (orderItemId, noteText, notePrice = 0) => {
      const orderId = currentOrder?.id;
      const note = String(noteText || '').trim();
      if (!orderId || !orderItemId || !note) return false;
      const target = (currentOrder?.items || []).find((it) => it.id === orderItemId);
      if (!target) return false;
      const extraPrice = Math.max(0, roundCurrency(notePrice));
      const noteToken = extraPrice > 0 ? `${note}::${extraPrice.toFixed(2)}` : note;
      const existingTokens = String(target.notes || '')
        .split(/[;,]/)
        .map((n) => n.trim())
        .filter(Boolean);
      const matchedIndex = existingTokens.findIndex((token) => token.split('::')[0].trim() === note);
      let nextTokens = existingTokens;
      let nextPrice;
      let wasAdded = true;

      if (matchedIndex >= 0) {
        // Toggle off: remove existing subproduct note and subtract its stored extra price.
        const matchedToken = existingTokens[matchedIndex];
        const matchedPriceRaw = String(matchedToken).split('::')[1];
        const matchedPrice = Math.max(0, roundCurrency(Number(matchedPriceRaw) || 0));
        nextTokens = existingTokens.filter((_, idx) => idx !== matchedIndex);
        nextPrice = matchedPrice > 0
          ? Math.max(0, roundCurrency((Number(target.price) || 0) - matchedPrice))
          : undefined;
        wasAdded = false;
      } else {
        // Toggle on: append note and add extra price when configured.
        nextTokens = [...existingTokens, noteToken];
        nextPrice = extraPrice > 0 ? roundCurrency((Number(target.price) || 0) + extraPrice) : undefined;
      }
      await fetch(`${API}/orders/${orderId}/items/${orderItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: nextTokens.length > 0 ? nextTokens.join(', ') : null,
          ...(nextPrice !== undefined ? { price: nextPrice } : {})
        })
      });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
      return wasAdded;
    },
    [API, currentOrder]
  );

  const setOrderTable = useCallback(
    async (orderId, tableId) => {
      if (!orderId) return;
      await fetch(`${API}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: tableId || null })
      });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
    },
    [API]
  );

  const removeOrderItem = useCallback(
    async (orderId, itemId) => {
      await fetch(`${API}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
    },
    [API]
  );

  const updateOrderItemQuantity = useCallback(
    async (orderId, itemId, quantity) => {
      const patchRes = await fetch(`${API}/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({ error: patchRes.statusText }));
        console.error('updateOrderItemQuantity', err);
        return;
      }
      const res = await fetch(`${API}/orders`);
      if (!res.ok) return;
      const list = await res.json().catch(() => []);
      setOrders(list);
    },
    [API]
  );

  const setOrderStatus = useCallback(
    async (orderId, status, options = {}) => {
      const body = { status };
      if (status === 'paid' && options?.paymentBreakdown && typeof options.paymentBreakdown === 'object') {
        body.paymentBreakdown = options.paymentBreakdown;
      }
      if (options?.customerName !== undefined) {
        body.customerName = options.customerName;
      }
      if (options?.userId !== undefined) {
        body.userId = options.userId;
      }
      if (options?.itemBatchBoundaries !== undefined) {
        body.itemBatchBoundaries = options.itemBatchBoundaries;
      }
      if (options?.itemBatchMeta !== undefined) {
        body.itemBatchMeta = options.itemBatchMeta;
      }
      await fetch(`${API}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (status === 'in_planning' || status === 'paid') {
        fetchInPlanningCount();
      }
      if (status === 'in_waiting') {
        fetchInWaitingCount();
      }
      if (status === 'paid') {
        fetchWebordersCount();
        fetchTables();
      }
      if (status === 'in_planning') {
        fetchTables();
      }
      const res = await fetch(`${API}/orders`);
      const list = await safeJson(res);
      if (Array.isArray(list)) setOrders(list);
    },
    [API, fetchInPlanningCount, fetchInWaitingCount, fetchWebordersCount, fetchTables]
  );

  const createOrder = useCallback(async (tableId = null) => {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: tableId || null })
    });
    const created = await safeJson(res);
    if (created?.id) setOrders((prev) => [created, ...prev]);
    return created || null;
  }, [API]);

  const removeAllOrders = useCallback(async () => {
    await fetch(`${API}/orders`, { method: 'DELETE' });
    await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: null })
    });
    const res = await fetch(`${API}/orders`);
    const data = await safeJson(res);
    if (Array.isArray(data)) setOrders(data);
  }, [API]);

  const markOrderPrinted = useCallback(
    async (orderId) => {
      const order = await safeJson(
        await fetch(`${API}/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printed: true })
        })
      );
      if (order?.id) {
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === orderId);
          if (idx >= 0) return [...prev.slice(0, idx), order, ...prev.slice(idx + 1)];
          return prev;
        });
      }
    },
    [API]
  );

  const removeOrder = useCallback(
    async (orderId) => {
      await fetch(`${API}/orders/${orderId}`, { method: 'DELETE' });
      const res = await fetch(`${API}/orders`);
      const data = await safeJson(res);
      if (Array.isArray(data)) setOrders(data);
      const countRes = await fetch(`${API}/weborders/count`);
      const countData = await safeJson(countRes);
      if (countData && typeof countData.count === 'number') setWebordersCount(countData.count);
      const planRes = await fetch(`${API}/orders/in-planning/count`);
      const planData = await safeJson(planRes);
      if (planData && typeof planData.count === 'number') setInPlanningCount(planData.count);
      const waitRes = await fetch(`${API}/orders/in-waiting/count`);
      const waitData = await safeJson(waitRes);
      if (waitData && typeof waitData.count === 'number') setInWaitingCount(waitData.count);
    },
    [API]
  );

  return {
    categories,
    products,
    selectedCategoryId,
    setSelectedCategoryId,
    currentOrder,
    orders,
    webordersCount,
    weborders,
    inPlanningCount,
    inWaitingCount,
    fetchInWaitingCount,
    tables,
    loading,
    fetchWeborders,
    addItemToOrder,
    removeOrderItem,
    updateOrderItemQuantity,
    setOrderStatus,
    markOrderPrinted,
    setOrderTable,
    createOrder,
    removeOrder,
    removeAllOrders,
    fetchCategories,
    fetchProducts,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    fetchTables,
    historyOrders,
    fetchOrderHistory,
    fetchSubproductsForProduct,
    savedPositioningLayoutByCategory,
    fetchSavedPositioningLayout,
    savedPositioningColorByCategory,
    fetchSavedPositioningColors,
    savedFunctionButtonsLayout,
    fetchSavedFunctionButtonsLayout,
    tableLayouts,
    fetchTableLayouts,
    appendSubproductNoteToItem
  };
}
