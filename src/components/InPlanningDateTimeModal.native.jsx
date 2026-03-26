import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../contexts/LanguageContext';

const snapMinute = (m) => [0, 15, 30, 45].reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));

/**
 * Calendar flow for In planning (matches web: pick date/time then Save).
 */
export function InPlanningDateTimeModal({ open, onClose, onSave }) {
  const { t } = useLanguage();
  const [dt, setDt] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), snapMinute(n.getMinutes()), 0, 0);
  });
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (open) {
      const n = new Date();
      setDt(new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), snapMinute(n.getMinutes()), 0, 0));
    }
  }, [open]);

  if (!open) return null;

  const onChange = (_e, selected) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) {
      setDt(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), selected.getHours(), snapMinute(selected.getMinutes()), 0, 0));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-pos-panel rounded-xl border border-pos-border p-6 w-full max-w-lg">
          <Text className="text-pos-text text-xl text-center mb-4">{t('inPlanning')}</Text>
          <Pressable className="py-3 bg-pos-surface rounded mb-4" onPress={() => setShowPicker(true)}>
            <Text className="text-pos-text text-center text-lg">
              {dt.toLocaleDateString('en-GB')} {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker value={dt} mode="datetime" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onChange} />
          ) : null}
          <View className="flex-row justify-between gap-4 mt-4">
            <Pressable className="flex-1 py-3 bg-pos-surface rounded" onPress={onClose}>
              <Text className="text-pos-text text-center">{t('cancel')}</Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 bg-green-600 rounded"
              onPress={() => {
                onSave?.(dt);
              }}
            >
              <Text className="text-white text-center font-semibold">{t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
