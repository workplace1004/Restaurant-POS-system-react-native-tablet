import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

const ROW1 = 'azertyuiop'.split('');
const ROW2 = 'qsdfghjklm'.split('');
const ROW3 = 'wxcvbn,.€'.split('');
const NUMPAD = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['-', '0', '.']];

export function InWaitingNameModal({ open, onClose, onConfirm }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [name, setName] = useState('');
  const [upper, setUpper] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  const append = (ch) => {
    if (!ch) return;
    const c = upper && /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
    setName((n) => n + c);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-center items-center p-4">
        <View className="bg-pos-bg rounded-xl w-full max-w-[900px] max-h-[90vh] border border-pos-border p-4">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={tr('control.enterName', 'Enter name')}
            placeholderTextColor="#95a5a6"
            className="w-full px-4 py-3 my-4 bg-pos-panel border border-pos-border rounded-md text-pos-text text-lg"
          />
          <View className="flex-row justify-around mb-4">
            <Pressable className="px-6 py-2 bg-pos-panel border border-pos-border rounded-md" onPress={onClose}>
              <Text className="text-pos-text">{t('cancel')}</Text>
            </Pressable>
            <Pressable
              className="px-6 py-2 bg-pos-panel border border-pos-border rounded-md"
              onPress={() => {
                onConfirm('');
                onClose();
              }}
            >
              <Text className="text-pos-text">{tr('orderPanel.inWaitingModal.withoutName', 'Without name')}</Text>
            </Pressable>
            <Pressable
              className="px-6 py-2 bg-pos-panel border border-pos-border rounded-md"
              onPress={() => {
                onConfirm(name.trim());
                onClose();
              }}
            >
              <Text className="text-pos-text">{tr('orderPanel.inWaitingModal.continue', 'Continue')}</Text>
            </Pressable>
          </View>
          <Pressable className="mb-2 py-2 bg-pos-panel rounded" onPress={() => setUpper((u) => !u)}>
            <Text className="text-center text-pos-text">Shift / Maj</Text>
          </Pressable>
          <ScrollView className="max-h-[280px]">
            {[ROW1, ROW2, ROW3].map((row, ri) => (
              <View key={ri} className="flex-row flex-wrap justify-center gap-1 mb-1">
                {row.map((k) => (
                  <Pressable key={k} className="w-9 h-11 bg-pos-panel rounded justify-center items-center" onPress={() => append(k)}>
                    <Text className="text-pos-text text-lg">{upper ? k.toUpperCase() : k}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {NUMPAD.map((row, ri) => (
              <View key={`n-${ri}`} className="flex-row justify-center gap-1 mb-1">
                {row.map((k) => (
                  <Pressable key={k} className="w-12 h-11 bg-pos-panel rounded justify-center items-center" onPress={() => append(k)}>
                    <Text className="text-pos-text text-lg">{k}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            <Pressable className="py-2 bg-pos-danger rounded mt-2" onPress={() => setName((n) => n.slice(0, -1))}>
              <Text className="text-center text-white">⌫ {t('delete', 'Delete')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
