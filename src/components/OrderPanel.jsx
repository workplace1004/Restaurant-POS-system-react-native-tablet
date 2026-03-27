import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../contexts/LanguageContext';
import { InWaitingNameModal } from './InWaitingNameModal.native';
import { InPlanningDateTimeModal } from './InPlanningDateTimeModal.native';

const KEYPAD = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['C', '0', '.']
];

const formatSubtotalPrice = (n) => `\u20AC ${Number(n).toFixed(2).replace('.', ',')}`;
const roundCurrency = (n) => Math.round((Number(n) || 0) * 100) / 100;
const formatPaymentAmount = (n) => `\u20AC${roundCurrency(n).toFixed(2)}`;
const TABLE_SAVED_ORDERS_API = '/api/settings/table-saved-orders';

/** RN defaults flexDirection to column — flex-row keeps label + price on one line */
const ticketLineRow = 'flex flex-row w-full items-center justify-between';
const ticketNoteRow = 'flex flex-row w-full items-center justify-between pl-6';
const TABLE_LAST_PAID_AT_STORAGE_KEY = 'pos.tables.lastPaidAtById';

function sumAmountsByIntegration(methods, amounts, integration) {
  return methods
    .filter((m) => m.integration === integration)
    .reduce((sum, m) => sum + (Number(amounts[m.id]) || 0), 0);
}

/** Build payment breakdown { amounts: { methodId: amount } } from methods and amounts */
function buildPaymentBreakdown(methods, amounts) {
  const result = {};
  for (const m of methods) {
    const v = Number(amounts[m.id]) || 0;
    if (v > 0.0001) result[m.id] = roundCurrency(v);
  }
  return Object.keys(result).length > 0 ? { amounts: result } : null;
}

/** Allocate payment breakdown proportionally across orders. totalOfAllOrders = sum of order totals. */
function allocatePaymentBreakdown(paymentBreakdown, orderTotal, totalOfAllOrders) {
  if (!paymentBreakdown?.amounts || totalOfAllOrders <= 0) return paymentBreakdown;
  const ratio = orderTotal / totalOfAllOrders;
  const allocated = {};
  for (const [methodId, amt] of Object.entries(paymentBreakdown.amounts)) {
    const allocatedAmt = roundCurrency(amt * ratio);
    if (allocatedAmt > 0.0001) allocated[methodId] = allocatedAmt;
  }
  return Object.keys(allocated).length > 0 ? { amounts: allocated } : null;
}

/** Order ticket card (white panel) — tablet-oriented type size */
const ticketText = 'text-[10px] leading-tight text-pos-bg';
const ticketTextSemi = 'text-[10px] leading-tight text-pos-bg font-semibold';
const ticketNote = 'text-[10px] leading-tight text-pos-bg opacity-90';
const compactBtnText = 'text-[10px]';

export function OrderPanel({ order, orders, onRemoveItem, onUpdateItemQuantity, onStatusChange, onCreateOrder, onRemoveAllOrders, tables, showSubtotalView = false, subtotalBreaks = [], onPaymentCompleted, selectedTable = null, currentUser = null, currentTime = '', onOpenTables, quantityInput = '', setQuantityInput, showInWaitingButton = false, showInPlanningButton = true, onOpenInPlanning, onOpenInWaiting, onSaveInWaitingAndReset, focusedOrderId = null, focusedOrderInitialItemCount = 0 }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [fallbackQuantity, setFallbackQuantity] = useState('');
  const displayQuantity = setQuantityInput ? (quantityInput ?? '') : fallbackQuantity;
  const setDisplayQuantity = setQuantityInput || setFallbackQuantity;
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showInWaitingNameModal, setShowInWaitingNameModal] = useState(false);
  const [showPayNowOrLaterModal, setShowPayNowOrLaterModal] = useState(false);
  const [showInPlanningDateTimeModal, setShowInPlanningDateTimeModal] = useState(false);
  const [inPlanningCalendarAction, setInPlanningCalendarAction] = useState(null); // 'payNow' | 'inPlanning'
  const payNowFromInWaitingRef = useRef(false); // When Yes â†’ calendar â†’ Save â†’ payment: after success, set status to in_planning
  const [showPayDifferentlyModal, setShowPayDifferentlyModal] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [activePaymentMethods, setActivePaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPayworldStatusModal, setShowPayworldStatusModal] = useState(false);
  const [payworldStatus, setPayworldStatus] = useState({ state: 'IDLE', message: '', details: null });
  const [payModalTargetTotal, setPayModalTargetTotal] = useState(0);
  const [payModalKeypadInput, setPayModalKeypadInput] = useState('');
  const [payConfirmLoading, setPayConfirmLoading] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState('');
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('');
  const [showFinalSettlementModal, setShowFinalSettlementModal] = useState(false);
  const [showSettlementSubtotalModal, setShowSettlementSubtotalModal] = useState(false);
  const [settlementModalType, setSettlementModalType] = useState('subtotal');
  const [pendingSplitCheckout, setPendingSplitCheckout] = useState(null);
  const [subtotalLineGroups, setSubtotalLineGroups] = useState([]);
  const [subtotalSelectedLeftIds, setSubtotalSelectedLeftIds] = useState([]);
  const [subtotalSelectedRightIds, setSubtotalSelectedRightIds] = useState([]);
  const [savedTableOrders, setSavedTableOrders] = useState([]);
  const splitRightPanelScrollRef = useRef(null);
  const splitPanelScrollYRef = useRef(0);
  const orderListScrollRef = useRef(null);
  const activeCashmaticSessionIdRef = useRef(null);
  const cancelCashmaticRequestedRef = useRef(false);
  const activePayworldSessionIdRef = useRef(null);
  const cancelPayworldRequestedRef = useRef(false);

  const total = order?.total ?? 0;
  const items = order?.items ?? [];

  useEffect(() => {
    if (orderListScrollRef.current && items.length > 0) {
      orderListScrollRef.current.scrollToEnd?.({ animated: true });
    }
  }, [items.length, items]);
  const hasSelectedTable = selectedTable?.id != null;
  const hasOrderItems = items.length > 0;
  const cashierName = currentUser?.label || currentUser?.name || 'admin';
  const savedTableOrderIds = savedTableOrders.map((entry) => entry.orderId).filter(Boolean);
  const savedOrderMetaById = new Map(savedTableOrders.map((entry) => [entry.orderId, entry]));
  const isSavedTableOrder = !!(hasSelectedTable && order?.id && savedTableOrderIds.includes(order.id));
  /** Saved batches: show oldest first (API `orders` list is usually newest-first). */
  const savedOrdersForSelectedTable = hasSelectedTable
    ? (() => {
        const list = Array.from(
          new Map(
            (orders || [])
              .filter(
                (o) =>
                  o?.id &&
                  o?.status === 'open' &&
                  String(o?.tableId ?? '') === String(selectedTable?.id ?? '') &&
                  savedTableOrderIds.includes(o?.id)
              )
              .map((o) => [o.id, o])
          ).values()
        );
        const batchTime = (o) => {
          const meta = savedOrderMetaById.get(o.id);
          const savedMs = meta?.savedAt ? new Date(meta.savedAt).getTime() : NaN;
          const createdMs = new Date(o?.createdAt || 0).getTime();
          return Number.isFinite(savedMs) && savedMs > 0 ? savedMs : createdMs;
        };
        return list.sort((a, b) => batchTime(a) - batchTime(b));
      })()
    : [];
  const settlementOrder = savedOrdersForSelectedTable[savedOrdersForSelectedTable.length - 1] || null;
  const showSettlementActions = hasSelectedTable && (!!settlementOrder) && (!hasOrderItems || isSavedTableOrder);
  const settlementSubtotalLines = savedOrdersForSelectedTable.flatMap((savedOrder) =>
    (savedOrder?.items || []).map((item, itemIndex) => ({
      id: `${savedOrder.id}:${item?.id || itemIndex}`,
      label: `${Math.max(1, Number(item?.quantity) || 1)}x ${item?.product?.name ?? 'â€”'}`,
      amount: roundCurrency((Number(item?.price) || 0) * Math.max(1, Number(item?.quantity) || 1))
    }))
  );
  const settlementSubtotalLineById = new Map(settlementSubtotalLines.map((line) => [line.id, line]));
  const subtotalAssignedLineIds = new Set(subtotalLineGroups.flatMap((group) => group?.lineIds || []));
  const settlementSubtotalLeftLines = settlementSubtotalLines.filter((line) => !subtotalAssignedLineIds.has(line.id));
  const settlementSubtotalRightGroups = subtotalLineGroups
    .map((group, index) => {
      const lines = (group?.lineIds || []).map((id) => settlementSubtotalLineById.get(id)).filter(Boolean);
      return {
        id: group?.id || `group-${index + 1}`,
        label: `${t('group')} ${index + 1}`,
        lines,
        total: roundCurrency(lines.reduce((sum, line) => sum + (Number(line?.amount) || 0), 0))
      };
    })
    .filter((group) => group.lines.length > 0);
  const hasSplitBillSelection = settlementSubtotalRightGroups.some((group) => group.lines.length > 0);
  const splitSelectedLineIds = settlementSubtotalRightGroups.flatMap((group) => group.lines.map((line) => line.id));
  const splitSelectedTotal = roundCurrency(settlementSubtotalRightGroups.reduce((sum, group) => sum + (Number(group.total) || 0), 0));
  const scrollSplitRightPanel = (direction) => {
    const el = splitRightPanelScrollRef.current;
    if (!el) return;
    const next = Math.max(0, splitPanelScrollYRef.current + direction * 120);
    splitPanelScrollYRef.current = next;
    el.scrollTo?.({ y: next, animated: true });
  };
  const computeOrderTotal = (sourceOrder) =>
    roundCurrency((sourceOrder?.items || []).reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0));
  const currentOrderTotal = hasOrderItems ? computeOrderTotal({ items }) : roundCurrency(total);
  const settlementOrdersTotal = roundCurrency(savedOrdersForSelectedTable.reduce((sum, sourceOrder) => sum + computeOrderTotal(sourceOrder), 0));
  const payableTotal = showSettlementActions ? settlementOrdersTotal : currentOrderTotal;
  const latestOpenNoTableOrder = !hasSelectedTable
    ? (orders || [])
      .filter((o) => o?.status === 'open' && !o?.tableId)
      .reduce((latest, candidate) => {
        if (!latest) return candidate;
        const latestTime = new Date(latest?.createdAt || 0).getTime();
        const candidateTime = new Date(candidate?.createdAt || 0).getTime();
        return candidateTime >= latestTime ? candidate : latest;
      }, null)
    : null;
  const fallbackNoTableTotal = latestOpenNoTableOrder
    ? (Array.isArray(latestOpenNoTableOrder.items) && latestOpenNoTableOrder.items.length > 0
      ? computeOrderTotal(latestOpenNoTableOrder)
      : roundCurrency(Number(latestOpenNoTableOrder?.total) || 0))
    : 0;
  const payableTotalForPaymentModal =
    !hasSelectedTable && payableTotal <= 0.009 && fallbackNoTableTotal > 0.009
      ? fallbackNoTableTotal
      : payableTotal;
  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));
  const hasSelection = selectedItemIds.length > 0;
  const canDecreaseAll = selectedItems.length > 0 && selectedItems.every((i) => (i.quantity ?? 0) > 1);
  const getItemLabel = (item) => item?.product?.name ?? 'â€”';
  const parseNoteToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const [labelPart, pricePart] = raw.split('::');
    const label = String(labelPart || '').trim();
    if (!label) return null;
    if (pricePart == null) return { label, price: 0 };
    const parsed = Number(pricePart);
    if (!Number.isFinite(parsed)) return { label, price: 0 };
    return { label, price: parsed };
  };
  const getItemNotes = (item) =>
    String(item?.notes || '')
      .split(/[;,]/)
      .map((n) => parseNoteToken(n))
      .filter(Boolean);
  const getItemQuantity = (item) => Math.max(1, Number(item?.quantity) || 1);
  const getItemNoteUnitTotal = (item) =>
    roundCurrency(getItemNotes(item).reduce((sum, note) => sum + (Number(note?.price) || 0), 0));
  const getItemBaseUnitPrice = (item) => {
    const productBase = Number(item?.product?.price);
    if (Number.isFinite(productBase)) return roundCurrency(productBase);
    const orderUnitPrice = Number(item?.price) || 0;
    return roundCurrency(Math.max(0, orderUnitPrice - getItemNoteUnitTotal(item)));
  };
  const getItemBaseLinePrice = (item) => roundCurrency(getItemBaseUnitPrice(item) * getItemQuantity(item));
  const getItemNoteLinePrice = (item, note) => roundCurrency((Number(note?.price) || 0) * getItemQuantity(item));
  const formatSavedOrderTime = (dateLike, fallbackDateLike = null) => {
    const d = new Date(dateLike || fallbackDateLike || Date.now());
    if (Number.isNaN(d.getTime())) return currentTime || '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const formatOrderTimestamp = (dateLike) => {
    try {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return 'â€“';
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${dateStr} ${timeStr}`;
    } catch {
      return 'â€“';
    }
  };
  const customerDisplayName = order?.customer ? (order.customer.companyName || order.customer.name) : null;
  const isViewedFromInWaiting = !!(order?.id && focusedOrderId && order.id === focusedOrderId && order?.status === 'in_waiting');
  const isViewedFromInPlanning = !!(order?.id && focusedOrderId && order.id === focusedOrderId && order?.status === 'in_planning');
  const parseBatchData = () => {
    let boundaries = [];
    let meta = [];
    try {
      if (order?.itemBatchBoundariesJson) {
        boundaries = JSON.parse(order.itemBatchBoundariesJson);
        if (!Array.isArray(boundaries)) boundaries = [];
      }
      if (order?.itemBatchMetaJson) {
        meta = JSON.parse(order.itemBatchMetaJson);
        if (!Array.isArray(meta)) meta = [];
      }
    } catch { /* ignore parse errors */ }
    if (boundaries.length === 0 && (focusedOrderInitialItemCount ?? 0) > 0) {
      boundaries = [focusedOrderInitialItemCount];
      meta = [{ userId: order?.userId, userName: order?.user?.name, createdAt: order?.createdAt }];
    }
    return { boundaries, meta };
  };
  const { boundaries: batchBoundaries, meta: batchMeta } = isViewedFromInWaiting ? parseBatchData() : { boundaries: [], meta: [] };
  const lastSavedBoundary = batchBoundaries.length > 0 ? batchBoundaries[batchBoundaries.length - 1] : 0;
  const inWaitingButtonDisabled = isViewedFromInWaiting && (order?.items?.length ?? 0) <= lastSavedBoundary;
  const normalizeSavedTableOrders = (list) => {
    if (!Array.isArray(list)) return [];
    const byOrderId = new Map();
    for (const raw of list) {
      if (raw == null) continue;
      if (typeof raw === 'string') {
        const orderId = String(raw).trim();
        if (!orderId) continue;
        byOrderId.set(orderId, { orderId, cashierName: '', savedAt: null });
        continue;
      }
      if (typeof raw === 'object') {
        const orderId = String(raw.orderId ?? raw.id ?? '').trim();
        if (!orderId) continue;
        byOrderId.set(orderId, {
          orderId,
          cashierName: String(raw.cashierName ?? raw.userName ?? raw.name ?? '').trim(),
          savedAt: raw.savedAt ? String(raw.savedAt) : null
        });
      }
    }
    return Array.from(byOrderId.values());
  };

  const persistSavedTableOrders = async (entries) => {
    const normalized = normalizeSavedTableOrders(entries);
    setSavedTableOrders(normalized);
    const res = await fetch(TABLE_SAVED_ORDERS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: normalized })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to save table order.');
    }
    const serverValue = normalizeSavedTableOrders(data?.value);
    setSavedTableOrders(serverValue);
    return serverValue;
  };

  const toggleItemSelection = (id) => {
    if (isSavedTableOrder) return;
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(TABLE_SAVED_ORDERS_API);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setSavedTableOrders(normalizeSavedTableOrders(data?.value));
      } catch { }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showPayDifferentlyModal) return;
    let cancelled = false;
    (async () => {
      setPaymentMethodsLoading(true);
      try {
        const res = await fetch('/api/payment-methods?active=1');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (cancelled) return;
        setActivePaymentMethods(sorted);
        setPaymentAmounts(Object.fromEntries(sorted.map((m) => [m.id, 0])));
      } catch {
        if (!cancelled) setActivePaymentMethods([]);
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPayDifferentlyModal]);

  const handleKeypad = (key) => {
    if (key === 'C') {
      setDisplayQuantity('');
      return;
    }
    setDisplayQuantity((prev) => String(prev || '') + key);
  };

  const openPayDifferentlyModal = (overrideTotal = null) => {
    const targetTotal = Math.max(0, roundCurrency(overrideTotal ?? payableTotalForPaymentModal));
    setActivePaymentMethods([]);
    setPaymentAmounts({});
    setShowPayDifferentlyModal(true);
    setSelectedPayment(null);
    setPayModalTargetTotal(targetTotal);
    setPayModalKeypadInput(targetTotal.toFixed(2));
  };

  const payModalTotalAssigned = activePaymentMethods.reduce(
    (sum, m) => sum + (Number(paymentAmounts[m.id]) || 0),
    0,
  );
  const payModalRemaining = Math.max(0, payModalTargetTotal - payModalTotalAssigned);
  const payModalKeypadValue = parseFloat(String(payModalKeypadInput || '').replace(',', '.')) || 0;
  /** Block assigning if keypad value would push assigned total over order total. */
  const payModalWouldExceedTotal =
    payModalKeypadValue > 0 &&
    roundCurrency(payModalTotalAssigned + payModalKeypadValue) - payModalTargetTotal > 0.009;
  /** When assigned matches total, lock keypad/methods/half/remaining/cancel; only Reset + To confirm remain active (To confirm runs payment). */
  const payModalSplitComplete =
    (payModalTargetTotal <= 0.009 && payModalTotalAssigned <= 0.009) ||
    (payModalTargetTotal > 0.009 && Math.abs(payModalTotalAssigned - payModalTargetTotal) <= 0.009);

  const handlePayModalKeypad = (key) => {
    if (payModalSplitComplete) return;
    if (key === 'C') {
      setPayModalKeypadInput('');
      return;
    }
    setPayModalKeypadInput((prev) => {
      if (prev === payModalTargetTotal.toFixed(2)) return key;
      return prev + key;
    });
  };

  const handlePaymentMethodClick = (method) => {
    if (!method?.id || payModalSplitComplete || payModalWouldExceedTotal) return;
    const value = parseFloat(String(payModalKeypadInput || '').replace(',', '.')) || 0;
    if (value > 0) {
      setPaymentAmounts((prev) => ({
        ...prev,
        [method.id]: (Number(prev[method.id]) || 0) + value,
      }));
      setPayModalKeypadInput('');
    } else {
      setSelectedPayment(method.id);
    }
  };

  const handlePayHalfAmount = () => {
    if (payModalSplitComplete) return;
    const half = roundCurrency(payModalTargetTotal / 2);
    setPayModalKeypadInput(half.toFixed(2));
  };
  const handlePayRemaining = () => {
    if (payModalSplitComplete) return;
    const remaining = roundCurrency(Math.max(0, payModalTargetTotal - payModalTotalAssigned));
    setPayModalKeypadInput(remaining.toFixed(2));
  };
  const handlePayReset = () => {
    setPaymentAmounts(Object.fromEntries(activePaymentMethods.map((m) => [m.id, 0])));
    setPayModalKeypadInput(payModalTargetTotal.toFixed(2));
    setSelectedPayment(null);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runCashmaticPayment = async (amountEuro) => {
    const cents = Math.round((Number(amountEuro) || 0) * 100);
    if (cents <= 0) return;

    const startRes = await fetch('/api/cashmatic/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: cents })
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok) {
      throw new Error(startData?.error || 'Unable to start Cashmatic payment.');
    }

    const sessionId = startData?.data?.sessionId;
    if (!sessionId) throw new Error('Cashmatic session did not start.');
    activeCashmaticSessionIdRef.current = sessionId;
    cancelCashmaticRequestedRef.current = false;

    for (let i = 0; i < 90; i += 1) {
      if (cancelCashmaticRequestedRef.current) {
        await fetch(`/api/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
        throw new Error('Cashmatic payment cancelled.');
      }
      await sleep(1000);
      const statusRes = await fetch(`/api/cashmatic/status/${encodeURIComponent(sessionId)}`);
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) {
        throw new Error(statusData?.error || 'Unable to read Cashmatic payment status.');
      }

      const state = String(statusData?.data?.state || '').toUpperCase();
      if (state === 'PAID' || state === 'FINISHED' || state === 'FINISHED_MANUAL') {
        await fetch(`/api/cashmatic/finish/${encodeURIComponent(sessionId)}`, { method: 'POST' });
        activeCashmaticSessionIdRef.current = null;
        return;
      }
      if (state === 'CANCELLED' || state === 'ERROR') {
        throw new Error(statusData?.error || `Cashmatic payment ${state.toLowerCase()}.`);
      }
    }

    await fetch(`/api/cashmatic/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
    activeCashmaticSessionIdRef.current = null;
    throw new Error('Cashmatic payment timeout. Please try again.');
  };

  const runPayworldPayment = async (amountEuro) => {
    const amount = roundCurrency(Number(amountEuro) || 0);
    if (amount <= 0) return;

    setShowPayworldStatusModal(true);
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: tr('orderPanel.payworldConnecting', 'Connecting to terminal...'),
      details: null,
    });

    const startRes = await fetch('/api/payworld/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok || startData?.ok === false) {
      throw new Error(startData?.error || 'Unable to start Payworld payment.');
    }

    const sessionId = startData?.sessionId || startData?.data?.sessionId;
    if (!sessionId) throw new Error('Payworld session did not start.');

    activePayworldSessionIdRef.current = sessionId;
    cancelPayworldRequestedRef.current = false;
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: tr('orderPanel.payworldInProgress', 'Payment in progress on terminal...'),
      details: null,
    });

    for (let i = 0; i < 150; i += 1) {
      if (cancelPayworldRequestedRef.current) {
        await fetch(`/api/payworld/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
        setPayworldStatus({
          state: 'CANCELLED',
          message: tr('orderPanel.paymentCancelled', 'Payment cancelled.'),
          details: null,
        });
        throw new Error(tr('orderPanel.paymentCancelled', 'Payment cancelled.'));
      }
      await sleep(1000);
      const statusRes = await fetch(`/api/payworld/status/${encodeURIComponent(sessionId)}`);
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok || statusData?.ok === false) {
        throw new Error(statusData?.error || 'Unable to read Payworld payment status.');
      }

      const state = String(statusData?.state || '').toUpperCase();
      const statusMessage = String(statusData?.message || '').trim();
      const details = statusData?.details || null;
      setPayworldStatus({
        state: state || 'IN_PROGRESS',
        message: statusMessage || tr('orderPanel.payworldInProgress', 'Payment in progress on terminal...'),
        details,
      });
      if (state === 'APPROVED') {
        setPayworldStatus({
          state: 'APPROVED',
          message: statusMessage || tr('orderPanel.payworldApproved', 'Payment approved.'),
          details,
        });
        await sleep(800);
        setShowPayworldStatusModal(false);
        activePayworldSessionIdRef.current = null;
        return;
      }
      if (state === 'DECLINED' || state === 'CANCELLED' || state === 'ERROR') {
        setShowPayworldStatusModal(false);
        throw new Error(statusMessage || `Payworld payment ${state.toLowerCase()}.`);
      }
    }

    await fetch(`/api/payworld/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => { });
    setPayworldStatus({
      state: 'ERROR',
      message: tr('orderPanel.payworldTimeout', 'Payworld payment timeout. Please try again.'),
      details: null,
    });
    setShowPayworldStatusModal(false);
    activePayworldSessionIdRef.current = null;
    throw new Error('Payworld payment timeout. Please try again.');
  };

  const handleAbortPayworld = async () => {
    const activeSessionId = activePayworldSessionIdRef.current;
    if (!activeSessionId) {
      setPayworldStatus({
        state: 'ERROR',
        message: tr('orderPanel.payworldNoActiveSession', 'No active Payworld session to cancel.'),
        details: null,
      });
      return;
    }

    cancelPayworldRequestedRef.current = true;
    setPayworldStatus({
      state: 'IN_PROGRESS',
      message: tr('orderPanel.payworldCancelling', 'Payment is being cancelled on the terminal...'),
      details: null,
    });

    await fetch(`/api/payworld/cancel/${encodeURIComponent(activeSessionId)}`, { method: 'POST' }).catch(() => { });
  };

  const payworldStatusTitle = (() => {
    switch (String(payworldStatus.state || '').toUpperCase()) {
      case 'IN_PROGRESS':
        return tr('orderPanel.payworldStatusInProgress', 'Payment in progress on terminal...');
      case 'APPROVED':
        return tr('orderPanel.payworldStatusApproved', 'Payment approved.');
      case 'DECLINED':
        return tr('orderPanel.payworldStatusDeclined', 'Payment declined.');
      case 'CANCELLED':
        return tr('orderPanel.payworldStatusCancelled', 'Payment cancelled.');
      case 'ERROR':
        return tr('orderPanel.payworldStatusError', 'Error during payment.');
      default:
        return tr('orderPanel.payworldStatusReady', 'Ready.');
    }
  })();

  const handleCancelPayDifferentlyModal = async () => {
    if (payConfirmLoading) {
      cancelCashmaticRequestedRef.current = true;
      cancelPayworldRequestedRef.current = true;
      const activeSessionId = activeCashmaticSessionIdRef.current;
      if (activeSessionId) {
        await fetch(`/api/cashmatic/cancel/${encodeURIComponent(activeSessionId)}`, { method: 'POST' }).catch(() => { });
      }
      const activePayworldSessionId = activePayworldSessionIdRef.current;
      if (activePayworldSessionId) {
        await fetch(`/api/payworld/cancel/${encodeURIComponent(activePayworldSessionId)}`, { method: 'POST' }).catch(() => { });
      }
      setShowPayworldStatusModal(false);
      setPaymentErrorMessage(tr('orderPanel.paymentCancelled', 'Payment cancelled.'));
    }
    payNowFromInWaitingRef.current = false;
    setShowPayDifferentlyModal(false);
    setPendingSplitCheckout(null);
  };

  const printTicketAutomatically = async (targetOrderId, paymentBreakdown = null) => {
    if (!targetOrderId) throw new Error('No order selected for printing.');
    const body = { orderId: targetOrderId };
    if (paymentBreakdown && typeof paymentBreakdown === 'object') body.paymentBreakdown = paymentBreakdown;
    const printRes = await fetch('/api/printers/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const printData = await printRes.json().catch(() => ({}));
    if (!printRes.ok) {
      throw new Error(printData?.error || 'Automatic ticket print failed.');
    }
    if (printData?.success !== true || printData?.data?.printed !== true) {
      throw new Error(printData?.error || 'Printer did not confirm successful print.');
    }
    return printData?.data || {};
  };
  const printTableTicketAutomatically = async (targetOrderIds, paymentBreakdown = null) => {
    if (!Array.isArray(targetOrderIds) || targetOrderIds.length === 0) {
      throw new Error('No table orders selected for printing.');
    }
    const body = { orderIds: targetOrderIds };
    if (paymentBreakdown && typeof paymentBreakdown === 'object') body.paymentBreakdown = paymentBreakdown;
    const printRes = await fetch('/api/printers/receipt/table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const printData = await printRes.json().catch(() => ({}));
    if (!printRes.ok) {
      throw new Error(printData?.error || 'Automatic table ticket print failed.');
    }
    if (printData?.success !== true || printData?.data?.printed !== true) {
      throw new Error(printData?.error || 'Printer did not confirm successful table print.');
    }
    return printData?.data || {};
  };

  const toApiOrderItem = (item) => {
    const productId = String(item?.productId || item?.product?.id || '').trim();
    if (!productId) throw new Error('Split bill contains an item without product id.');
    return {
      productId,
      quantity: Math.max(1, Number(item?.quantity) || 1),
      price: Number(item?.price) || 0,
      notes: item?.notes || null
    };
  };

  const patchOrderItems = async (orderId, nextItems) => {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: nextItems.map(toApiOrderItem) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to update split order items.');
    return data;
  };

  const markSelectedTablePaid = () => {
    if (!selectedTable?.id) return;
    try {
      const raw = localStorage.getItem(TABLE_LAST_PAID_AT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const current = parsed && typeof parsed === 'object' ? parsed : {};
      current[String(selectedTable.id)] = Date.now();
      localStorage.setItem(TABLE_LAST_PAID_AT_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage write failures.
    }
  };

  const createPaidSplitOrder = async (sourceItems, paymentBreakdown = null) => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: selectedTable?.id || null,
        items: sourceItems.map(toApiOrderItem)
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      throw new Error(data?.error || 'Failed to create split checkout order.');
    }
    await onStatusChange?.(data.id, 'paid', paymentBreakdown ? { paymentBreakdown } : {});
    return data.id;
  };

  const settleSplitBillSelection = async (selectedLineIds, paymentBreakdown = null) => {
    const selectedByOrderId = new Map();
    for (const lineId of selectedLineIds) {
      const [orderId, itemId] = String(lineId || '').split(':');
      if (!orderId || !itemId) continue;
      if (!selectedByOrderId.has(orderId)) selectedByOrderId.set(orderId, new Set());
      selectedByOrderId.get(orderId).add(itemId);
    }
    if (selectedByOrderId.size === 0) throw new Error('No split bill items selected.');

    const paidOrderIds = [];
    const fullySettledSourceOrderIds = [];

    const ordersToPay = [];
    for (const sourceOrder of savedOrdersForSelectedTable) {
      const selectedItemIdsForOrder = selectedByOrderId.get(sourceOrder?.id);
      if (!selectedItemIdsForOrder || selectedItemIdsForOrder.size === 0) continue;

      const sourceItems = Array.isArray(sourceOrder?.items) ? sourceOrder.items : [];
      const selectedItems = sourceItems.filter((item) => selectedItemIdsForOrder.has(item?.id));
      const remainingItems = sourceItems.filter((item) => !selectedItemIdsForOrder.has(item?.id));
      if (selectedItems.length === 0) continue;

      const orderTotal = roundCurrency(selectedItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * Math.max(1, Number(item?.quantity) || 1), 0));
      ordersToPay.push({ sourceOrder, selectedItems, remainingItems, orderTotal });
    }

    const totalPaid = roundCurrency(ordersToPay.reduce((sum, o) => sum + o.orderTotal, 0));

    for (const { sourceOrder, selectedItems, remainingItems, orderTotal } of ordersToPay) {
      const orderPaymentBreakdown = paymentBreakdown && totalPaid > 0
        ? allocatePaymentBreakdown(paymentBreakdown, orderTotal, totalPaid)
        : null;

      if (remainingItems.length === 0) {
        await onStatusChange?.(sourceOrder.id, 'paid', orderPaymentBreakdown ? { paymentBreakdown: orderPaymentBreakdown } : {});
        paidOrderIds.push(sourceOrder.id);
        fullySettledSourceOrderIds.push(sourceOrder.id);
      } else {
        const paidSplitOrderId = await createPaidSplitOrder(selectedItems, orderPaymentBreakdown);
        await patchOrderItems(sourceOrder.id, remainingItems);
        paidOrderIds.push(paidSplitOrderId);
      }
    }

    if (fullySettledSourceOrderIds.length > 0) {
      const nextSaved = savedTableOrders.filter((entry) => !fullySettledSourceOrderIds.includes(entry.orderId));
      await persistSavedTableOrders(nextSaved);
    }

    return paidOrderIds;
  };

  const resetAfterSuccessfulPayment = () => {
    payNowFromInWaitingRef.current = false;
    setShowPayDifferentlyModal(false);
    setPaymentAmounts({});
    setActivePaymentMethods([]);
    setSelectedPayment(null);
    setPayModalTargetTotal(0);
    setPayModalKeypadInput('');
    setSelectedItemIds([]);
    setDisplayQuantity('');
    setShowDeleteAllModal(false);
    setShowSettlementSubtotalModal(false);
    setSettlementModalType('subtotal');
    setPendingSplitCheckout(null);
    setSubtotalLineGroups([]);
    setSubtotalSelectedLeftIds([]);
    setSubtotalSelectedRightIds([]);
    setShowPayworldStatusModal(false);
    setPayworldStatus({ state: 'IDLE', message: '', details: null });
  };

  const handleConfirmPayment = async () => {
    if (payConfirmLoading) return;

    const assignedTotal = roundCurrency(payModalTotalAssigned);
    const orderTotal = roundCurrency(payModalTargetTotal);

    if (orderTotal > 0.009 && assignedTotal <= 0) {
      setPaymentErrorMessage(tr('orderPanel.assignedAmountGreaterThanZero', 'Assigned amount must be greater than 0.'));
      return;
    }
    if (Math.abs(assignedTotal - orderTotal) > 0.009) {
      setPaymentErrorMessage(`Assigned amount (€${assignedTotal.toFixed(2)}) must match total (€${orderTotal.toFixed(2)}).`);
      return;
    }
    if (paymentMethodsLoading || activePaymentMethods.length === 0) {
      setPaymentErrorMessage(
        tr('orderPanel.noPaymentMethods', 'No active payment methods. Add them under Control â†’ Payment types.'),
      );
      return;
    }

    try {
      setPayConfirmLoading(true);
      const cashmaticTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'cashmatic');
      if (cashmaticTotal > 0) {
        await runCashmaticPayment(cashmaticTotal);
      }
      const payworldTotal = sumAmountsByIntegration(activePaymentMethods, paymentAmounts, 'payworld');
      if (payworldTotal > 0) {
        await runPayworldPayment(payworldTotal);
      }
      if (pendingSplitCheckout?.type === 'splitBill') {
        const paymentBreakdown = buildPaymentBreakdown(activePaymentMethods, paymentAmounts);
        const paidOrderIds = await settleSplitBillSelection(pendingSplitCheckout.lineIds || [], paymentBreakdown);
        if (paidOrderIds.length === 0) {
          throw new Error('No split bill order available for checkout.');
        }

        let printedSuccessfully = true;
        let printResult = null;
        try {
          if (paidOrderIds.length === 1) {
            const amounts = {};
            for (const m of activePaymentMethods) {
              const v = Number(paymentAmounts[m.id]) || 0;
              if (v > 0.0001) amounts[m.id] = v;
            }
            printResult = await printTicketAutomatically(paidOrderIds[0], { amounts });
          } else {
            // Same table, one combined final ticket (was: loop printed one receipt per paid order).
            printResult = await printTableTicketAutomatically(paidOrderIds, paymentBreakdown);
          }
        } catch (printErr) {
          printedSuccessfully = false;
          setPaymentErrorMessage(printErr?.message || 'Automatic ticket print failed.');
        }

        await onPaymentCompleted?.(paidOrderIds);
        markSelectedTablePaid();
        if (printedSuccessfully) {
          setPaymentSuccessMessage(
            `Payment successful (${formatPaymentAmount(orderTotal)}). Receipt printed successfully${printResult?.printerName ? ` on ${printResult.printerName}` : ''}.`
          );
        }

        const nextAction = pendingSplitCheckout.action;
        resetAfterSuccessfulPayment();
        if (nextAction === 'continue') {
          setSettlementModalType('splitBill');
          setShowSettlementSubtotalModal(true);
        }
        return;
      }

      const targetOrderIds = showSettlementActions
        ? savedOrdersForSelectedTable.map((o) => o.id).filter(Boolean)
        : (order?.id ? [order.id] : []);
      if (targetOrderIds.length === 0) {
        throw new Error('No order available for settlement.');
      }
      const remainingSavedIds = savedTableOrders.filter((entry) => !targetOrderIds.includes(entry.orderId));
      if (remainingSavedIds.length !== savedTableOrders.length) {
        await persistSavedTableOrders(remainingSavedIds);
      }

      const paymentBreakdown = buildPaymentBreakdown(activePaymentMethods, paymentAmounts);
      const settlementTotal = roundCurrency(targetOrderIds.reduce((sum, id) => {
        const o = (showSettlementActions ? savedOrdersForSelectedTable : [order]).find((x) => x?.id === id);
        return sum + (o ? computeOrderTotal(o) : 0);
      }, 0));

      const useInPlanningForPayNow = payNowFromInWaitingRef.current;
      for (const paidOrderId of targetOrderIds) {
        const paidOrder = showSettlementActions
          ? savedOrdersForSelectedTable.find((o) => o?.id === paidOrderId)
          : (order?.id === paidOrderId ? order : null);
        const orderTotal = paidOrder ? computeOrderTotal(paidOrder) : 0;
        const orderPaymentBreakdown = paymentBreakdown && settlementTotal > 0
          ? allocatePaymentBreakdown(paymentBreakdown, orderTotal, settlementTotal)
          : paymentBreakdown;
        const targetStatus = useInPlanningForPayNow && paidOrder?.status === 'in_waiting' ? 'in_planning' : 'paid';
        await onStatusChange?.(paidOrderId, targetStatus, orderPaymentBreakdown ? { paymentBreakdown: orderPaymentBreakdown } : {});
      }
      await onPaymentCompleted?.(targetOrderIds);
      markSelectedTablePaid();
      let printedSuccessfully = true;
      let printResult = null;
      try {
        if (targetOrderIds.length === 1) {
          const amounts = {};
          for (const m of activePaymentMethods) {
            const v = Number(paymentAmounts[m.id]) || 0;
            if (v > 0.0001) amounts[m.id] = v;
          }
          printResult = await printTicketAutomatically(targetOrderIds[0], { amounts });
        } else {
          // For one table settlement, print one combined final receipt with all settled orders.
          printResult = await printTableTicketAutomatically(targetOrderIds, paymentBreakdown);
        }
      } catch (printErr) {
        printedSuccessfully = false;
        setPaymentErrorMessage(printErr?.message || 'Automatic ticket print failed.');
      }
      if (printedSuccessfully) {
        const methodLines = activePaymentMethods
          .map((m) => {
            const v = Number(paymentAmounts[m.id]) || 0;
            return v > 0.0001 ? `${m.name}: ${formatPaymentAmount(v)}` : null;
          })
          .filter(Boolean);
        setPaymentSuccessMessage([
          `Payment successful (${formatPaymentAmount(orderTotal)}).`,
          methodLines.length ? methodLines.join(' | ') : '',
          `Receipt printed successfully${printResult?.printerName ? ` on ${printResult.printerName}` : ''}.`,
        ].filter(Boolean).join(' '));
      }
      if (useInPlanningForPayNow) {
        onOpenInPlanning?.();
      } else if (!hasSelectedTable) {
        await onCreateOrder?.();
      }
      resetAfterSuccessfulPayment();
    } catch (err) {
      setPaymentErrorMessage(err?.message || tr('orderPanel.paymentFailed', 'Payment failed.'));
    } finally {
      setPayConfirmLoading(false);
      activeCashmaticSessionIdRef.current = null;
      activePayworldSessionIdRef.current = null;
      cancelCashmaticRequestedRef.current = false;
      cancelPayworldRequestedRef.current = false;
    }
  };

  return (
    <View className="flex-1 min-h-0 w-full flex flex-col px-2 py-1 bg-pos-bg">
      <View className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white">
        {customerDisplayName ? (
          <View className="px-2 py-1 text-center border-b border-pos-border">
            <Text className={`${ticketText} font-medium truncate block`}>{customerDisplayName}</Text>
          </View>
        ) : null}
        {showSubtotalView ? (
          <ScrollView ref={orderListScrollRef} className="min-h-0 flex-1 px-2 py-1">
            {(() => {
              let start = 0;
              const result = [];
              for (let i = 0; i < subtotalBreaks.length; i++) {
                const end = subtotalBreaks[i];
                const group = items.slice(start, end);
                const groupTotal = group.reduce((s, it) => s + it.price * it.quantity, 0);
                group.forEach((item) => (
                  result.push(
                    <View key={item.id} className="mb-px">
                      <View className={ticketLineRow}>
                        <Text className={`${ticketText} font-medium flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                          {item.quantity}x {getItemLabel(item)}
                        </Text>
                        <Text className={`${ticketText} font-medium shrink-0`} numberOfLines={1}>
                          {formatSubtotalPrice(getItemBaseLinePrice(item))}
                        </Text>
                      </View>
                      {getItemNotes(item).map((note, noteIdx) => (
                        <View key={`${item.id}-note-${noteIdx}`} className={ticketNoteRow}>
                          <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                            {note.label}
                          </Text>
                          <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                            {formatSubtotalPrice(getItemNoteLinePrice(item, note))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                ));
                result.push(
                  <View key={`sub-${i}`} className="mb-1 border-b border-gray-800">
                    <View className={`flex flex-row w-full items-center justify-around relative`}>
                      <Text className={`${ticketText} font-bold shrink-0`} style={{ fontSize:'10px !important' }} numberOfLines={1}>
                        {t('subtotal')}:
                      </Text>
                      <Text className={`${ticketText} font-bold shrink-0`} numberOfLines={1}>
                        {formatSubtotalPrice(groupTotal)}
                      </Text>
                    </View>
                  </View>
                );
                start = end;
              }
              const remaining = items.slice(start);
              remaining.forEach((item) =>
                result.push(
                  <View key={item.id} className="mb-px">
                    <View className={ticketLineRow}>
                      <Text className={`${ticketText} font-medium flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                        {item.quantity}x {getItemLabel(item)}
                      </Text>
                      <Text className={`${ticketText} font-medium shrink-0`} numberOfLines={1}>
                        {formatSubtotalPrice(getItemBaseLinePrice(item))}
                      </Text>
                    </View>
                    {getItemNotes(item).map((note, noteIdx) => (
                      <View key={`${item.id}-note-rem-${noteIdx}`} className={ticketNoteRow}>
                        <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                          {note.label}
                        </Text>
                        <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                          {formatSubtotalPrice(getItemNoteLinePrice(item, note))}
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              );
              return result;
            })()}
          </ScrollView>
        ) : (
          <ScrollView ref={orderListScrollRef} className="min-h-0 flex-1 px-1.5 py-0.5">
            {savedOrdersForSelectedTable.map((savedOrder) => (
              <View key={`saved-order-${savedOrder.id}`}>
                {(savedOrder.items || []).map((item) => (
                  <View
                    key={`saved-${savedOrder.id}-${item.id}`}
                    className="mb-px rounded px-1 py-0.5"
                  >
                    <View className="w-full">
                      <View className={ticketLineRow}>
                        <Text className={`${ticketTextSemi} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                          {item.quantity}x {getItemLabel(item)}
                        </Text>
                        <Text className={`${ticketTextSemi} shrink-0`} numberOfLines={1}>
                          €{getItemBaseLinePrice(item).toFixed(2)}
                        </Text>
                      </View>
                      {getItemNotes(item).map((note, noteIdx) => (
                        <View key={`saved-${savedOrder.id}-${item.id}-notes-${noteIdx}`} className={ticketNoteRow}>
                          <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                            • {note.label}
                          </Text>
                          <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                            €{getItemNoteLinePrice(item, note).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
                <View className="px-1.5 pt-0.5">
                  {(() => {
                    const savedMeta = savedOrderMetaById.get(savedOrder.id);
                    const savedCashierName = savedMeta?.cashierName || cashierName;
                    const savedTime = formatSavedOrderTime(savedMeta?.savedAt, savedOrder?.createdAt);
                    return (
                      <View className="flex items-center justify-around py-0.5">
                        <Text className={`${ticketTextSemi} opacity-90`}>{savedCashierName}</Text>
                        <Text className={`${ticketTextSemi} opacity-90`}>{savedTime}</Text>
                      </View>
                    );
                  })()}
                  <View className="w-full h-px bg-pos-bg/40" />
                </View>
              </View>
            ))}
            {isSavedTableOrder ? null : (isViewedFromInWaiting && batchBoundaries.length > 0 ? (
              <>
                {batchBoundaries.map((endIdx, batchIdx) => {
                  const startIdx = batchIdx === 0 ? 0 : batchBoundaries[batchIdx - 1];
                  const batchItems = items.slice(startIdx, endIdx);
                  const metaEntry = batchMeta[batchIdx] || {};
                  const metaUserName = metaEntry.userName ?? order?.user?.name ?? cashierName;
                  const metaTime = metaEntry.createdAt ? formatOrderTimestamp(metaEntry.createdAt) : formatOrderTimestamp(order?.createdAt);
                  return (
                    <React.Fragment key={`batch-${batchIdx}`}>
                      {batchItems.map((item) => (
                        <Pressable
                          key={item.id}
                          className={`mb-px rounded-none px-1 py-0.5 active:bg-green-500 ${selectedItemIds.includes(item.id) ? 'bg-gray-300' : ''}`}
                          onPress={() => toggleItemSelection(item.id)}
                        >
                          <View className="w-full">
                            <View className={ticketLineRow}>
                              <Text className={`${ticketTextSemi} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                                {item.quantity}x {getItemLabel(item)}
                              </Text>
                              <Text className={`${ticketTextSemi} shrink-0`} numberOfLines={1}>
                                €{getItemBaseLinePrice(item).toFixed(2)}
                              </Text>
                            </View>
                            {getItemNotes(item).map((note, noteIdx) => (
                              <View key={`${item.id}-notes-${noteIdx}`} className={ticketNoteRow}>
                                <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                                  • {note.label}
                                </Text>
                                <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                                  €{getItemNoteLinePrice(item, note).toFixed(2)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      ))}
                      <View className="px-1.5 pt-0.5">
                        <View className="flex items-center justify-around py-0.5">
                          <Text className={`${ticketTextSemi} opacity-90`}>{metaUserName}</Text>
                          <Text className={`${ticketTextSemi} opacity-90`}>{metaTime}</Text>
                        </View>
                        <View className="w-full h-px bg-pos-bg/40" />
                      </View>
                    </React.Fragment>
                  );
                })}
                {items.slice(lastSavedBoundary).map((item) => (
                  <Pressable
                    key={item.id}
                    className={`mb-px rounded-none px-1 py-0.5 active:bg-green-500 ${selectedItemIds.includes(item.id) ? 'bg-gray-300' : ''}`}
                    onPress={() => toggleItemSelection(item.id)}
                  >
                    <View className="w-full">
                      <View className={ticketLineRow}>
                        <Text className={`${ticketTextSemi} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                          {item.quantity}x {getItemLabel(item)}
                        </Text>
                        <Text className={`${ticketTextSemi} shrink-0`} numberOfLines={1}>
                          €{getItemBaseLinePrice(item).toFixed(2)}
                        </Text>
                      </View>
                      {getItemNotes(item).map((note, noteIdx) => (
                        <View key={`${item.id}-notes-${noteIdx}`} className={ticketNoteRow}>
                          <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                            • {note.label}
                          </Text>
                          <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                            €{getItemNoteLinePrice(item, note).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    className={`mb-px rounded-none px-1 py-0.5 active:bg-green-500 ${selectedItemIds.includes(item.id) ? 'bg-gray-300' : ''}`}
                    onPress={() => toggleItemSelection(item.id)}
                  >
                    <View className="w-full">
                      <View className={ticketLineRow}>
                        <Text className={`${ticketTextSemi} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                          {item.quantity}x {getItemLabel(item)}
                        </Text>
                        <Text className={`${ticketTextSemi} shrink-0`} numberOfLines={1}>
                          €{getItemBaseLinePrice(item).toFixed(2)}
                        </Text>
                      </View>
                      {getItemNotes(item).map((note, noteIdx) => (
                        <View key={`${item.id}-notes-${noteIdx}`} className={ticketNoteRow}>
                          <Text className={`${ticketNote} flex-1 min-w-0 pr-2`} numberOfLines={1} ellipsizeMode="tail">
                            • {note.label}
                          </Text>
                          <Text className={`${ticketNote} shrink-0`} numberOfLines={1}>
                            €{getItemNoteLinePrice(item, note).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))}
              </>
            ))}
          </ScrollView>
        )}
      </View>
      <View className="w-full min-w-0 flex-row items-center gap-1 border-t border-black/10 px-1">
          <Pressable
            disabled={!hasSelection}
            className={`min-w-0 flex-1 py-1 items-center justify-center rounded border-none p-0 ${
              !hasSelection || isSavedTableOrder
                ? 'bg-black/10 opacity-50 cursor-not-allowed'
                : 'bg-black/10 active:bg-green-500'
            }`}
            onPress={() => {
              if (isSavedTableOrder) return;
              if (order && selectedItems.length > 0) {
                selectedItems.forEach((item) => {
                  onUpdateItemQuantity?.(order.id, item.id, item.quantity + 1);
                });
              }
            }}
          >
            <Text className="text-xl font-bold text-white">+</Text>
          </Pressable>
          <Pressable
            disabled={!canDecreaseAll || isSavedTableOrder}
            className={`min-w-0 flex-1 py-1 items-center justify-center rounded border-none p-0 ${
              !canDecreaseAll || isSavedTableOrder
                ? 'bg-black/10 opacity-50 cursor-not-allowed'
                : 'bg-black/10 active:bg-rose-500'
            }`}
            onPress={() => {
              if (isSavedTableOrder) return;
              if (order && canDecreaseAll) {
                selectedItems.forEach((item) => {
                  if (item.quantity > 1) {
                    onUpdateItemQuantity?.(order.id, item.id, item.quantity - 1);
                  }
                });
              }
            }}
          >
            <Text className="text-2xl font-bold text-white">{'\u2212'}</Text>
          </Pressable>
          <Pressable
            className={`min-w-0 flex-1 items-center justify-center rounded border-none py-1 ${
              !hasSelection || isSavedTableOrder
                ? 'bg-black/10 opacity-50 cursor-not-allowed'
                : 'bg-black/10 active:bg-green-500'
            }`}
            onPress={() => {
              if (isSavedTableOrder) return;
              if (order && selectedItemIds.length > 0) {
                selectedItemIds.forEach((id) => onRemoveItem(order.id, id));
                setSelectedItemIds([]);
              }
            }}
            disabled={!hasSelection || isSavedTableOrder}
            accessibilityLabel={t('remove')}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color="#ffffff" />
          </Pressable>
          <Pressable
            disabled={isSavedTableOrder}
            className={`min-w-0 flex-1 items-center justify-center rounded border-none py-1 ${
              isSavedTableOrder ? 'bg-black/10 opacity-50 cursor-not-allowed' : 'bg-black/10 active:bg-green-500'
            }`}
            onPress={() => setShowDeleteAllModal(true)}
            accessibilityLabel={t('clear')}
          >
            <MaterialCommunityIcons name="delete-sweep" size={20} color="#ffffff" />
          </Pressable>
        </View>

      <View className="flex w-full flex-row items-center gap-2 px-1 py-0.5">
        <Text className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-pos-text" numberOfLines={1} ellipsizeMode="tail">
          {`${t('total')}: €${payableTotal.toFixed(2)}`}
        </Text>
        <TextInput
          editable={false}
          className="w-[80px] max-h-[30px] shrink-0 rounded-md bg-white py-1 px-2 text-[10px] text-black"
          value={displayQuantity}
          accessibilityLabel={t('enterAmountKeypad')}
        />
      </View>

      {hasSelectedTable ? (
        showSettlementActions ? (
          <View className="flex gap-2 py-1 min-h-[59px]">
            <Pressable
              className="flex-1 py-3 px-2 bg-pos-surface border-none rounded-md text-pos-text active:bg-green-500"
              onPress={() => settlementOrder && onStatusChange?.(settlementOrder.id, 'in_planning')}
            >
              <Text className="text-pos-text text-center text-[10px]">{t('interimAccount')}</Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 px-2 bg-pos-surface border-none rounded-md text-pos-text active:bg-green-500"
              onPress={() => setShowFinalSettlementModal(true)}
            >
              <Text className="text-pos-text text-center text-[10px]">{t('finalSettlement')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex py-2">
            <Pressable
              className={`w-full py-3 px-2 border-none rounded-md text-md ${hasOrderItems
                ? 'bg-pos-surface text-pos-text active:bg-green-500'
                : 'bg-pos-surface text-gray-400 cursor-not-allowed opacity-70'
                }`}
              onPress={async () => {
                if (!hasOrderItems) return;
                const currentOrderId = order?.id;
                if (!currentOrderId) return;
                try {
                  await persistSavedTableOrders([
                    ...savedTableOrders,
                    { orderId: currentOrderId, cashierName, savedAt: new Date().toISOString() }
                  ]);
                } catch (err) {
                  setPaymentErrorMessage(err?.message || tr('orderPanel.failedSaveTableOrder', 'Failed to save table order.'));
                  return;
                }
                try {
                  const prodRes = await fetch('/api/printers/production', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: currentOrderId })
                  });
                  if (!prodRes.ok) {
                    const data = await prodRes.json().catch(() => ({}));
                    console.warn('Production print failed:', data?.error || prodRes.statusText);
                  }
                } catch (prodErr) {
                  console.warn('Production print error:', prodErr?.message);
                }
                setSelectedItemIds([]);
              }}
              disabled={!hasOrderItems}
            >
              <Text className="text-pos-text text-center text-md">{t('addToTable')}</Text>
            </Pressable>
          </View>
        )
      ) : (
        <View className="flex gap-1 py-1">
          {hasOrderItems && onOpenTables && hasSelectedTable ? (
            <Pressable
              className="w-full py-2 px-2 bg-pos-accent/20 border border-pos-accent/50 rounded-md text-pos-text active:bg-green-500 text-sm font-medium"
              onPress={onOpenTables}
            >
              <Text className="text-pos-text text-center text-sm font-medium">
                {tr('orderPanel.assignToTable', 'Assign to table')}
              </Text>
            </Pressable>
          ) : null}
          <View className="w-full min-w-0 flex-row flex-nowrap items-stretch gap-0.5">
          <Pressable
            disabled={!order?.id || !hasOrderItems || inWaitingButtonDisabled}
            className={`min-w-0 flex-1 items-center justify-center rounded-md border-none px-0.5 py-1.5 ${order?.id && hasOrderItems && !inWaitingButtonDisabled ? 'bg-pos-surface text-pos-text active:bg-green-500' : 'bg-pos-surface text-gray-400 cursor-not-allowed opacity-70'}`}
            onPress={async () => {
              if (!order?.id || !hasOrderItems || inWaitingButtonDisabled) return;
              if (isViewedFromInWaiting) {
                const existingName = order?.customer ? (order.customer.companyName || order.customer.name) : null;
                const newBoundaries = [...batchBoundaries, items.length];
                const newMeta = [
                  ...batchMeta,
                  { userId: currentUser?.id, userName: currentUser?.name || currentUser?.label || cashierName, createdAt: new Date().toISOString() }
                ];
                await onStatusChange?.(order.id, 'in_waiting', {
                  customerName: existingName || undefined,
                  userId: currentUser?.id,
                  itemBatchBoundaries: newBoundaries,
                  itemBatchMeta: newMeta
                });
                await onSaveInWaitingAndReset?.();
              } else {
                setShowInWaitingNameModal(true);
              }
            }}
          >
            <Text className={`text-center leading-tight ${compactBtnText}`} numberOfLines={2}>
              {tr('orderPanel.inWaiting', 'In waiting')}
            </Text>
          </Pressable>
          {showInPlanningButton ? (
            <Pressable
              disabled={!order?.id || !hasOrderItems || (!hasSelectedTable && !isViewedFromInWaiting)}
              className={`min-w-0 flex-1 items-center justify-center rounded-md border-none px-0.5 py-1.5 ${order?.id && hasOrderItems && (hasSelectedTable || isViewedFromInWaiting) ? 'bg-pos-surface text-pos-text active:bg-green-500' : 'bg-pos-surface text-gray-400 cursor-not-allowed opacity-70'}`}
              onPress={() => {
                if (!order?.id || !hasOrderItems) return;
                if (isViewedFromInWaiting) {
                  setShowPayNowOrLaterModal(true);
                } else {
                  onStatusChange(order.id, 'in_planning');
                }
              }}
            >
              <Text className={`text-center leading-tight ${compactBtnText}`} numberOfLines={2}>
                {t('inPlanning')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={payableTotalForPaymentModal <= 0.009 && !((isViewedFromInWaiting || isViewedFromInPlanning) && hasOrderItems) && !(hasOrderItems && order?.id)}
            className={`min-w-0 flex-1 items-center justify-center rounded-md border-none px-0.5 py-1.5 ${payableTotalForPaymentModal <= 0.009 && !((isViewedFromInWaiting || isViewedFromInPlanning) && hasOrderItems) && !(hasOrderItems && order?.id)
              ? 'bg-green-600/50 text-gray-400 cursor-not-allowed opacity-70'
              : 'bg-green-600 text-white active:bg-green-500'
              }`}
            onPress={() => openPayDifferentlyModal()}
          >
            <Text className={`text-center leading-tight ${compactBtnText} font-semibold text-white`} numberOfLines={2}>
              {t('payDifferently')}
            </Text>
          </Pressable>
          <Pressable
            className="shrink-0 items-center justify-center rounded-md border-none bg-[#f0961c]/90 px-3 py-2 active:bg-[#c6a97f]"
          >
            <Text className={`text-center ${compactBtnText} font-semibold text-pos-bg`}>€</Text>
          </Pressable>
          </View>
        </View>
      )}

      <Modal visible={showPayDifferentlyModal} transparent animationType="fade" onRequestClose={handleCancelPayDifferentlyModal}>
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="flex flex-col bg-gray-100 rounded-xl shadow-2xl max-w-[1800px] w-full overflow-auto text-gray-800"
          >
            {/* Left: Total + payment methods */}
            <View className="flex items-center justify-center">
              <View className="p-6 min-w-[56%] w-full h-full flex flex-col">
                <Text className="text-lg font-semibold mb-3 w-full text-center text-gray-800">
                  {t('total')}: €{payModalTargetTotal.toFixed(2)}
                </Text>
                <View className="mb-4 h-full w-full flex flex-row flex-wrap items-start justify-center gap-4">
                  {paymentMethodsLoading ? (
                    <View className="w-full py-6 text-center text-sm text-gray-600">
                      {tr('orderPanel.loadingPaymentMethods', 'Loading payment methods...')}
                    </View>
                  ) : activePaymentMethods.length === 0 ? (
                    <View className="w-full max-w-lg px-4 py-6 text-center text-sm text-amber-900">
                      {tr(
                        'orderPanel.noPaymentMethods',
                        'No active payment methods. Configure them under Control â†’ Payment types.',
                      )}
                    </View>
                  ) : (
                    activePaymentMethods.map((m) => {
                      const amt = Number(paymentAmounts[m.id]) || 0;
                      const isHighlighted = selectedPayment === m.id || amt > 0;
                      const integ = m.integration || 'generic';
                      return (
                        <View key={m.id} className="mb-1 flex flex-col items-center gap-1.5" style={{ width: '23%' }}>
                          <Pressable
                            disabled={payModalSplitComplete || payModalWouldExceedTotal}
                            onPress={() => handlePaymentMethodClick(m)}
                            className={`rounded-lg border-2 p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isHighlighted ? 'bg-green-500 border-green-700' : 'bg-white border-gray-300'
                              }`}
                            accessibilityLabel={m.name}
                          >
                            {integ === 'manual_cash' ? (
                              <Text className="flex items-center justify-center w-[105px] h-[70px] text-4xl font-bold text-amber-600 bg-amber-50/80 rounded">€</Text>
                            ) : integ === 'cashmatic' ? (
                              <ExpoImage source={{ uri: '/cash.png' }} style={{ width: 105, height: 70 }} contentFit="contain" />
                            ) : integ === 'payworld' ? (
                              <ExpoImage source={{ uri: '/payworld.png' }} style={{ width: 105, height: 70 }} contentFit="contain" />
                            ) : integ === 'generic' ? (
                              <ExpoImage source={{ uri: '/card.svg' }} style={{ width: 105, height: 70 }} contentFit="contain" />
                            ) : (
                              <Text className="flex items-center justify-center w-[105px] min-h-[70px] px-2 py-3 text-base font-semibold text-center text-blue-900 bg-blue-50/80 rounded leading-tight">
                                {m.name}
                              </Text>
                            )}
                          </Pressable>
                          <View className="text-sm font-semibold tabular-nums text-center max-w-[140px]" >
                            <Text className="block text-xs font-normal text-gray-600 mb-0.5 truncate">{m.name}</Text>
                            <Text>{formatPaymentAmount(amt)}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
              {/* Right: Assigned + input + keypad */}
              <View className="min-w-[26%] p-6">
                <Text className="mb-2 text-center text-lg font-semibold">{`${t('assigned')}: €${payModalTotalAssigned.toFixed(2)}`}</Text>
                <View className="flex justify-center mt-2">
                  <TextInput
                    editable={false}
                    className="w-[160px] py-2 px-3 bg-gray-200 rounded-lg text-base mb-3 text-gray-800"
                    value={payModalKeypadInput}
                    accessibilityLabel={t('amountKeypad')}
                  />
                </View>
                <View className="flex gap-2 flex-1 min-h-0 mt-3">
                  <View className="flex flex-col gap-1.5 flex-1">
                    {KEYPAD.map((row, ri) => (
                      <View key={ri} className="flex flex-row gap-1.5">
                        {row.map((key) => (
                          <Pressable
                            key={key}
                            disabled={payModalSplitComplete}
                            className={`min-w-0 flex-1 rounded-lg py-4 text-lg font-medium ${payModalSplitComplete ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-800 active:bg-green-500'}`}
                            onPress={() => handlePayModalKeypad(key)}
                          >
                            <Text className="text-center text-lg font-medium text-gray-800">{key}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <View className="min-w-[18%] flex flex-col items-center justify-center gap-4 p-6">
                <Pressable
                  disabled={payModalSplitComplete}
                  className={`py-2 px-4 w-full max-w-[200px] rounded-lg text-sm font-medium ${payModalSplitComplete ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-800 active:bg-green-500'}`}
                  onPress={handlePayHalfAmount}
                >
                  <Text className="text-center text-sm font-medium text-gray-800">{t('halfAmount')}</Text>
                </Pressable>
                <Pressable
                  disabled={payModalSplitComplete}
                  className={`py-2 px-4 w-full max-w-[200px] rounded-lg text-sm font-medium ${payModalSplitComplete ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-800 active:bg-green-500'}`}
                  onPress={handlePayRemaining}
                >
                  <Text className="text-center text-sm font-medium text-gray-800">{t('remainingAmount')}</Text>
                </Pressable>
                <Pressable
                  className="py-2 px-4 bg-gray-300 w-full max-w-[200px] rounded-lg text-gray-800 text-sm font-medium active:bg-green-500"
                  onPress={handlePayReset}
                >
                  <Text className="text-center text-sm font-medium text-gray-800">{t('reset')}</Text>
                </Pressable>
              </View>
            </View>
            <View className="flex justify-around px-6 gap-4 w-full pt-6 pb-6">
              <Pressable
                className="w-[140px] py-2 px-4 rounded-lg text-sm font-medium bg-gray-300 text-gray-800 active:bg-green-500"
                onPress={handleCancelPayDifferentlyModal}
              >
                <Text className="text-center text-sm font-medium text-gray-800">{t('cancel')}</Text>
              </Pressable>
              <Pressable
                disabled={
                  Math.abs(payModalTotalAssigned - payModalTargetTotal) > 0.009 ||
                  payConfirmLoading ||
                  paymentMethodsLoading ||
                  activePaymentMethods.length === 0
                }
                className={`w-[140px] py-2 px-4 rounded-lg text-sm font-medium ${Math.abs(payModalTotalAssigned - payModalTargetTotal) > 0.009 || payConfirmLoading || paymentMethodsLoading || activePaymentMethods.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-800 active:bg-green-500'
                  }`}
                onPress={handleConfirmPayment}
              >
                <Text className="text-center text-sm font-medium text-gray-800">
                  {payConfirmLoading ? t('processing') : t('toConfirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPayworldStatusModal} transparent animationType="fade" onRequestClose={() => setShowPayworldStatusModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 p-4">
          <View className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-2xl w-full mx-4 border border-pos-border">
            <Text id="payworld-status-title" className="text-3xl mb-6 font-semibold text-pos-text text-center">
              {tr('orderPanel.payworldModalTitle', 'Payworld / PAX A35 Payment')}
            </Text>
            <View className="space-y-4 text-pos-text">
              <View className="flex justify-between items-center text-2xl">
                <Text>{tr('orderPanel.payworldAmount', 'Amount')}:</Text>
                <Text className="font-semibold">€ {payModalTargetTotal.toFixed(2)}</Text>
              </View>
              <View className="flex justify-between items-center text-2xl">
                <Text>{tr('orderPanel.payworldStatusLabel', 'Status')}:</Text>
                <Text className="font-semibold">{payworldStatusTitle}</Text>
              </View>
              {payworldStatus.message ? (
                <View className="rounded-md bg-pos-surface px-4 py-3">
                  <Text className="text-xl text-pos-text">{payworldStatus.message}</Text>
                </View>
              ) : null}
            </View>
            <View className="mt-8 flex justify-center gap-4">
              {String(payworldStatus.state || '').toUpperCase() === 'IN_PROGRESS' ? (
                <Pressable
                  className="min-w-[220px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                  onPress={handleAbortPayworld}
                >
                  <Text className="text-pos-text text-center text-2xl">{tr('orderPanel.cancelPayworld', 'Cancel Payment')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  className="min-w-[220px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                  onPress={() => setShowPayworldStatusModal(false)}
                >
                  <Text className="text-pos-text text-center text-2xl">{tr('orderPanel.closePayworldModal', 'Close')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinalSettlementModal} transparent animationType="fade" onRequestClose={() => setShowFinalSettlementModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="bg-gray-100 rounded-xl shadow-2xl max-w-3xl w-full px-8 py-10"
          >
            <Text id="final-settlement-options-title" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
              {t('finalSettlementOptions')}
            </Text>
            <View className="flex flex-row items-start gap-10">
              <Pressable
                className="min-w-0 flex-1 h-14 rounded border-none bg-gray-200 text-xl font-semibold text-gray-700 active:bg-green-500"
                onPress={() => {
                  setShowFinalSettlementModal(false);
                  openPayDifferentlyModal();
                }}
              >
                <Text className="text-center text-xl font-semibold text-gray-700">{t('finalPayment')}</Text>
              </Pressable>
              <View className="min-w-0 flex-1 flex flex-col gap-6">
                <Pressable
                  className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                  onPress={() => {
                    setShowFinalSettlementModal(false);
                    setShowSettlementSubtotalModal(true);
                    setSettlementModalType('subtotal');
                    setSubtotalLineGroups([]);
                    setSubtotalSelectedLeftIds([]);
                    setSubtotalSelectedRightIds([]);
                  }}
                >
                  <Text className="text-gray-700 text-center text-xl font-semibold">{t('subtotal')}</Text>
                </Pressable>
                <Pressable
                  className="h-14 bg-gray-200 border-none rounded text-xl font-semibold text-gray-700 active:bg-green-500"
                  onPress={() => setShowFinalSettlementModal(false)}
                >
                  <Text className="text-gray-700 text-center text-xl font-semibold">{t('cancel')}</Text>
                </Pressable>
              </View>
              <Pressable
                className="min-w-0 flex-1 h-14 rounded border-none bg-gray-200 text-xl font-semibold text-gray-700 active:bg-green-500"
                onPress={() => {
                  setShowFinalSettlementModal(false);
                  setShowSettlementSubtotalModal(true);
                  setSettlementModalType('splitBill');
                  setSubtotalLineGroups([]);
                  setSubtotalSelectedLeftIds([]);
                  setSubtotalSelectedRightIds([]);
                }}
              >
                <Text className="text-center text-xl font-semibold text-gray-700">{t('splitBill')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettlementSubtotalModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSettlementSubtotalModal(false);
          setSettlementModalType('subtotal');
          setSubtotalLineGroups([]);
          setSubtotalSelectedLeftIds([]);
          setSubtotalSelectedRightIds([]);
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="bg-pos-panel rounded-xl shadow-2xl w-full max-w-[1400px] h-[86vh] p-4 border border-pos-border flex flex-col"
          >
            <View id="settlement-subtotal-title" className="flex items-center justify-between text-xl font-semibold text-pos-text px-2 pb-1 border-b border-pos-border">
              <Text>{selectedTable?.name || t('table')}</Text>
              <Text>€ {payableTotal.toFixed(2)}</Text>
            </View>

            <View className="flex-1 min-h-0 flex gap-5">
              <View className="flex flex-col h-full w-full">
                <View className="flex-1 border border-pos-border overflow-auto bg-pos-bg">
                  {settlementSubtotalLeftLines.map((line) => (
                    <Pressable
                      key={line.id}
                      className={`w-full text-left px-4 py-2 border-b border-pos-border/40 text-sm text-pos-text flex items-center justify-between ${subtotalSelectedLeftIds.includes(line.id) ? 'bg-pos-surface-hover' : 'active:bg-green-500'
                        }`}
                      onPress={() => {
                        setSubtotalSelectedLeftIds((prev) =>
                          prev.includes(line.id) ? prev.filter((id) => id !== line.id) : [...prev, line.id]
                        );
                        setSubtotalSelectedRightIds([]);
                      }}
                    >
                      <Text>- {line.label}</Text>
                      <Text>€ {line.amount.toFixed(2)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="pt-4 flex items-center justify-center border-t border-pos-border/50">
                  <Pressable
                    disabled={settlementSubtotalLeftLines.length === 0}
                    className={`min-w-[100px] py-1 px-6 rounded text-pos-text text-md ${settlementSubtotalLeftLines.length === 0
                      ? 'bg-pos-surface opacity-50 cursor-not-allowed'
                      : 'bg-pos-surface active:bg-green-500'
                      }`}
                    onPress={() => {
                      setSubtotalSelectedLeftIds(settlementSubtotalLeftLines.map((line) => line.id));
                      setSubtotalSelectedRightIds([]);
                    }}
                  >
                    <Text className="text-pos-text text-center text-md">{t('all')}</Text>
                  </Pressable>
                </View>
              </View>

              <View className="w-16 flex flex-col items-center justify-between py-16 text-pos-text mb-20">
                <Pressable
                  className="text-6xl leading-none active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-500"
                  disabled={subtotalSelectedLeftIds.length === 0}
                  onPress={() => {
                    if (subtotalSelectedLeftIds.length === 0) return;
                    const idsToMove = subtotalSelectedLeftIds.filter((id) =>
                      settlementSubtotalLeftLines.some((line) => line.id === id)
                    );
                    if (idsToMove.length === 0) return;
                    setSubtotalLineGroups((prev) => [
                      ...prev,
                      { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, lineIds: idsToMove }
                    ]);
                    setSubtotalSelectedLeftIds([]);
                    setSubtotalSelectedRightIds([]);
                  }}
                >
                  <Text className="text-6xl text-pos-text">→</Text>
                </Pressable>
                <Pressable
                  className="text-6xl leading-none active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-500"
                  disabled={subtotalSelectedRightIds.length === 0}
                  onPress={() => {
                    if (subtotalSelectedRightIds.length === 0) return;
                    setSubtotalLineGroups((prev) =>
                      prev
                        .map((group) => ({
                          ...group,
                          lineIds: (group?.lineIds || []).filter((id) => !subtotalSelectedRightIds.includes(id))
                        }))
                        .filter((group) => (group?.lineIds || []).length > 0)
                    );
                    setSubtotalSelectedRightIds([]);
                    setSubtotalSelectedLeftIds([]);
                  }}
                >
                  <Text className="text-6xl text-pos-text">←</Text>
                </Pressable>
              </View>

              <View className="flex flex-col h-full w-full">
                <View className="flex-1 border border-pos-border bg-pos-bg flex flex-col">
                  <ScrollView ref={splitRightPanelScrollRef} className="flex-1" onScroll={(e) => { splitPanelScrollYRef.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
                    {settlementSubtotalRightGroups.map((group) => (
                      <View
                        key={group.id}
                        className={`px-4 py-2 border-b ${group.lines.length > 0 && group.lines.every((line) => subtotalSelectedRightIds.includes(line.id))
                          ? 'border-2 border-rose-500 rounded-md'
                          : ''
                          }`}
                      >
                        <Text className="text-center text-lg font-semibold text-pos-text">
                          {group.label}
                        </Text>
                        {group.lines.map((line) => (
                          <Pressable
                            key={line.id}
                            className={`w-full text-left px-2 py-1 text-sm text-pos-text flex items-center justify-between ${subtotalSelectedRightIds.includes(line.id) ? 'bg-pos-surface-hover' : 'active:bg-green-500'
                              }`}
                            onPress={() => {
                              setSubtotalSelectedRightIds((prev) =>
                                prev.includes(line.id) ? prev.filter((id) => id !== line.id) : [...prev, line.id]
                              );
                              setSubtotalSelectedLeftIds([]);
                            }}
                          >
                            <Text>- {line.label}</Text>
                            <Text>€ {line.amount.toFixed(2)}</Text>
                          </Pressable>
                        ))}
                        <Text className="text-center text-md font-semibold text-pos-text">
                          € {group.total.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View className="py-1 flex items-center justify-around gap-5">
                    <Pressable
                      className="w-10 h-10 rounded bg-pos-surface text-pos-text text-xl leading-none active:bg-green-500"
                      onPress={() => scrollSplitRightPanel(-1)}
                      accessibilityLabel={t('scrollUp')}
                    >
                      <Text className="text-pos-text text-xl">↑</Text>
                    </Pressable>
                    <Pressable
                      className="min-w-[100px] py-2 px-6 rounded bg-pos-surface text-pos-text text-md active:bg-green-500"
                      onPress={() => {
                        setSubtotalLineGroups([]);
                        setSubtotalSelectedLeftIds([]);
                        setSubtotalSelectedRightIds([]);
                      }}
                    >
                      <Text className="text-pos-text text-center text-md">{t('again')}</Text>
                    </Pressable>
                    <Pressable
                      className="w-10 h-10 rounded bg-pos-surface text-pos-text text-xl leading-none active:bg-green-500"
                      onPress={() => scrollSplitRightPanel(1)}
                      accessibilityLabel={t('scrollDown')}
                    >
                      <Text className="text-pos-text text-xl">↓</Text>
                    </Pressable>
                  </View>
                </View>
                <View className="pt-4 flex items-center justify-center gap-12">
                  <Pressable
                    className="min-w-[100px] py-1 px-6 rounded bg-pos-surface text-pos-text text-md active:bg-green-500"
                    onPress={() => {
                      setShowSettlementSubtotalModal(false);
                      setSettlementModalType('subtotal');
                      setSubtotalLineGroups([]);
                      setSubtotalSelectedLeftIds([]);
                      setSubtotalSelectedRightIds([]);
                    }}
                  >
                    <Text className="text-pos-text text-center text-md">{t('cancel')}</Text>
                  </Pressable>
                  {settlementModalType === 'splitBill' ? (
                    <>
                      <Pressable
                        disabled={!hasSplitBillSelection}
                        className={`min-w-[150px] py-1 px-6 rounded text-md ${!hasSplitBillSelection
                          ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                          : 'bg-pos-surface text-pos-text active:bg-green-500'
                          }`}
                        onPress={() => {
                          if (!hasSplitBillSelection) return;
                          setShowSettlementSubtotalModal(false);
                          setPendingSplitCheckout({
                            type: 'splitBill',
                            action: 'return',
                            lineIds: splitSelectedLineIds
                          });
                          openPayDifferentlyModal(splitSelectedTotal);
                        }}
                      >
                        <Text className="text-pos-text text-center text-md">{t('checkoutAndReturn')}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!hasSplitBillSelection}
                        className={`min-w-[170px] py-1 px-6 rounded text-md ${!hasSplitBillSelection
                          ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                          : 'bg-pos-surface text-pos-text active:bg-green-500'
                          }`}
                        onPress={() => {
                          if (!hasSplitBillSelection) return;
                          setShowSettlementSubtotalModal(false);
                          setPendingSplitCheckout({
                            type: 'splitBill',
                            action: 'continue',
                            lineIds: splitSelectedLineIds
                          });
                          openPayDifferentlyModal(splitSelectedTotal);
                        }}
                      >
                        <Text className="text-pos-text text-center text-md">{t('checkoutAndContinueSplit')}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      disabled={settlementSubtotalLeftLines.length > 0}
                      className={`min-w-[100px] py-1 px-6 rounded text-md ${settlementSubtotalLeftLines.length > 0
                        ? 'bg-pos-surface text-pos-text opacity-50 cursor-not-allowed'
                        : 'bg-pos-surface text-pos-text active:bg-green-500'
                        }`}
                      onPress={() => {
                        if (settlementSubtotalLeftLines.length > 0) return;
                        setShowSettlementSubtotalModal(false);
                        setPendingSplitCheckout(null);
                        openPayDifferentlyModal();
                      }}
                    >
                      <Text className="text-pos-text text-center text-md">{t('checkout')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

          </View>
        </View>
      </Modal>

      <Modal visible={!!paymentSuccessMessage} transparent animationType="fade" onRequestClose={() => setPaymentSuccessMessage('')}>
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-3xl w-full mx-4 border border-pos-border"
          >
            <Text id="payment-success-title" className="text-3xl mb-6 font-semibold text-pos-text text-center">
              {t('paymentSuccessfulTitle')}
            </Text>
            <Text className="text-2xl text-pos-text text-center mb-8">{paymentSuccessMessage}</Text>
            <View className="flex justify-center">
              <Pressable
                className="w-[200px] py-4 bg-green-600 text-white rounded text-2xl active:bg-green-500"
                onPress={() => setPaymentSuccessMessage('')}
              >
                <Text className="text-white text-center text-2xl">{t('ok')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPayNowOrLaterModal} transparent animationType="fade" onRequestClose={() => setShowPayNowOrLaterModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View
            className="bg-pos-panel rounded-lg shadow-xl px-16 py-8 max-w-2xl w-full mx-4 border border-pos-border"
          >
            <Text id="pay-now-or-later-title" className="text-2xl mb-10 font-semibold flex justify-center w-full text-pos-text">
              {t('payNowOrLater')}
            </Text>
            <View className="flex gap-4 justify-center">
              <Pressable
                className="flex-1 py-3 px-10 bg-pos-surface text-pos-text rounded text-xl active:bg-green-500"
                onPress={() => {
                  setShowPayNowOrLaterModal(false);
                  setInPlanningCalendarAction('payNow');
                  setShowInPlanningDateTimeModal(true);
                }}
              >
                <Text className="text-pos-text text-center text-xl">{t('yes')}</Text>
              </Pressable>
              <Pressable
                className="flex-1 py-3 px-10 bg-pos-surface text-pos-text rounded text-xl active:bg-green-500"
                onPress={() => {
                  setShowPayNowOrLaterModal(false);
                  setInPlanningCalendarAction('inPlanning');
                  setShowInPlanningDateTimeModal(true);
                }}
              >
                <Text className="text-pos-text text-center text-xl">{t('no')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <InPlanningDateTimeModal
        open={showInPlanningDateTimeModal}
        onClose={() => {
          setShowInPlanningDateTimeModal(false);
          setInPlanningCalendarAction(null);
        }}
        onSave={(scheduledDate) => {
          setShowInPlanningDateTimeModal(false);
          if (inPlanningCalendarAction === 'payNow') {
            payNowFromInWaitingRef.current = true; // After payment+print success â†’ in_planning
            setInPlanningCalendarAction(null);
            openPayDifferentlyModal();
          } else if (inPlanningCalendarAction === 'inPlanning') {
            setInPlanningCalendarAction(null);
            order?.id && onStatusChange?.(order.id, 'in_planning');
            onOpenInPlanning?.();
          }
        }}
      />

      <InWaitingNameModal
        open={showInWaitingNameModal}
        onClose={() => setShowInWaitingNameModal(false)}
        onConfirm={async (name) => {
          if (order?.id) {
            const itemCount = order?.items?.length ?? 0;
            await onStatusChange?.(order.id, 'in_waiting', {
              customerName: name || undefined,
              userId: currentUser?.id,
              itemBatchBoundaries: itemCount > 0 ? [itemCount] : undefined,
              itemBatchMeta: itemCount > 0 ? [{ userId: currentUser?.id, userName: currentUser?.name || currentUser?.label || cashierName, createdAt: new Date().toISOString() }] : undefined
            });
            await onSaveInWaitingAndReset?.();
          }
        }}
      />

      <Modal visible={showDeleteAllModal} transparent animationType="fade" onRequestClose={() => setShowDeleteAllModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="bg-pos-panel rounded-lg shadow-xl px-16 py-8 max-w-2xl w-full mx-4 border border-pos-border"
          >
            <Text className="text-xl mb-10 font-semibold text-center w-full text-pos-text">
                {t('clearListConfirm')}
            </Text>
            <View className="w-full flex-row flex-nowrap items-stretch gap-[100px]">
              <Pressable
                className="min-w-0 flex-1 items-center justify-center rounded bg-pos-surface py-2 px-3 active:bg-green-500"
                onPress={() => setShowDeleteAllModal(false)}
              >
                <Text className="text-center text-md text-pos-text">{t('cancel')}</Text>
              </Pressable>
              <Pressable
                className="min-w-0 flex-1 items-center justify-center rounded bg-pos-danger py-2 px-3 active:bg-rose-500"
                onPress={async () => {
                  if (isSavedTableOrder) {
                    setShowDeleteAllModal(false);
                    return;
                  }
                  if (hasSelectedTable && order?.id) {
                    const currentItemIds = (order.items || []).map((it) => it.id).filter(Boolean);
                    for (const itemId of currentItemIds) {
                      await onRemoveItem?.(order.id, itemId);
                    }
                    setShowDeleteAllModal(false);
                    setSelectedItemIds([]);
                    return;
                  }
                  await onRemoveAllOrders?.();
                  setShowDeleteAllModal(false);
                  setSelectedItemIds([]);
                }}
              >
                <Text className="text-white text-center text-md">{t('ok')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!paymentErrorMessage} transparent animationType="fade" onRequestClose={() => setPaymentErrorMessage('')}>
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View
            className="bg-pos-panel rounded-lg shadow-xl px-10 py-8 max-w-3xl w-full mx-4 border border-pos-border"
          >
            <Text id="payment-error-title" className="text-3xl mb-6 font-semibold text-pos-text text-center">
              {t('paymentErrorTitle')}
            </Text>
            <Text className="text-2xl text-pos-text text-center mb-8">{paymentErrorMessage}</Text>
            <View className="flex justify-center">
              <Pressable
                className="w-[200px] py-4 bg-pos-surface text-pos-text rounded text-2xl active:bg-green-500"
                onPress={() => setPaymentErrorMessage('')}
              >
                <Text className="text-pos-text text-center text-2xl">{t('ok')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View className="min-h-[25%] max-h-[25%] shrink-0 flex flex-col gap-1">
        {KEYPAD.map((row, ri) => (
          <View key={ri} className="flex flex-row gap-1">
            {row.map((key) => (
              <Pressable
                key={key}
                className="min-w-0 flex-1 rounded-md border-none bg-pos-panel py-1.5 text-[10px] text-pos-text active:bg-green-500"
                onPress={() => handleKeypad(key)}
              >
                <Text className="text-pos-text text-center text-[10px]">{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

