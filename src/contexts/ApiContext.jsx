import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { installFetchRewrite } from '../lib/setupRuntime';

const STORAGE_KEY = 'pos-handheld-server-url';

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
  const [apiBase, setApiBaseState] = useState('');
  const [ready, setReady] = useState(false);

  const applyBase = useCallback((raw) => {
    const trimmed = String(raw || '').trim().replace(/\/$/, '');
    if (!trimmed) return;
    const withApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    installFetchRewrite(withApi);
    setApiBaseState(withApi);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved) applyBase(saved);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBase]);

  const setApiBase = useCallback(
    async (raw) => {
      const trimmed = String(raw || '').trim().replace(/\/$/, '');
      if (trimmed) {
        await AsyncStorage.setItem(STORAGE_KEY, trimmed);
        applyBase(trimmed);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setApiBaseState('');
      }
    },
    [applyBase]
  );

  const value = useMemo(
    () => ({
      apiBase,
      ready,
      setApiBase,
      socketOrigin: apiBase ? apiBase.replace(/\/?api\/?$/, '') : '',
    }),
    [apiBase, ready, setApiBase]
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    return { apiBase: '', ready: true, setApiBase: async () => {}, socketOrigin: '' };
  }
  return ctx;
}
