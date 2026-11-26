import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';

export const colors = { ink: '#292821', muted: '#676254', yellow: '#FFF2BA', primary: '#F4D960', paper: '#FFFCF2', border: '#E7E1CF', white: '#FFFFFF', danger: '#9B3329' };
export function Button({ title, onPress, disabled, primary, selected, label }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label || title} accessibilityState={{ disabled: !!disabled, selected: !!selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primary, selected && styles.selected, (disabled || pressed) && { opacity: 0.5 }]}>
    <Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
}
export function Heading({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Note({ children }: { children: React.ReactNode }) { return <Text accessibilityLiveRegion="polite" style={styles.note}>{children}</Text>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }]} {...props} /></View>;
}
export function Row(props: ViewProps) { return <View {...props} style={[styles.row, props.style]} />; }
export const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.yellow, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.primary }, selected: { backgroundColor: colors.primary, borderWidth: 1, borderColor: '#806900' },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  heading: { fontSize: 21, fontWeight: '800', color: colors.ink, marginTop: 8, marginBottom: 8 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23 }, muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  note: { backgroundColor: colors.paper, padding: 12, borderRadius: 12, color: colors.muted, fontSize: 14, lineHeight: 22, marginVertical: 8 },
  field: { flex: 1, gap: 6, marginVertical: 6 }, label: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  card: { padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginVertical: 5, backgroundColor: colors.white },
});
