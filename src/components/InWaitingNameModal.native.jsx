import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export function InWaitingNameModal({ open, onClose, onConfirm }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/40 justify-center items-center p-4" style={{ width: '100%', height: '100%' }}>
        <View className="bg-pos-bg rounded-xl w-full max-w-[500px] max-h-[90vh] border border-pos-border p-4">
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
        </View>
      </View>
    </Modal>
  );
}
