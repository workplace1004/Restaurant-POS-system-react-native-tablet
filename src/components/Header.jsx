import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

const ICONS = {
  tables: 'table-chair',
  'in-wacht': 'clock-outline',
  'geplande-orders': 'calendar-month-outline',
  reservaties: 'calendar-month-outline',
  verkopers: 'account-outline'
};

export function Header({
  inWaitingCount = 0,
  onOpenTables,
  onOpenInWaiting,
  selectedTable,
  selectedTableLabel,
  selectedRoomName,
  roomCount = null,
  functionButtonSlots = []
}) {
  const { t } = useLanguage();
  const renderIcon = (name) => (
    <MaterialCommunityIcons name={name} size={18} color="#dfe6e9" />
  );
  const headerLabelClass = 'text-pos-text text-[10px] text-center';
  const slots = Array.isArray(functionButtonSlots)
    ? functionButtonSlots.map((slot) => String(slot || '').trim()).filter(Boolean)
    : [];
  /** RN: flex defaults to column; wrap + min-w-% created a 2×2 grid. One horizontal row = flex-row flex-nowrap + equal flex-1. */
  const navRowClass = 'w-full min-w-0 flex-row flex-nowrap items-stretch gap-1';

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
        return null;
      case 'in-wacht':
        return {
          label: `${inWaitingCount} ${t('control.functionButton.inWaiting')}`,
          icon: ICONS['in-wacht'],
          onPress: onOpenInWaiting,
          isTablesSlot: false
        };
      case 'geplande-orders':
        return null;
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
    <View className="flex-row items-center w-full bg-pos-bg pt-0 pb-1 px-2 shrink-0">
      <View className={`flex-1 ${navRowClass}`}>
        {slots.map((slotId, idx) => {
          const cfg = getButtonConfig(slotId);
          if (!cfg) return null;
          const isTablesSlot = cfg.isTablesSlot === true;
          const showRoomAndTableLines = isTablesSlot && showRoomNameInHeader;
          return (
            <Pressable
              key={`header-slot-${idx}-${slotId}`}
              onPress={cfg.onPress || undefined}
              disabled={!cfg.onPress}
              className={`min-h-[52px] min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-md bg-pos-panel px-1 ${cfg.onPress ? 'active:bg-green-500' : 'opacity-80'
                }`}
            >
              {showRoomAndTableLines ? (
                <View className="flex-1 flex-row items-center justify-center py-1 min-w-0 gap-1">
                  {renderIcon(cfg.icon)}
                  <View className="flex w-[70%] justify-center items-center">
                    <Text className={`${headerLabelClass} truncate`}>{String(selectedRoomName).trim()}</Text>
                    <View className="h-0.5 bg-white my-0.5 w-[80%]" />
                    <Text className={`${headerLabelClass} truncate`}>{String(selectedTableLabel).trim()}</Text>
                  </View>
                </View>
              ) : (
                <View className="min-w-0 flex-1 flex-row items-center justify-center gap-1">
                  {renderIcon(cfg.icon)}
                  <Text
                    className={`${headerLabelClass} ${isTablesSlot ? '' : 'truncate'}`}
                    numberOfLines={isTablesSlot ? 2 : 1}
                  >
                    {cfg.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
