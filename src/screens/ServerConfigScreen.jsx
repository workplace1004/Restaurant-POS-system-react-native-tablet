import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useApi } from '../contexts/ApiContext';

const HINT = 'Examples:\n• Android emulator: http://10.0.2.2:5000\n• LAN tablet: http://192.168.x.x:5000';

export function ServerConfigScreen() {
  const { setApiBase } = useApi();
  const [url, setUrl] = useState('http://10.0.2.2:5000');
  const [err, setErr] = useState('');

  const save = async () => {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
      setErr('Enter your backend URL (same machine as npm run on the server).');
      return;
    }
    setErr('');
    try {
      const test = trimmed.replace(/\/$/, '');
      const apiUrl = test.endsWith('/api') ? test : `${test}/api`;
      const ping = await fetch(`${apiUrl}/categories`);
      if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
      await setApiBase(test);
    } catch (e) {
      setErr(e?.message || 'Could not reach the API. Check URL and that the backend is running.');
    }
  };

  return (
    <View className="flex-1 bg-pos-bg p-8 justify-center">
      <Text className="text-pos-text text-2xl font-semibold mb-2">POS handheld</Text>
      <Text className="text-pos-muted text-sm mb-6">{HINT}</Text>
      <Text className="text-pos-text mb-2">Backend base URL</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://192.168.1.10:5000"
        placeholderTextColor="#7f8c8d"
        className="bg-pos-panel border border-pos-border rounded-lg px-4 py-3 text-pos-text text-lg mb-4"
      />
      {err ? <Text className="text-red-400 mb-4">{err}</Text> : null}
      <Pressable className="bg-green-600 py-4 rounded-lg" onPress={save}>
        <Text className="text-white text-center text-xl font-semibold">Connect</Text>
      </Pressable>
    </View>
  );
}
