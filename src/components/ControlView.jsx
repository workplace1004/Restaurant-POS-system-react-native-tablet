import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

const LANGS = ['en', 'nl', 'fr', 'tr'];

export function ControlView({ onBack }) {
  const { t, lang, setLang } = useLanguage();
  const [pendingLang, setPendingLang] = useState(lang);

  useEffect(() => {
    setPendingLang(lang);
  }, [lang]);

  const languageLabel = (code) => {
    switch (code) {
      case 'en':
        return t('control.languageOption.en');
      case 'nl':
        return t('control.languageOption.nl');
      case 'fr':
        return t('control.languageOption.fr');
      case 'tr':
        return t('control.languageOption.tr');
      default:
        return code;
    }
  };

  return (
    <View className="flex-1 bg-pos-bg p-4">
      <View className="mb-4 flex-row items-center justify-between rounded-lg border border-pos-border bg-pos-panel px-4 py-3">
        <Text className="text-2xl font-semibold text-pos-text">{t('control')}</Text>
        <Pressable className="rounded-md bg-pos-surface px-4 py-2" onPress={onBack}>
          <Text className="text-pos-text">{t('inWaitingModal.back', 'Back')}</Text>
        </Pressable>
      </View>

      <View className="rounded-lg border border-pos-border bg-pos-panel p-4">
        <Text className="mb-1 text-xl font-semibold text-pos-text">{t('control.languageTitle')}</Text>
        <Text className="mb-4 text-pos-muted">{t('control.languageDescription')}</Text>

        <View className="flex-row flex-wrap gap-3">
          {LANGS.map((code) => {
            const selected = pendingLang === code;
            return (
              <Pressable
                key={code}
                className={`min-w-[170px] rounded-md border px-4 py-3 ${
                  selected ? 'border-green-500 bg-green-600/20' : 'border-pos-border bg-pos-surface'
                }`}
                onPress={() => setPendingLang(code)}
              >
                <Text className={`text-center font-medium ${selected ? 'text-green-400' : 'text-pos-text'}`}>
                  {languageLabel(code)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-4 flex-row justify-end">
          <Pressable
            disabled={pendingLang === lang}
            className={`rounded-md px-6 py-2 ${pendingLang === lang ? 'bg-pos-surface opacity-50' : 'bg-green-600'}`}
            onPress={() => setLang(pendingLang)}
          >
            <Text className="text-center font-semibold text-white">{t('control.save', 'Save')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
