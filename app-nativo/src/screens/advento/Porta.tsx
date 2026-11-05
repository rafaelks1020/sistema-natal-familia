import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Check from 'lucide-react-native/icons/check';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';
import { useReduceMotion } from '../../ui/motion';
import { ROTULO, type JanelaGrade } from './data';

export function Porta({ janela, hoje, lado, organizador, onAbrir, onTrancada }: {
  janela: JanelaGrade;
  hoje: number | null;
  lado: number;
  organizador: boolean;
  onAbrir: () => void;
  onTrancada: () => void;
}) {
  const reduced = useReduceMotion();
  const giro = useSharedValue(0);
  const ocupada = useRef(false);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${giro.get()}deg` }],
  }));

  function concluir() {
    giro.set(0);
    ocupada.current = false;
    onAbrir();
  }
  function liberar() {
    ocupada.current = false;
  }
  function tocar() {
    if (ocupada.current) return;
    if (!janela.liberada && !organizador) {
      onTrancada();
      return;
    }
    if (reduced) {
      onAbrir();
      return;
    }
    ocupada.current = true;
    giro.set(withTiming(-88, { duration: 640, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(concluir)();
      else runOnJS(liberar)();
    }));
  }

  const aberta = janela.respondida || janela.abriu;
  const borda = janela.respondida || janela.abriu
    ? theme.colors.champagne
    : janela.dia === hoje
      ? theme.colors.cherry
      : janela.liberada
        ? 'rgba(191,165,119,0.45)'
        : theme.colors.line;
  const fundo = aberta ? theme.colors.field : theme.colors.surface;
  const estado = !janela.liberada
    ? (organizador ? 'ainda fechada para a família' : `abre no dia ${janela.dia} de dezembro`)
    : janela.respondida
      ? 'você já respondeu'
      : janela.abriu
        ? 'você já abriu'
        : 'aberta';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Janela ${janela.dia}, ${estado}${janela.dia === hoje ? ', hoje' : ''}`}
      onPress={tocar}
      style={[styles.caixa, { width: lado, height: Math.round(lado * 1.25) }]}
    >
      <Animated.View style={[styles.face, estilo, { borderColor: borda, backgroundColor: fundo }]}>
        {janela.personalizada ? <View style={styles.ponto} /> : null}
        <Text variant="numeral" style={styles.numero}>{janela.dia}</Text>
        {janela.dia === hoje && !janela.respondida ? <Text variant="kicker" style={styles.hoje}>Hoje</Text> : null}
        {janela.abriu && janela.tipo ? <Text variant="muted" style={styles.tipo} numberOfLines={1}>{ROTULO[janela.tipo]}</Text> : null}
        {janela.respondida ? <View style={styles.visto}><Check size={14} color={theme.colors.champagne} strokeWidth={2} /></View> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caixa: { overflow: 'hidden', borderRadius: 14 },
  face: { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numero: { fontSize: 28, lineHeight: 36 },
  hoje: { marginTop: 2, fontSize: 8, letterSpacing: 1 },
  tipo: { marginTop: 2, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  visto: { position: 'absolute', top: 6, right: 6 },
  ponto: { position: 'absolute', top: 8, left: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.champagne },
});
