import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getT } from '../translations';
import { hydrateLangFromDisk, LANG_STORAGE_KEY, VALID } from '../lib/translationsStorage';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [ready, setReady] = useState(false);
  const t = useCallback((key) => getT(lang)(key), [lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initial = await hydrateLangFromDisk();
      if (!cancelled) setLangState(initial);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetch('/api/settings/language')
      .then((r) => r.json())
      .then((data) => {
        const apiLang = data?.value;
        if (apiLang && VALID.includes(apiLang)) {
          setLangState(apiLang);
          AsyncStorage.setItem(LANG_STORAGE_KEY, apiLang).catch(() => {});
        }
      })
      .catch(() => {});
  }, [ready]);

  const setLang = useCallback((newLang) => {
    if (!VALID.includes(newLang)) return;
    AsyncStorage.setItem(LANG_STORAGE_KEY, newLang).catch(() => {});
    setLangState(newLang);
    fetch('/api/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newLang }),
    }).catch(() => {});
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 bg-pos-bg items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (k) => k };
  return ctx;
}
