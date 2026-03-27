import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

const TOAST_DURATION_MS = 3500;
const AUTO_LOGIN_MIN_PIN_LENGTH = 4;

export function LoginScreen({ time, onLogin }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginInFlight, setLoginInFlight] = useState(false);
  const scrollRef = useRef(null);
  const scrollXRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSubmit = useCallback(async ({ silent = false } = {}) => {
    if (loginInFlight) return;
    if (!selectedUser) {
      if (!silent) setToast(t('loginSelectUser'));
      return;
    }
    setLoginInFlight(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin: pinInput })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setToast(data.error || t('loginWrongPin'));
          setPinInput('');
        }
        return;
      }
      onLogin?.(data);
    } catch {
      if (!silent) {
        setToast(t('loginFailed'));
        setPinInput('');
      }
    } finally {
      setLoginInFlight(false);
    }
  }, [selectedUser, pinInput, onLogin, t, loginInFlight]);

  useEffect(() => {
    if (!selectedUser) return undefined;
    if (pinInput.length < AUTO_LOGIN_MIN_PIN_LENGTH) return undefined;
    const id = setTimeout(() => {
      handleSubmit({ silent: true });
    }, 220);
    return () => clearTimeout(id);
  }, [selectedUser, pinInput, handleSubmit]);

  const scrollUsers = (dir) => {
    const step = 200;
    scrollXRef.current = Math.max(0, scrollXRef.current + (dir === 'left' ? -step : step));
    scrollRef.current?.scrollTo?.({ x: scrollXRef.current, animated: true });
  };

  return (
    <View className="flex-1 flex-col bg-pos-bg text-pos-text">
      <View className="flex-row items-center justify-between px-6 py-5 border-b border-pos-border">
        <Text className="text-xl font-medium text-pos-text">{time}</Text>
        <Text className="text-xl font-semibold text-pos-text">RestaurantPOS</Text>
        <View className="w-16" />
      </View>

      <View className="mt-5 flex-col items-center gap-8 p-6 flex-1">
        <View className="flex-row items-center gap-4 w-full max-w-3xl">
          <Pressable className="w-10 h-[170px] rounded-xl bg-pos-panel border-2 border-pos-border justify-center items-center" onPress={() => scrollUsers('left')}>
            <Text className="text-white text-xl">{'<'}</Text>
          </Pressable>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1 max-h-[180px]"
            onScroll={(e) => {
              scrollXRef.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
          >
            <View className="flex-row gap-4">
              {loading ? (
                <Text className="text-pos-muted text-xl">{t('loginLoadingUsers')}</Text>
              ) : (
                users.map((user) => (
                  <Pressable
                    key={user.id}
                    className={`min-w-[150px] h-[170px] flex-col items-center p-6 rounded-xl border-2 ${
                      selectedUser?.id === user.id ? 'bg-blue-600 border-white' : 'bg-pos-panel border-pos-border'
                    }`}
                    onPress={() => {
                      setSelectedUser(user);
                      setPinInput('');
                    }}
                  >
                    <Text className="text-white text-xl font-semibold mt-auto">{user.label}</Text>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
          <Pressable className="w-10 h-[170px] rounded-xl bg-pos-panel border-2 border-pos-border justify-center items-center" onPress={() => scrollUsers('right')}>
            <Text className="text-white text-xl">{'>'}</Text>
          </Pressable>
        </View>

        <View className="bg-pos-panel rounded-xl p-6 w-full max-w-md mt-6">
          <View className="mb-4 h-16 items-center justify-center bg-pos-bg rounded px-3">
            <TextInput
              value={pinInput}
              onChangeText={(text) => {
                const numeric = String(text || '').replace(/\D/g, '').slice(0, 8);
                setPinInput(numeric);
              }}
              placeholder={t('pin')}
              placeholderTextColor="#cfd8dc"
              className="w-full text-center text-xl font-mono text-white tracking-widest"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor="#ffffff"
            />
          </View>
        </View>
      </View>

      <Modal visible={!!toast} transparent animationType="fade">
        <Pressable className="flex-1 justify-start items-end p-8 pt-16" onPress={() => setToast(null)}>
          <View className="bg-gray-900 rounded-2xl p-4 max-w-[320px] border border-white/10">
            <Text className="text-white text-lg">{toast}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
