import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {CalendarClock} from 'lucide-react-native';
import React, {useState} from 'react';
import {Platform, Pressable, StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import {formatDateTimeValue} from '../../utils/date';
import {AppText} from './AppText';

type DateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
};

export function DateTimeField({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
}: DateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');

  const open = () => {
    setMode('date');
    setShowPicker(true);
  };

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setShowPicker(false);
      return;
    }

    if (mode === 'date') {
      const next = new Date(value);
      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      onChange(next);
      setShowPicker(false);
      setTimeout(() => {
        setMode('time');
        setShowPicker(true);
      }, 0);
      return;
    }

    const next = new Date(value);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    onChange(next);
    setShowPicker(false);
  };

  const handleIosChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <Pressable onPress={open} style={styles.field}>
        <CalendarClock color={colors.textMuted} size={18} />
        <AppText>{formatDateTimeValue(value)}</AppText>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={value}
          mode={Platform.OS === 'ios' ? 'datetime' : mode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={
            Platform.OS === 'ios' ? handleIosChange : handleAndroidChange
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
});
