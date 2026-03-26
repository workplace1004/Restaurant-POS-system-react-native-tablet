import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

const ICONS = {
  tables: '🪑',
  weborders: '🛒',
  'in-wacht': '⏱',
  'geplande-orders': '📅',
  reservaties: '📅',
  verkopers: '👤'
};

export function Header({
  webordersCount,
  inPlanningCount,
  inWaitingCount = 0,
  onOpenTables,
  onOpenWeborders,
  onOpenInPlanning,
  onOpenInWaiting,
  selectedTable,
  selectedTableLabel,
  selectedRoomName,
  roomCount = null,
  functionButtonSlots = []
}) {
  const { t } = useLanguage();
  const slots = Array.isArray(functionButtonSlots)
    ? functionButtonSlots.map((slot) => String(slot || '').trim()).filter(Boolean)
    : [];
  const slotCount = Math.min(4, Math.max(1, slots.length));
  const navGridClassByCount = {
    1: 'flex-col',
    2: 'flex-row flex-wrap',
    3: 'flex-row flex-wrap',
    4: 'flex-row flex-wrap'
  };
  const navGridClass = navGridClassByCount[slotCount] || 'flex-col';

  const tablesButtonLabel = (() => {
    if (selectedTable?.name != null && String(selectedTable.name).trim()) return String(selectedTable.name).trim();
    return t('noTable');
  })();

  const hasRoomAndTable =
    selectedRoomName != null &&
    selectedTableLabel != null &&
    String(selectedRoomName).trim() !== '' &&
    String(selectedTableLabel).trim() !== '';
  const showRoomNameInHeader = hasRoomAndTable && roomCount != null && roomCount > 1;

  const getButtonConfig = (id) => {
    switch (id) {
      case 'tables':
        return {
          label: tablesButtonLabel,
          icon: ICONS.tables,
          onPress: onOpenTables,
          isTablesSlot: true
        };
      case 'weborders':
        return {
          label: t('control.functionButton.weborders'),
          icon: ICONS.weborders,
          onPress: onOpenWeborders,
          isTablesSlot: false
        };
      case 'in-wacht':
        return {
          label: `${inWaitingCount} ${t('control.functionButton.inWaiting')}`,
          icon: ICONS['in-wacht'],
          onPress: onOpenInWaiting || onOpenInPlanning,
          isTablesSlot: false
        };
      case 'geplande-orders':
        return {
          label: `${inPlanningCount} ${t('control.functionButton.scheduledOrders')}`,
          icon: ICONS['geplande-orders'],
          onPress: onOpenInPlanning,
          isTablesSlot: false
        };
      case 'reservaties':
        return {
          label: t('control.functionButton.reservations'),
          icon: ICONS.reservaties,
          onPress: null,
          isTablesSlot: false
        };
      case 'verkopers':
        return {
          label: t('control.functionButton.sellers'),
          icon: ICONS.verkopers,
          onPress: null,
          isTablesSlot: false
        };
      default:
        return null;
    }
  };

  return (
    <View className="flex-row items-center w-full bg-pos-bg py-2 px-2 shrink-0">
      <View className={`flex-1 ${navGridClass} items-stretch gap-1 min-w-0`}>
        {slots.map((slotId, idx) => {
          const cfg = getButtonConfig(slotId);
          if (!cfg) return null;
          const isTablesSlot = cfg.isTablesSlot === true;
          const showRoomAndTableLines = isTablesSlot && showRoomNameInHeader;
          const flexBasis = slotCount <= 2 ? 'flex-1' : 'flex-1 min-w-[45%]';
          return (
            <Pressable
              key={`header-slot-${idx}-${slotId}`}
              onPress={cfg.onPress || undefined}
              disabled={!cfg.onPress}
              className={`rounded-md min-h-[46px] bg-pos-panel ${flexBasis} justify-center px-2 flex-row items-center gap-2 ${
                cfg.onPress ? 'active:bg-green-500' : 'opacity-80'
              }`}
            >
              <Text className="text-xl shrink-0">{cfg.icon}</Text>
              {showRoomAndTableLines ? (
                <View className="flex-1 items-center justify-center py-1 min-w-0">
                  <Text className="text-pos-text text-sm text-center truncate w-full">{String(selectedRoomName).trim()}</Text>
                  <View className="h-0.5 bg-white w-[80%] my-0.5" />
                  <Text className="text-pos-text text-sm text-center truncate w-full">{String(selectedTableLabel).trim()}</Text>
                </View>
              ) : (
                <Text
                  className={`text-pos-text text-sm flex-1 ${isTablesSlot ? '' : 'truncate'}`}
                  numberOfLines={isTablesSlot ? 2 : 1}
                >
                  {cfg.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
