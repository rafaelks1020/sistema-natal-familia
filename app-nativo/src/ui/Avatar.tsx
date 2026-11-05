import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { theme } from '../theme';
export function Avatar({ name, src, size = 42 }: { name: string; src?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
  return <View accessible accessibilityLabel={name} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {src && failed !== src ? <Image source={{ uri: src }} recyclingKey={src} onError={() => setFailed(src)} contentFit="cover" style={StyleSheet.absoluteFill} />
      : <Text variant="display" style={{ fontSize: size * 0.43, lineHeight: size * 0.65 }}>{initials}</Text>}
  </View>;
}
const styles = StyleSheet.create({ avatar: { overflow: 'hidden', borderColor: theme.colors.champagne, borderWidth: 1, backgroundColor: theme.colors.field, alignItems: 'center', justifyContent: 'center' } });
