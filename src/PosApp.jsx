import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { io } from 'socket.io-client';
import { useLanguage } from './contexts/LanguageContext';
import { useApi } from './contexts/ApiContext';
import { usePos } from './hooks/usePos';
import { LeftSidebar } from './components/LeftSidebar';
import { Header } from './components/Header';
import { ProductArea } from './components/ProductArea';
import { Footer } from './components/Footer';
import { OrderPanel } from './components/OrderPanel';
import { TablesView } from './components/TablesView';
import { LoginScreen } from './components/LoginScreen';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  WebordersModalRN,
  InPlanningModalRN,
  InWaitingModalRN,
  HistoryModalRN,
  CustomersModalRN
} from './components/OrderModals';

const API = '/api';
const USER_STORAGE_KEY = 'pos-user';
const VIEW_STORAGE_KEY = 'pos-view';
const VALID_VIEWS = ['pos', 'tables'];

const posLayout = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#2c3e50' },
  sidebarCol: { minWidth: '16%', maxWidth: 280, flexShrink: 0 },
  mainCol: { flex: 1, minWidth: 220, minHeight: 0, flexDirection: 'column' },
  orderCol: {
    minWidth: '25%',
    maxWidth: '25%',
    flexShrink: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#34495e',
  },
});

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.id && (u.label ?? u.name) ? u : null;
  } catch {
    return null;
  }
}

function loadStoredView() {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return VALID_VIEWS.includes(v) ? v : 'pos';
  } catch {
    return 'pos';
  }
}

/** HH:mm in 24h — device local time. Hermes on Android rejects some IANA zones (e.g. Europe/Kyiv). */
function formatPosClock(date = new Date()) {
  try {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    const h = date.getHours();
    const m = date.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

export default function PosApp() {
  const { t } = useLanguage();
  const { socketOrigin } = useApi();
  const [user, setUser] = useState(loadStoredUser);
  const [view, setView] = useState(loadStoredView);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTableLabel, setSelectedTableLabel] = useState(null);
  const [selectedRoomName, setSelectedRoomName] = useState(null);
  const [roomCount, setRoomCount] = useState(null);
  const [isOpeningTables, setIsOpeningTables] = useState(false);

  const socket = useMemo(() => {
    if (!socketOrigin) return null;
    try {
      return io(socketOrigin, { path: '/socket.io', transports: ['websocket', 'polling'] });
    } catch {
      return null;
    }
  }, [socketOrigin]);

  useEffect(() => {
    return () => {
      socket?.disconnect?.();
    };
  }, [socket]);

  const [time, setTime] = useState(() => formatPosClock());
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalTab, setOrdersModalTab] = useState('new');
  const [showInPlanningModal, setShowInPlanningModal] = useState(false);
  const [showInWaitingModal, setShowInWaitingModal] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const [focusedOrderInitialItemCount, setFocusedOrderInitialItemCount] = useState(0);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showSubtotalView, setShowSubtotalView] = useState(false);
  const [subtotalBreaks, setSubtotalBreaks] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [quantityInput, setQuantityInput] = useState('');
  const [showInWaitingButton, setShowInWaitingButton] = useState(false);

  const setViewAndPersist = useCallback((nextView) => {
    setView(nextView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch {
      /* ignore */
    }
  }, []);

  const {
    categories,
    products,
    selectedCategoryId,
    setSelectedCategoryId,
    currentOrder,
    orders,
    webordersCount,
    fetchInWaitingCount,
    tables,
    addItemToOrder,
    removeOrderItem,
    updateOrderItemQuantity,
    setOrderStatus,
    createOrder,
    markOrderPrinted,
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
    appendSubproductNoteToItem,
    setOrderTable
  } = usePos(API, socket, selectedTable?.id ?? null, focusedOrderId);

  const fetchRoomCount = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rooms`);
      const data = await res.json().catch(() => []);
      setRoomCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setRoomCount(null);
    }
  }, []);

  const inPlanningCountDisplay = (orders || []).filter((o) => o?.status === 'in_planning').length;
  const inWaitingCountDisplay = (orders || []).filter((o) => o?.status === 'in_waiting').length;

  useEffect(() => {
    const id = setInterval(() => setTime(formatPosClock()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshDeviceSettings = useCallback(() => {
    try {
      const raw = localStorage.getItem('pos_device_settings');
      const saved = raw ? JSON.parse(raw) : {};
      const allFour =
        !!saved.ordersConfirmOnHold &&
        !!saved.ordersCustomerCanBeModified &&
        !!saved.ordersBookTableToWaiting &&
        !!saved.ordersFastCustomerName;
      setShowInWaitingButton(!!allFour);
    } catch {
      setShowInWaitingButton(false);
    }
  }, []);

  useEffect(() => {
    refreshDeviceSettings();
    (async () => {
      try {
        const res = await fetch(`${API}/settings/device-settings`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const saved = data?.value;
          if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
            localStorage.setItem('pos_device_settings', JSON.stringify(saved));
            refreshDeviceSettings();
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [refreshDeviceSettings]);

  useEffect(() => {
    fetchCategories();
    fetchOrders();
    fetchWebordersCount();
    fetchInPlanningCount();
    fetchInWaitingCount();
    fetchTables();
    fetchSavedPositioningLayout();
    fetchSavedPositioningColors();
    fetchSavedFunctionButtonsLayout();
    fetchRoomCount();
  }, [
    fetchCategories,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    fetchInWaitingCount,
    fetchTables,
    fetchSavedPositioningLayout,
    fetchSavedPositioningColors,
    fetchSavedFunctionButtonsLayout,
    fetchRoomCount
  ]);

  useEffect(() => {
    if (selectedCategoryId) fetchProducts(selectedCategoryId);
  }, [selectedCategoryId, fetchProducts]);

  useEffect(() => {
    if (view === 'pos') {
      fetchSavedPositioningLayout();
      fetchSavedPositioningColors();
      fetchSavedFunctionButtonsLayout();
      fetchRoomCount();
      refreshDeviceSettings();
    }
  }, [view, fetchSavedPositioningLayout, fetchSavedPositioningColors, fetchSavedFunctionButtonsLayout, fetchRoomCount, refreshDeviceSettings]);

  useEffect(() => {
    setSubtotalBreaks([]);
  }, [currentOrder?.id]);

  const itemCount = currentOrder?.items?.length ?? 0;
  const lastBreak = subtotalBreaks[subtotalBreaks.length - 1] ?? 0;
  const hasNewItemsSinceLastSubtotal = itemCount > lastBreak;
  const subtotalButtonDisabled = itemCount === 0 || !hasNewItemsSinceLastSubtotal;

  const handleSubtotalClick = () => {
    if (subtotalButtonDisabled) return;
    const n = currentOrder?.items?.length ?? 0;
    setSubtotalBreaks((prev) => [...prev, n]);
    setShowSubtotalView(true);
  };

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setViewAndPersist('pos');
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleSelectTable = useCallback(
    async (table, options) => {
      const orderWithItemsNoTable = currentOrder?.items?.length > 0 && !currentOrder?.tableId;
      if (table != null && orderWithItemsNoTable && currentOrder?.id) {
        await setOrderTable(currentOrder.id, table.id);
      }
      setFocusedOrderId(null);
      setFocusedOrderInitialItemCount(0);
      setSelectedTable(table);
      if (table == null) {
        setSelectedTableLabel(null);
        setSelectedRoomName(null);
      } else {
        setSelectedTableLabel(options?.tableLabel ?? null);
        setSelectedRoomName(options?.roomName ?? (table?.name ?? null));
      }
      setViewAndPersist('pos');
    },
    [setViewAndPersist, currentOrder, setOrderTable]
  );

  const handleAddProductWithSelectedTable = useCallback(
    async (product) => {
      const qty = Math.max(1, parseInt(quantityInput, 10) || 1);
      setQuantityInput('');
      return addItemToOrder(product, qty, selectedTable?.id || null);
    },
    [addItemToOrder, selectedTable?.id, quantityInput]
  );

  const handleOpenTables = useCallback(async () => {
    setViewAndPersist('tables');
    setIsOpeningTables(true);
    try {
      await Promise.all([fetchTables(), fetchTableLayouts(), fetchRoomCount()]);
    } finally {
      setIsOpeningTables(false);
    }
  }, [setViewAndPersist, fetchTables, fetchTableLayouts, fetchRoomCount]);

  if (!user) {
    return <LoginScreen time={time} onLogin={handleLogin} />;
  }

  if (view === 'tables') {
    if (isOpeningTables) {
      return <LoadingSpinner label={t('loadingTables')} />;
    }
    return (
      <TablesView
        tables={tables}
        tableLayouts={tableLayouts}
        fetchTableLayouts={fetchTableLayouts}
        selectedTableId={selectedTable?.id ?? null}
        onSelectTable={handleSelectTable}
        onBack={() => setViewAndPersist('pos')}
        time={time}
        api={API}
      />
    );
  }

  return (
    <View style={posLayout.root}>
      <View style={posLayout.sidebarCol}>
        <LeftSidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          currentUser={user}
          onControlClick={undefined}
          onLogout={handleLogout}
          time={time}
        />
      </View>
      <View style={posLayout.mainCol} className="min-h-0">
        <Header
          webordersCount={webordersCount}
          inPlanningCount={inPlanningCountDisplay}
          inWaitingCount={inWaitingCountDisplay}
          functionButtonSlots={savedFunctionButtonsLayout}
          selectedTable={selectedTable}
          selectedTableLabel={selectedTableLabel}
          selectedRoomName={selectedRoomName}
          roomCount={roomCount}
          onOpenTables={handleOpenTables}
          onOpenWeborders={() => {
            setOrdersModalTab('new');
            setShowOrdersModal(true);
            fetchOrders();
            fetchOrderHistory();
          }}
          onOpenInPlanning={() => {
            setShowInPlanningModal(true);
            fetchOrders();
          }}
          onOpenInWaiting={() => {
            setShowInWaitingModal(true);
            fetchOrders();
          }}
        />
        <ProductArea
          products={products}
          selectedCategoryId={selectedCategoryId}
          categories={categories}
          onSelectCategory={setSelectedCategoryId}
          onAddProduct={handleAddProductWithSelectedTable}
          currentOrderId={currentOrder?.id}
          fetchSubproductsForProduct={fetchSubproductsForProduct}
          positioningLayoutByCategory={savedPositioningLayoutByCategory}
          positioningColorByCategory={savedPositioningColorByCategory}
          appendSubproductNoteToItem={appendSubproductNoteToItem}
        />
        <Footer
          customersActive={showCustomersModal}
          onCustomersClick={() => setShowCustomersModal(true)}
          showSubtotalView={showSubtotalView}
          subtotalButtonDisabled={subtotalButtonDisabled}
          onSubtotalClick={handleSubtotalClick}
          onHistoryClick={() => setShowHistoryModal(true)}
        />
      </View>
      <View style={posLayout.orderCol}>
        <OrderPanel
          order={currentOrder}
          orders={orders}
          focusedOrderId={focusedOrderId}
          focusedOrderInitialItemCount={focusedOrderInitialItemCount}
          onRemoveItem={removeOrderItem}
          onUpdateItemQuantity={updateOrderItemQuantity}
          onStatusChange={setOrderStatus}
          onCreateOrder={async (tableId) => {
            setFocusedOrderId(null);
            setFocusedOrderInitialItemCount(0);
            await createOrder(tableId);
          }}
          onRemoveAllOrders={async () => {
            await removeAllOrders();
            setFocusedOrderId(null);
            setFocusedOrderInitialItemCount(0);
          }}
          showInPlanningButton={Array.isArray(savedFunctionButtonsLayout) && savedFunctionButtonsLayout.includes('geplande-orders')}
          onSaveInWaitingAndReset={async () => {
            setFocusedOrderId(null);
            setFocusedOrderInitialItemCount(0);
            await createOrder(null);
            fetchOrders();
          }}
          tables={tables}
          showSubtotalView={showSubtotalView}
          subtotalBreaks={subtotalBreaks}
          onPaymentCompleted={() => {
            fetchOrderHistory();
            fetchTables();
          }}
          selectedTable={selectedTable}
          currentUser={user}
          currentTime={time}
          onOpenTables={handleOpenTables}
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          showInWaitingButton={showInWaitingButton}
          onOpenInPlanning={() => {
            setShowInPlanningModal(true);
            fetchOrders();
          }}
          onOpenInWaiting={() => {
            setShowInWaitingModal(true);
            fetchOrders();
          }}
        />
      </View>

      <WebordersModalRN
        open={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        weborders={(orders || []).filter((o) => o.status === 'in_planning')}
        inPlanningOrders={historyOrders || []}
        initialTab={ordersModalTab}
        onConfirm={() => {
          fetchOrders();
          fetchOrderHistory();
          fetchWebordersCount();
          fetchInPlanningCount();
        }}
        onCancelOrder={removeOrder}
      />
      <InPlanningModalRN
        open={showInPlanningModal}
        onClose={() => setShowInPlanningModal(false)}
        orders={orders || []}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchInPlanningCount();
        }}
        onLoadOrder={(orderId) => {
          setSelectedTable(null);
          setSelectedTableLabel(null);
          const ord = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          setFocusedOrderInitialItemCount(ord?.items?.length ?? 0);
          setShowInPlanningModal(false);
        }}
        onFetchOrders={fetchOrders}
      />
      <InWaitingModalRN
        open={showInWaitingModal}
        onClose={() => setShowInWaitingModal(false)}
        orders={orders || []}
        currentUser={user}
        onViewOrder={(orderId) => {
          setSelectedTable(null);
          setSelectedTableLabel(null);
          const viewedOrder = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          let savedCount = viewedOrder?.items?.length ?? 0;
          try {
            if (viewedOrder?.itemBatchBoundariesJson) {
              const b = JSON.parse(viewedOrder.itemBatchBoundariesJson);
              if (Array.isArray(b) && b.length > 0) savedCount = b[b.length - 1];
            }
          } catch {
            /* ignore */
          }
          setFocusedOrderInitialItemCount(savedCount);
          setShowInWaitingModal(false);
        }}
        onPrintOrder={async (orderId) => {
          await markOrderPrinted(orderId);
          fetchOrders();
        }}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchOrders();
          fetchInPlanningCount();
          fetchInWaitingCount();
        }}
      />
      <HistoryModalRN
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyOrders={historyOrders || []}
        onFetchHistory={fetchOrderHistory}
      />
      <CustomersModalRN open={showCustomersModal} onClose={() => setShowCustomersModal(false)} />
    </View>
  );
}
