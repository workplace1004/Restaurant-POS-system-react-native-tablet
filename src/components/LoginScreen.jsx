import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiContext';

const LOGO_IMAGE = require('../../assets/image/logo.png');

const TOAST_DURATION_MS = 3500;
const AUTO_LOGIN_MIN_PIN_LENGTH = 4;

function parseOriginToIpPort(origin) {
  if (!origin) return { ip: '10.0.2.2', port: '5000' };
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === 'https:' ? '443' : '5000');
    return { ip: u.hostname, port };
  } catch {
    return { ip: '', port: '5000' };
  }
}

export function LoginScreen({ time, onLogin }) {
  const { t } = useLanguage();
  const { setApiBase, socketOrigin } = useApi();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginInFlight, setLoginInFlight] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [screen, setScreen] = useState('login');
  const [configIp, setConfigIp] = useState('');
  const [configPort, setConfigPort] = useState('');
  const [configErr, setConfigErr] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const defaultIpPort = useMemo(() => parseOriginToIpPort(socketOrigin), [socketOrigin]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => String(u.label ?? u.name ?? '').toLowerCase().includes(q));
  }, [users, userSearchQuery]);

  useEffect(() => {
    if (screen === 'config') {
      setConfigIp(defaultIpPort.ip);
      setConfigPort(defaultIpPort.port);
      setConfigErr('');
    }
  }, [screen, defaultIpPort.ip, defaultIpPort.port]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, [socketOrigin]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!showUserModal) setUserSearchQuery('');
  }, [showUserModal]);

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

  const openUserModal = () => setShowUserModal(true);

  const handleSaveServerConfig = useCallback(async () => {
    const ip = String(configIp || '').trim();
    const port = String(configPort || '').trim().replace(/^\//, '');
    if (!ip || !port) {
      setConfigErr(t('loginConfigIpPortRequired'));
      return;
    }
    setConfigErr('');
    setConfigSaving(true);
    try {
      const base = `http://${ip}:${port}`;
      const test = base.replace(/\/$/, '');
      const apiUrl = test.endsWith('/api') ? test : `${test}/api`;
      const ping = await fetch(`${apiUrl}/categories`);
      if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
      await setApiBase(test);
      setScreen('login');
    } catch (e) {
      setConfigErr(e?.message || t('loginConfigConnectFailed'));
    } finally {
      setConfigSaving(false);
    }
  }, [configIp, configPort, setApiBase, t]);

  if (screen === 'config') {
    return (
      <View className="flex-1 flex-col bg-pos-bg">
        <View className="flex-row items-center justify-between px-6 py-5 border-b border-pos-border">
          <Pressable
            className="px-3 py-2 rounded-lg bg-pos-panel border border-pos-border"
            onPress={() => setScreen('login')}
          >
            <Text className="text-pos-text text-base">{t('loginBack')}</Text>
          </Pressable>
          <Text className="text-xl font-semibold text-pos-text">{t('loginConfigTitle')}</Text>
          <View className="w-20" />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, maxWidth: 576, alignSelf: 'center', width: '100%' }}>
          <Text className="text-pos-muted text-sm mb-6">{t('loginConfigHint')}</Text>
          <Text className="text-pos-text mb-2">{t('loginServerIp')}</Text>
          <TextInput
            value={configIp}
            onChangeText={setConfigIp}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="192.168.1.10"
            placeholderTextColor="#7f8c8d"
            className="bg-pos-panel border border-pos-border rounded-lg px-4 py-3 text-pos-text text-lg mb-4"
          />
          <Text className="text-pos-text mb-2">{t('loginServerPort')}</Text>
          <TextInput
            value={configPort}
            onChangeText={setConfigPort}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="5000"
            placeholderTextColor="#7f8c8d"
            className="bg-pos-panel border border-pos-border rounded-lg px-4 py-3 text-pos-text text-lg mb-4"
          />
          {configErr ? <Text className="text-red-400 mb-4">{configErr}</Text> : null}
          <Pressable
            className={`py-4 rounded-lg ${configSaving ? 'bg-green-600/50' : 'bg-green-600'}`}
            onPress={handleSaveServerConfig}
            disabled={configSaving}
          >
            <Text className="text-white text-center text-xl font-semibold">{t('loginConnect')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const serverDisplay = socketOrigin || '';

  return (
    <View className="flex-1 flex-col bg-pos-bg text-pos-text">
      <View className="flex-row items-center justify-between px-6 py-5 border-b border-pos-border shrink-0">
        <Text className="text-xl font-medium text-pos-text">{time}</Text>
        <Text className="text-xl font-semibold text-pos-text">RestaurantPOS</Text>
        <View className="w-16" />
      </View>

      <View className="flex-1 flex-row min-h-0">
        <View className="flex-1 justify-center items-center p-6 border-r border-pos-border min-w-0">
          <ExpoImage
            source={LOGO_IMAGE}
            style={{ width: '85%', maxWidth: 420, aspectRatio: 1 }}
            contentFit="contain"
            accessibilityLabel="Logo"
          />
        </View>

        <ScrollView
          className="flex-1 min-w-0"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            className="w-full px-5 py-4 rounded-xl bg-[#1D4ED8] justify-center items-center active:bg-[#1D4ED8]/80"
            onPress={() => setScreen('config')}
          >
            <Text className="text-white text-base font-semibold">{t('loginConfiguration')}</Text>
          </Pressable>

          <Pressable
            className="w-full min-w-0 flex-row items-center justify-between rounded-xl border-2 border-pos-border bg-pos-panel px-4 py-3"
            onPress={openUserModal}
          >
            <Text
              className={`text-lg flex-1 pr-2 ${selectedUser ? 'text-white font-medium' : 'text-pos-muted'}`}
              numberOfLines={1}
            >
              {selectedUser ? selectedUser.label : t('loginSelectUser')}
            </Text>
            <Text className="text-pos-muted text-lg">▾</Text>
          </Pressable>

          <View className="bg-pos-panel rounded-xl p-1 w-full">
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
        </ScrollView>
      </View>

      <Modal
          visible={showUserModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUserModal(false)}
        >
          <Pressable className="flex-1 bg-black/50 justify-center items-center p-6" onPress={() => setShowUserModal(false)}>
            <View className="w-full max-w-md rounded-xl border border-pos-border bg-pos-panel p-4 max-h-[95%]">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-pos-text text-lg font-semibold shrink-0" numberOfLines={1}>
                  {t('loginUserModalTitle')}
                </Text>
                <TextInput
                  value={userSearchQuery}
                  onChangeText={setUserSearchQuery}
                  placeholder={t('loginUserSearchPlaceholder')}
                  placeholderTextColor="#7f8c8d"
                  editable={!loading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 min-w-0 bg-pos-bg border border-pos-border rounded-lg px-3 py-2 text-pos-text text-base"
                />
              </View>
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {loading ? (
                  <Text className="text-pos-muted py-6 text-center">{t('loginLoadingUsers')}</Text>
                ) : users.length === 0 ? (
                  <Text className="text-pos-muted py-6 text-center">{t('control.users.empty')}</Text>
                ) : filteredUsers.length === 0 ? (
                  <Text className="text-pos-muted py-6 text-center">{t('loginUserSearchNoMatch')}</Text>
                ) : (
                  <View className="gap-2">
                    {filteredUsers.map((user) => (
                      <Pressable
                        key={user.id}
                        className={`rounded-lg border-2 px-4 py-4 ${
                          selectedUser?.id === user.id ? 'bg-blue-600 border-white' : 'bg-pos-bg border-pos-border'
                        }`}
                        onPress={() => {
                          setSelectedUser(user);
                          setPinInput('');
                          setShowUserModal(false);
                        }}
                      >
                        <Text className="text-white text-lg font-semibold">{user.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>
              <Pressable className="mt-3 py-3 rounded-lg bg-pos-bg border border-pos-border" onPress={() => setShowUserModal(false)}>
                <Text className="text-pos-text text-center font-medium">{t('webordersClose')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

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
