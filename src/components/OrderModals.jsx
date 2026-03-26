import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export function WebordersModalRN({
  open,
  onClose,
  weborders = [],
  inPlanningOrders = [],
  initialTab = 'new',
  onConfirm,
  onCancelOrder
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSelectedOrderId(null);
    }
  }, [open, initialTab]);

  if (!open) return null;
  const list = activeTab === 'new' ? weborders : inPlanningOrders;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-pos-panel rounded-xl border border-pos-border max-h-[85%] p-4">
          <View className="flex-row justify-around mb-4">
            <Pressable onPress={() => setActiveTab('new')} className={`pb-2 px-4 ${activeTab === 'new' ? 'border-b-2 border-green-500' : ''}`}>
              <Text className="text-lg text-pos-text">{t('weborders')}</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab('history')} className={`pb-2 px-4 ${activeTab === 'history' ? 'border-b-2 border-green-500' : ''}`}>
              <Text className="text-lg text-pos-text">{t('inPlanning')}</Text>
            </Pressable>
          </View>
          <ScrollView className="max-h-[400px]">
            {(list || []).map((o) => (
              <Pressable
                key={o.id}
                className={`py-3 border-b border-pos-border ${selectedOrderId === o.id ? 'bg-pos-rowHover' : ''}`}
                onPress={() => setSelectedOrderId(o.id)}
              >
                <Text className="text-pos-text">{o.id?.slice(-8)} — €{Number(o.total || 0).toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row justify-between mt-4 gap-2">
            <Pressable className="flex-1 py-3 bg-pos-surface rounded" onPress={onClose}>
              <Text className="text-center text-pos-text">{t('cancel')}</Text>
            </Pressable>
            {activeTab === 'new' && selectedOrderId ? (
              <Pressable
                className="flex-1 py-3 bg-pos-danger rounded"
                onPress={() => {
                  onCancelOrder?.(selectedOrderId);
                  setSelectedOrderId(null);
                }}
              >
                <Text className="text-center text-white">{t('delete')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              className="flex-1 py-3 bg-green-600 rounded"
              onPress={() => {
                onConfirm?.();
                onClose?.();
              }}
            >
              <Text className="text-center text-white">{t('ok')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function InPlanningModalRN({ open, onClose, orders = [], onDeleteOrder, onLoadOrder, onFetchOrders }) {
  const { t } = useLanguage();
  useEffect(() => {
    if (open) onFetchOrders?.();
  }, [open, onFetchOrders]);
  if (!open) return null;
  const list = (orders || []).filter((o) => o?.status === 'in_planning');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-pos-panel rounded-xl border border-pos-border max-h-[80%] p-4">
          <Text className="text-xl text-pos-text mb-4">{t('inPlanning')}</Text>
          <ScrollView className="max-h-[360px]">
            {list.map((o) => (
              <View key={o.id} className="flex-row py-2 border-b border-pos-border items-center">
                <Pressable className="flex-1" onPress={() => onLoadOrder?.(o.id)}>
                  <Text className="text-pos-text">{o.id?.slice(-8)} — €{Number(o.total || 0).toFixed(2)}</Text>
                </Pressable>
                <Pressable className="px-3 py-1 bg-pos-danger rounded ml-2" onPress={() => onDeleteOrder?.(o.id)}>
                  <Text className="text-white">{t('delete')}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Pressable className="mt-4 py-3 bg-pos-surface rounded" onPress={onClose}>
            <Text className="text-center text-pos-text">{t('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function InWaitingModalRN({
  open,
  onClose,
  orders = [],
  onViewOrder,
  onDeleteOrder,
  onPrintOrder,
  currentUser
}) {
  const { t } = useLanguage();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (open) {
      setSelectedOrderId(null);
      setSearch('');
    }
  }, [open]);
  if (!open) return null;
  const waiting = (orders || []).filter((o) => o?.status === 'in_waiting');
  const q = search.trim().toLowerCase();
  const shown =
    q === ''
      ? waiting
      : waiting.filter((o) => String(o.id || '').toLowerCase().includes(q));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-pos-panel rounded-xl border border-pos-border max-h-[85%] p-4">
          <Text className="text-xl text-pos-text mb-2">{t('control.functionButton.inWaiting')}</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search…"
            placeholderTextColor="#95a5a6"
            className="bg-pos-bg border border-pos-border rounded px-3 py-2 text-pos-text mb-2"
          />
          <ScrollView className="max-h-[320px]">
            {shown.map((o) => (
              <Pressable
                key={o.id}
                className={`py-3 border-b border-pos-border ${selectedOrderId === o.id ? 'bg-pos-rowHover' : ''}`}
                onPress={() => setSelectedOrderId(o.id)}
              >
                <Text className="text-pos-text">
                  {o.id?.slice(-6)} — {o?.user?.name ?? currentUser?.label ?? '—'} — €{Number(o.total || 0).toFixed(2)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row flex-wrap gap-2 mt-4">
            <Pressable className="flex-1 py-2 bg-pos-surface rounded" onPress={() => selectedOrderId && onViewOrder?.(selectedOrderId)}>
              <Text className="text-center text-pos-text">View</Text>
            </Pressable>
            <Pressable className="flex-1 py-2 bg-pos-surface rounded" onPress={() => selectedOrderId && onPrintOrder?.(selectedOrderId)}>
              <Text className="text-center text-pos-text">Print</Text>
            </Pressable>
            <Pressable className="flex-1 py-2 bg-pos-danger rounded" onPress={() => selectedOrderId && onDeleteOrder?.(selectedOrderId)}>
              <Text className="text-center text-white">{t('delete')}</Text>
            </Pressable>
            <Pressable className="flex-1 py-2 bg-pos-bg rounded border border-pos-border" onPress={onClose}>
              <Text className="text-center text-pos-text">{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function HistoryModalRN({ open, onClose, historyOrders = [], onFetchHistory }) {
  const { t } = useLanguage();
  useEffect(() => {
    if (open) onFetchHistory?.();
  }, [open, onFetchHistory]);
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-pos-panel rounded-xl border border-pos-border max-h-[80%] p-4">
          <Text className="text-xl text-pos-text mb-4">{t('historyOrderTitle')}</Text>
          <ScrollView className="max-h-[400px]">
            {(historyOrders || []).map((o) => (
              <View key={o.id} className="py-2 border-b border-pos-border">
                <Text className="text-pos-text">
                  {o.id?.slice(-8)} — paid €{Number(o.total || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <Pressable className="mt-4 py-3 bg-green-600 rounded" onPress={onClose}>
            <Text className="text-center text-white">{t('ok')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function CustomersModalRN({ open, onClose }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-6">
        <View className="bg-pos-panel rounded-xl p-6 border border-pos-border">
          <Text className="text-pos-text text-lg mb-4">{t('customers')}</Text>
          <Text className="text-pos-muted mb-6">Customer management matches the web POS. Use the main terminal for full customer tools.</Text>
          <Pressable className="py-3 bg-green-600 rounded" onPress={onClose}>
            <Text className="text-center text-white">{t('ok')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
