import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

/** One arrow tap scrolls ~⅓ of the visible list (clamped) for smooth, readable steps. */
const SCROLL_STEP_MIN = 72;
const SCROLL_STEP_MAX = 200;
const SCROLL_STEP_VIEWPORT_RATIO = 0.33;

export function LeftSidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  currentUser,
  onControlClick,
  onLogout,
  time
}) {
  const { t } = useLanguage();
  const listRef = useRef(null);
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  /** Must not rely only on onScroll — it often never fires until the user drags, so arrows stay wrongly disabled. */
  const updateScrollCapabilities = useCallback(() => {
    const y = scrollYRef.current;
    const viewport = layoutHeightRef.current;
    const contentH = contentHeightRef.current;
    if (viewport <= 0 || contentH <= 0) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    if (contentH <= viewport + 2) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    setCanScrollUp(y > 2);
    setCanScrollDown(y + viewport < contentH - 2);
  }, []);

  const scrollCategories = useCallback((direction) => {
    const viewport = layoutHeightRef.current;
    const contentH = contentHeightRef.current;
    if (viewport <= 0 || contentH <= 0) return;
    const maxY = Math.max(0, contentH - viewport);
    if (maxY <= 0) return;
    const step = Math.round(
      Math.min(SCROLL_STEP_MAX, Math.max(SCROLL_STEP_MIN, viewport * SCROLL_STEP_VIEWPORT_RATIO))
    );
    const current = scrollYRef.current;
    const nextY = Math.max(0, Math.min(maxY, current + direction * step));
    listRef.current?.scrollTo({ y: nextY, animated: true });
  }, []);

  const onControl = () => {
    onControlClick?.();
  };

  return (
    <View className="flex-1 h-full flex-col bg-pos-bg p-3 pl-2">
      <View className="flex-row items-center mb-4 gap-2">
        <Pressable
          className="w-10 h-10 rounded-md bg-pos-panel/60 items-center justify-center active:bg-green-500"
          onPress={() => onLogout?.()}
          accessibilityLabel={t('logOut')}
        >
          <Text className="text-pos-text text-lg">⎋</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-xl font-semibold text-pos-text">{time != null ? time : '--:--'}</Text>
        </View>
      </View>
      <ScrollView
        ref={listRef}
        className="flex-1"
        onLayout={(e) => {
          layoutHeightRef.current = e.nativeEvent.layout.height;
          updateScrollCapabilities();
        }}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
          updateScrollCapabilities();
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          scrollYRef.current = contentOffset.y;
          contentHeightRef.current = contentSize.height;
          layoutHeightRef.current = layoutMeasurement.height;
          updateScrollCapabilities();
        }}
        scrollEventThrottle={16}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            className={`px-3 py-2 rounded-lg mb-1 ${
              selectedCategoryId === cat.id ? 'bg-pos-panel border border-green-500' : 'bg-pos-panel/50'
            }`}
            onPress={() => onSelectCategory(cat.id)}
          >
            <Text
              className={`text-xs ${selectedCategoryId === cat.id ? 'text-green-500 font-medium' : 'text-pos-text'}`}
              numberOfLines={2}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View className="flex-row items-center justify-center gap-2 py-2">
        <Pressable
          disabled={!canScrollUp}
          className={`flex-1 h-8 rounded-md border border-pos-border items-center justify-center ${canScrollUp ? 'bg-pos-panel/60 active:bg-green-500' : 'opacity-40'}`}
          onPress={() => scrollCategories(-1)}
          accessibilityLabel={t('scrollUp', 'Scroll categories up')}
        >
          <Text className="text-pos-text">↑</Text>
        </Pressable>
        <Pressable
          disabled={!canScrollDown}
          className={`flex-1 h-8 rounded-md border border-pos-border items-center justify-center ${canScrollDown ? 'bg-pos-panel/60 active:bg-green-500' : 'opacity-40'}`}
          onPress={() => scrollCategories(1)}
          accessibilityLabel={t('scrollDown', 'Scroll categories down')}
        >
          <Text className="text-pos-text">↓</Text>
        </Pressable>
      </View>
      <View className="flex-col items-center border-t border-gray-500 pt-1">
        {currentUser ? <Text className="text-md font-medium text-pos-text">{currentUser.label}</Text> : null}
        <Pressable className="py-1" onPress={onControl}>
          <Text className="text-red-500 text-xl font-semibold">{t('control')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
