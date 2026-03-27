import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

const DEVICE_SETTINGS_STORAGE_KEY = 'pos_device_settings';
const API = '/api';
const OPTION_BUTTON_SLOT_COUNT = 28;
const OPTION_BUTTON_MORE_ID = 'meer';
const DEFAULT_OPTION_BUTTON_LAYOUT = [
  'extra-bc-bedrag', '', 'bc-refund', 'stock-retour', 'product-labels', '', '',
  'ticket-afdrukken', '', 'tegoed', 'tickets-optellen', '', 'product-info', 'personeel-ticket',
  'productie-bericht', 'prijs-groep', 'discount', 'kadobon', 'various', 'plu', 'product-zoeken',
  'lade', 'klanten', 'historiek', 'subtotaal', 'terugname', '', 'meer'
];
const OPTION_BUTTON_LABELS = {
  'extra-bc-bedrag': { key: 'control.optionButton.extraBcAmount', fallback: 'Extra BC amount' },
  'bc-refund': { key: 'control.optionButton.bcRefund', fallback: 'BC Refund' },
  'stock-retour': { key: 'control.optionButton.stockRetour', fallback: 'Stock return' },
  'product-labels': { key: 'control.optionButton.productLabels', fallback: 'Product Labels' },
  'ticket-afdrukken': { key: 'control.optionButton.printTicket', fallback: 'Add ticket' },
  tegoed: { key: 'control.optionButton.credit', fallback: 'Credit' },
  'tickets-optellen': { key: 'control.optionButton.sumTickets', fallback: 'Ticket To' },
  'product-info': { key: 'control.optionButton.productInfo', fallback: 'Product info' },
  'personeel-ticket': { key: 'control.optionButton.staffTicket', fallback: 'Staff consumables' },
  'productie-bericht': { key: 'control.optionButton.productionMessage', fallback: 'Production message' },
  'prijs-groep': { key: 'control.optionButton.priceGroup', fallback: 'Price group' },
  discount: { key: 'control.optionButton.discount', fallback: 'Discount' },
  kadobon: { key: 'control.optionButton.giftVoucher', fallback: 'Gift voucher' },
  various: { key: 'control.optionButton.various', fallback: 'Miscellaneous' },
  plu: { key: 'control.optionButton.plu', fallback: 'PLU' },
  'product-zoeken': { key: 'control.optionButton.searchProduct', fallback: 'Search Product' },
  lade: { key: 'control.optionButton.drawer', fallback: 'Drawer' },
  klanten: { key: 'control.optionButton.customers', fallback: 'Customers' },
  historiek: { key: 'control.optionButton.history', fallback: 'History' },
  subtotaal: { key: 'control.optionButton.subtotal', fallback: 'Subtotal' },
  terugname: { key: 'control.optionButton.return', fallback: 'Return name' },
  meer: { key: 'control.optionButton.more', fallback: 'More...' },
  'eat-in-take-out': { key: 'control.optionButton.eatInTakeOut', fallback: 'Take Out' },
  'externe-apps': { key: 'control.optionButton.externalApps', fallback: 'External Apps' },
  'voor-verpakken': { key: 'control.optionButton.forPacking', fallback: 'Pre-packaging' },
  'leeggoed-terugnemen': { key: 'control.optionButton.depositReturn', fallback: 'Return empty containers' },
  'webshop-tijdsloten': { key: 'control.optionButton.webshopTimeslots', fallback: 'Webshop time slots' }
};

/** Bottom footer row: these option slots use smaller white labels (Drawer, Customers, History, Subtotal, Return name, More). */
const FOOTER_ROW_COMPACT_WHITE_IDS = new Set(['lade', 'klanten', 'historiek', 'subtotaal', 'terugname', 'meer']);

/** “More” modal: first 21 option slots are a fixed 3×7 grid (same indices as saved `optionButtonLayout`). */
const MORE_GRID_COLS = 7;
const MORE_GRID_ROWS = 3;

function normalizeOptionButtonSlots(value) {
  if (!Array.isArray(value)) return [...DEFAULT_OPTION_BUTTON_LAYOUT];
  const next = Array(OPTION_BUTTON_SLOT_COUNT).fill('');
  const used = new Set();
  for (let i = 0; i < OPTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || '').trim();
    if (!candidate || !OPTION_BUTTON_LABELS[candidate] || used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  if (!next.includes(OPTION_BUTTON_MORE_ID)) next[OPTION_BUTTON_SLOT_COUNT - 1] = OPTION_BUTTON_MORE_ID;
  return next;
}

export function Footer({
  customersActive = false,
  onCustomersClick,
  showSubtotalView,
  subtotalButtonDisabled,
  onSubtotalClick,
  onHistoryClick
}) {
  const { t } = useLanguage();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const footerLabelClass = 'text-xs leading-tight text-pos-text';
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [optionButtonSlots, setOptionButtonSlots] = useState(() => normalizeOptionButtonSlots(null));
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEVICE_SETTINGS_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      setOptionButtonSlots(normalizeOptionButtonSlots(saved?.optionButtonLayout));
    } catch {
      setOptionButtonSlots(normalizeOptionButtonSlots(null));
    }
  }, []);

  const footerRowSlotIds = useMemo(() => optionButtonSlots.slice(21, 28), [optionButtonSlots]);
  const moreGridSlotIds = useMemo(() => optionButtonSlots.slice(0, 21), [optionButtonSlots]);

  const getLabel = (id) => {
    const meta = OPTION_BUTTON_LABELS[id];
    if (!meta) return '';
    return tr(meta.key, meta.fallback);
  };

  const handleFooterButtonClick = (id) => {
    if (!id) return;
    if (id === OPTION_BUTTON_MORE_ID) {
      setShowMoreMenu((prev) => !prev);
      return;
    }
    setShowMoreMenu(false);
    if (id === 'klanten') onCustomersClick?.();
    if (id === 'historiek') onHistoryClick?.();
    if (id === 'subtotaal') onSubtotalClick?.();
  };

  const functionButtonBaseClass = 'bg-[#4ab3ff] text-pos-text active:bg-[#4ab3ff]/45';
  const moreModalWidth = Math.max(320, Math.min(1400, Math.floor((windowWidth || 1024) * 0.9)));
  const moreModalMaxHeight = Math.max(220, Math.floor((windowHeight || 700) * 0.72));

  return (
    <View className="w-full shrink-0 items-center bg-pos-bg px-2 pb-2">
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <View className="flex-1 justify-center items-center" style={{ width: '100%', height: '100%' }}>
          {/** Backdrop only: taps here close; modal panel is above and does not use this handler */}
          <Pressable
            accessibilityLabel="Close menu"
            className="absolute inset-0 bg-black/40"
            onPress={() => setShowMoreMenu(false)}
          />
          <View
            className="relative z-10 rounded-xl border border-pos-border bg-pos-panel p-4"
            style={{ width: moreModalWidth, maxHeight: moreModalMaxHeight }}
          >
            <ScrollView style={{ maxHeight: Math.max(140, moreModalMaxHeight - 24) }} contentContainerStyle={{ paddingBottom: 8 }}>
              <View className="w-full gap-2">
                {Array.from({ length: MORE_GRID_ROWS }, (_, row) => (
                  <View key={`more-grid-row-${row}`} className="w-full flex-row gap-2">
                    {Array.from({ length: MORE_GRID_COLS }, (_, col) => {
                      const idx = row * MORE_GRID_COLS + col;
                      const id = moreGridSlotIds[idx];
                      const cellClass = 'min-h-[48px] flex-1 min-w-0 justify-center rounded-sm px-1';
                      if (!id) {
                        return <View key={`more-empty-${idx}`} className={`${cellClass} bg-transparent`} />;
                      }
                      return (
                        <Pressable
                          key={`more-grid-${id}-${idx}`}
                          className={`${cellClass} ${functionButtonBaseClass}`}
                          onPress={() => handleFooterButtonClick(id)}
                        >
                          <Text
                            className="text-center text-[10px] leading-tight text-white"
                            numberOfLines={3}
                            ellipsizeMode="tail"
                          >
                            {getLabel(id).replace(/\s*\n\s*/g, ' ')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
