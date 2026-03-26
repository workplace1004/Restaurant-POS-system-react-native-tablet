import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
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

  return (
    <View className="flex items-center pb-2 px-2 bg-pos-bg shrink-0">
      <View className="flex flex-row flex-wrap gap-1 text-sm w-full relative">
        {footerRowSlotIds.map((slotId, index) => {
          if (!slotId) {
            return <View key={`footer-empty-${index}`} className="flex-1 min-w-[12%]" />;
          }
          const isCustomers = slotId === 'klanten';
          const isHistory = slotId === 'historiek';
          const isSubtotal = slotId === 'subtotaal';
          const disabled = isSubtotal ? subtotalButtonDisabled : false;
          const active =
            (isCustomers && customersActive) || (isSubtotal && showSubtotalView) || (isHistory && false);
          return (
            <Pressable
              key={`footer-slot-${slotId}-${index}`}
              disabled={disabled}
              className={`py-3 flex-1 min-w-[12%] border-none rounded overflow-hidden ${
                disabled
                  ? 'bg-[#4ab3ff]/40 text-pos-text opacity-60'
                  : active
                    ? 'bg-pos-surface text-white'
                    : functionButtonBaseClass
              }`}
              onPress={() => handleFooterButtonClick(slotId)}
            >
              <Text className="text-center text-xs" numberOfLines={2}>
                {getLabel(slotId)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={showMoreMenu} transparent animationType="fade" onRequestClose={() => setShowMoreMenu(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowMoreMenu(false)}>
          <View className="bg-pos-panel p-4 rounded-t-xl border border-pos-border max-h-[70%]">
            <ScrollView className="flex flex-row flex-wrap gap-2">
              {moreGridSlotIds.map((id, idx) => {
                if (!id) return <View key={`more-empty-${idx}`} className="w-[13%] min-h-[46px]" />;
                return (
                  <Pressable
                    key={`more-grid-${id}-${idx}`}
                    className={`px-2 rounded text-center min-h-[46px] min-w-[13%] justify-center ${functionButtonBaseClass}`}
                    onPress={() => handleFooterButtonClick(id)}
                  >
                    <Text className="text-xs text-center" numberOfLines={3}>
                      {getLabel(id).replace(/\s*\n\s*/g, ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable className="mt-4 py-2 bg-pos-bg rounded" onPress={() => setShowMoreMenu(false)}>
              <Text className="text-center text-pos-text">{t('cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
