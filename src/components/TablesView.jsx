import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../contexts/LanguageContext';
import { LoadingSpinner } from './LoadingSpinner';

const TABLE_LAST_PAID_AT_STORAGE_KEY = 'pos.tables.lastPaidAtById';
const TABLE_PAID_HIGHLIGHT_WINDOW_MS = 15 * 60 * 1000;

export function TablesView({
  tables = [],
  tableLayouts = {},
  fetchTableLayouts,
  selectedTableId = null,
  onSelectTable,
  onBack,
  time,
  api = '/api'
}) {
  const { t } = useLanguage();
  const { width: winW, height: winH } = useWindowDimensions();
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [layoutsLoading, setLayoutsLoading] = useState(true);
  const [lastPaidAtByTableId, setLastPaidAtByTableId] = useState({});
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [showRoomsModal, setShowRoomsModal] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLayoutsLoading(true);
      try {
        if (typeof fetchTableLayouts === 'function') await fetchTableLayouts();
      } finally {
        if (alive) setLayoutsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchTableLayouts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoomsLoading(true);
      try {
        const res = await fetch(`${api}/rooms`);
        const data = await res.json().catch(() => []);
        if (!alive) return;
        setRooms(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRooms([]);
      } finally {
        if (alive) setRoomsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const sortedRooms = useMemo(() => {
    if (!rooms.length) return [];
    const roomHasTables = (room) => {
      const roomId = room?.id != null ? String(room.id) : null;
      if (!roomId) return false;
      return tables.some((tb) => tb && String(tb?.roomId || '') === roomId);
    };
    const roomHasOpenOrders = (room) => {
      const roomId = room?.id != null ? String(room.id) : null;
      if (!roomId) return false;
      return tables.some((tb) => tb && String(tb?.roomId || '') === roomId && Array.isArray(tb?.orders) && tb.orders.length > 0);
    };
    return [...rooms].sort((a, b) => {
      const aHasTables = roomHasTables(a);
      const bHasTables = roomHasTables(b);
      if (aHasTables && !bHasTables) return -1;
      if (!aHasTables && bHasTables) return 1;
      const aHasOpen = roomHasOpenOrders(a);
      const bHasOpen = roomHasOpenOrders(b);
      if (aHasOpen && !bHasOpen) return -1;
      if (!aHasOpen && bHasOpen) return 1;
      return 0;
    });
  }, [rooms, tables]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_LAST_PAID_AT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      setLastPaidAtByTableId(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setLastPaidAtByTableId({});
    }
  }, [tables]);

  const currentRoom = sortedRooms?.length > 0 ? sortedRooms[selectedRoomIndex % sortedRooms.length] : null;
  const locationId = currentRoom?.id != null ? String(currentRoom.id) : null;
  const layout =
    locationId && tableLayouts?.[locationId] && typeof tableLayouts[locationId] === 'object'
      ? tableLayouts[locationId]
      : null;
  const layoutTables = layout?.tables && Array.isArray(layout.tables) ? layout.tables : [];
  const useLayoutMode = layoutTables.length > 0;

  const tablesForCurrentRoom = useMemo(() => {
    if (!locationId) return [];
    return tables.filter((tb) => tb && tb.id != null && String(tb?.roomId || '') === String(locationId));
  }, [tables, locationId]);

  const handleSelectAndClose = (table, options) => {
    onSelectTable?.(table, options);
    onBack?.();
  };

  const showLoading = roomsLoading || layoutsLoading;
  const viewportH = winH > 0 ? winH : 600;
  const viewportW = winW > 0 ? winW : 1024;
  const roomModalWidth = Math.max(360, Math.min(980, Math.floor(viewportW * 0.92)));
  const roomModalMaxHeight = Math.max(300, Math.floor(viewportH * 0.82));
  const roomTitleSize = Math.max(20, Math.min(30, Math.floor(viewportW * 0.02)));
  const roomItemFontSize = Math.max(12, Math.min(20, Math.floor(viewportW * 0.015)));
  const floorBaseWidth = Math.max(800, Number(layout?.floorWidth) || 800);
  const floorBaseHeight = Math.max(600, Number(layout?.floorHeight) || 600);
  const floorScale = Math.min(
    1,
    (viewportW - 48) / floorBaseWidth,
    (Math.max(360, viewportH * 0.76) - 16) / floorBaseHeight
  );
  const scaledFloorWidth = Math.max(320, Math.floor(floorBaseWidth * floorScale));
  const scaledFloorHeight = Math.max(260, Math.floor(floorBaseHeight * floorScale));
  const fallbackTileSize = Math.max(110, Math.min(200, Math.floor(Math.min(viewportW * 0.2, viewportH * 0.24))));
  const fallbackImageSize = Math.floor(fallbackTileSize * 0.95);
  const fallbackLabelSize = Math.max(22, Math.floor(fallbackTileSize * 0.22));

  if (showLoading) {
    return <LoadingSpinner label={t('loadingTables')} />;
  }

  return (
    <View className="flex-1 bg-pos-bg">
      <View className="px-4 py-4 bg-pos-bg flex-row justify-between items-center">
        <Text className="text-2xl text-pos-text">{time}</Text>
      </View>

      <ScrollView className="flex-1 bg-[#b0b0b0] p-3" contentContainerStyle={{ minHeight: viewportH * 0.55 }}>
        {useLayoutMode ? (
          <View style={{ width: scaledFloorWidth, height: scaledFloorHeight, position: 'relative', alignSelf: 'center' }}>
            {layoutTables.map((layoutTable, idx) => {
              const rawW = layoutTable.round ? Math.max(70, layoutTable.width) : layoutTable.width || 130;
              const w = Math.max(48, Math.floor(rawW * floorScale));
              const rawH = layoutTable.round ? rawW : layoutTable.height || 155;
              const scaledH = Math.max(48, Math.floor(rawH * floorScale));
              const matchedTable =
                tables.find((tb) => {
                  const nameMatch =
                    String(tb?.name || '').trim().toLowerCase() === String(layoutTable?.name || '').trim().toLowerCase();
                  if (!nameMatch) return false;
                  if (locationId != null && tb?.roomId != null) return String(tb.roomId) === locationId;
                  return true;
                }) || null;
              const id = matchedTable?.id != null ? String(matchedTable.id) : layoutTable.id;
              const tableNumber = String(layoutTable?.name ?? currentRoom?.name ?? id).replace(/^Table\s*/i, '') || String(idx + 1);
              const hasOpenOrders = matchedTable && Array.isArray(matchedTable?.orders) && matchedTable.orders.length > 0;
              const lastPaidAt = Number(lastPaidAtByTableId?.[id]) || 0;
              const wasPaidRecently =
                !hasOpenOrders && lastPaidAt > 0 && Date.now() - lastPaidAt <= TABLE_PAID_HIGHLIGHT_WINDOW_MS;
              const bg = hasOpenOrders ? 'bg-rose-500' : wasPaidRecently ? 'bg-green-500' : 'bg-pos-panel';
              return (
                <Pressable
                  key={layoutTable.id || id}
                  className={`absolute items-center justify-center border-2 border-transparent ${layoutTable.round ? 'rounded-full' : 'rounded-md'} ${bg}`}
                  style={{
                    left: Math.max(0, Math.floor((Number(layoutTable.x) || 0) * floorScale)),
                    top: Math.max(0, Math.floor((Number(layoutTable.y) || 0) * floorScale)),
                    width: w,
                    height: scaledH,
                    transform: [{ rotate: `${Number(layoutTable.rotation) || 0}deg` }]
                  }}
                  onPress={() =>
                    handleSelectAndClose(matchedTable, {
                      tableLabel: layoutTable?.name ?? tableNumber,
                      roomName: currentRoom?.name ?? null
                    })
                  }
                >
                  <Text
                    className="text-white font-bold"
                    style={{ fontSize: Math.max(14, Math.floor(Math.min(w, scaledH) * 0.34)) }}
                  >
                    {tableNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3 justify-center">
            {tablesForCurrentRoom.map((tb) => {
              if (!tb?.id) return null;
              const id = String(tb.id);
              const tableNumber = String(tb?.name ?? id).replace(/^Table\s*/i, '') || id;
              const hasOpenOrders = Array.isArray(tb?.orders) && tb.orders.length > 0;
              const lastPaidAt = Number(lastPaidAtByTableId?.[id]) || 0;
              const wasPaidRecently =
                !hasOpenOrders && lastPaidAt > 0 && Date.now() - lastPaidAt <= TABLE_PAID_HIGHLIGHT_WINDOW_MS;
              return (
                <Pressable
                  key={id}
                  className="items-center justify-center rounded-lg overflow-hidden bg-pos-panel border-2 border-pos-border"
                  style={{ width: fallbackTileSize, height: fallbackTileSize }}
                  onPress={() =>
                    handleSelectAndClose(tb, {
                      tableLabel: tableNumber,
                      roomName: currentRoom?.name ?? null
                    })
                  }
                >
                  <ExpoImage source={{ uri: '/table.png' }} style={{ width: fallbackImageSize, height: fallbackImageSize }} contentFit="contain" />
                  {hasOpenOrders ? <View className="absolute inset-0 bg-rose-500/50" /> : null}
                  {!hasOpenOrders && wasPaidRecently ? <View className="absolute inset-0 bg-green-500/50" /> : null}
                  <Text className="absolute text-white font-bold" style={{ fontSize: fallbackLabelSize }}>{tableNumber}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View className="flex-row flex-wrap justify-around py-3 px-2 bg-pos-panel gap-2">
        <Pressable className="py-2 px-3 active:bg-green-500 rounded" onPress={onBack}>
          <Text className="text-pos-text">{t('backName')}</Text>
        </Pressable>
        <Pressable
          className="py-2 px-3 active:bg-green-500 rounded"
          onPress={() => setSelectedRoomIndex((p) => (sortedRooms.length ? (p + 1) % sortedRooms.length : 0))}
        >
          <Text className="text-pos-text">{t('nextCourse')}</Text>
        </Pressable>
        <Pressable className="py-2 px-3 active:bg-green-500 rounded" onPress={() => setShowRoomsModal(true)}>
          <Text className="text-pos-text">{currentRoom?.name ?? t('room1')}</Text>
        </Pressable>
        <Pressable className="py-2 px-3 active:bg-green-500 rounded" onPress={() => handleSelectAndClose(null)}>
          <Text className="text-pos-text">{t('noTable')}</Text>
        </Pressable>
      </View>

      <Modal visible={showRoomsModal} transparent animationType="fade" statusBarTranslucent>
        <View className="flex-1 justify-center items-center p-4">
          <Pressable className="absolute inset-0 bg-black/60" onPress={() => setShowRoomsModal(false)} />
          <View className="bg-pos-bg rounded-xl border border-pos-border p-4" style={{ width: roomModalWidth, maxHeight: roomModalMaxHeight }}>
            <Text className="text-pos-text font-semibold mb-2" style={{ fontSize: roomTitleSize }}>{t('room1')}</Text>
            <ScrollView>
              {sortedRooms.map((room, idx) => (
                <Pressable
                  key={room?.id ?? idx}
                  className={`py-3 px-5 rounded-lg mb-1 ${selectedRoomIndex === idx ? 'bg-pos-rowHover border-2 border-pos-border' : 'bg-pos-panel'}`}
                  onPress={() => {
                    setSelectedRoomIndex(idx);
                    setShowRoomsModal(false);
                  }}
                >
                  <Text className="text-pos-text" style={{ fontSize: roomItemFontSize }}>{room?.name ?? `Room ${idx + 1}`}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable className="mt-4 py-3 bg-pos-panel rounded border border-pos-border" onPress={() => setShowRoomsModal(false)}>
              <Text className="text-center text-pos-text" style={{ fontSize: roomItemFontSize }}>{t('backName')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
