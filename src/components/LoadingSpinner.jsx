import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export function LoadingSpinner({ label }) {
  return (
    <View className="flex-1 items-center justify-center bg-pos-bg gap-4">
      <ActivityIndicator size="large" color="#22c55e" />
      {label ? <Text className="text-pos-text text-lg">{label}</Text> : null}
    </View>
  );
}
