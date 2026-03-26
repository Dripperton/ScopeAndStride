import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}

function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function fromDateString(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DateInput({ value, onChange, placeholder = 'YYYY-MM-DD', label }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrap}>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            backgroundColor: '#FAF7F2',
            border: '1px solid #E8E0CC',
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: value ? '#1A1A14' : '#9A9285',
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable style={styles.mobileInput} onPress={() => setShowPicker(true)}>
        <Text style={[styles.mobileInputText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.calIcon}>📅</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={fromDateString(value)}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowPicker(false);
            if (date) onChange(toDateString(date));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: { width: '100%' },
  mobileInput: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mobileInputText: { fontSize: 14, color: '#1A1A14' },
  placeholder: { color: '#9A9285' },
  calIcon: { fontSize: 16 },
});
