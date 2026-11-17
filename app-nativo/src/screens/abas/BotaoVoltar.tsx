import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';

// Volta para a tela anterior; aberta direto (aviso, atalho), cai no Hoje.
export function voltarOuHoje() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BotaoVoltar({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={voltarOuHoje}
    style={({ pressed }) => [styles.botao, pressed && styles.apertado, style]}>
    <ChevronLeft size={22} color={theme.colors.secondary} strokeWidth={1.6} />
    <Text style={styles.rotulo}>Voltar</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  botao: { minHeight: 48, minWidth: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12, marginLeft: -6 },
  apertado: { opacity: 0.7 },
  rotulo: { fontSize: 16, lineHeight: 24, color: theme.colors.secondary, fontFamily: theme.fonts.medium },
});
