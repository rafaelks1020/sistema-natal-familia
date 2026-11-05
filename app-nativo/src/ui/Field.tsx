import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '../theme';
import { Text } from './Text';
export function Field({ label, error, trailing, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; error?: string; trailing?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.group}>
    <Text variant="muted" style={styles.label}>{label}</Text>
    <View style={[styles.field, { borderColor: error ? theme.colors.error : focused ? theme.colors.champagne : theme.colors.line }]}>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.champagne} style={[styles.input, style]}
        onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }} />
      {trailing}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 6 }, label: { fontSize: 12 },
  field: { minHeight: 54, backgroundColor: theme.colors.field, borderWidth: 1, borderRadius: theme.radius.field, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: theme.fonts.body, color: theme.colors.ivory, padding: 15 },
  error: { color: theme.colors.error, fontSize: 12 },
});
