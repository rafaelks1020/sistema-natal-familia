import type { JSX } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { definirLetra, marcarPerguntaLetra, useLetraCarregada, useNivelLetra, usePerguntouLetra, type NivelLetra } from '../letra';
import { theme } from '../theme';
import { Button } from './Button';
import { Surface } from './Surface';
import { Text } from './Text';

const OPCOES: { nivel: NivelLetra; rotulo: string; amostra: number }[] = [
  { nivel: 'normal', rotulo: 'Normal', amostra: 18 },
  { nivel: 'grande', rotulo: 'Grande', amostra: 22 },
  { nivel: 'maior', rotulo: 'Muito grande', amostra: 26 },
];

export function TamanhoDaLetra(): JSX.Element {
  const nivel = useNivelLetra();
  return <View style={styles.linha}>
    {OPCOES.map((opcao) => {
      const escolhido = nivel === opcao.nivel;
      return <Pressable
        key={opcao.nivel}
        accessibilityRole="button"
        accessibilityLabel={opcao.rotulo}
        accessibilityState={{ selected: escolhido }}
        onPress={() => { void definirLetra(opcao.nivel); }}
        style={[styles.botao, escolhido && styles.escolhido]}
      >
        <Text style={{ fontSize: opcao.amostra, lineHeight: Math.round(opcao.amostra * 1.25) }}>Aa</Text>
        <Text style={styles.rotulo}>{opcao.rotulo}</Text>
      </Pressable>;
    })}
  </View>;
}

export function PerguntaLetra(): JSX.Element | null {
  const perguntou = usePerguntouLetra();
  const carregada = useLetraCarregada();
  if (!carregada || perguntou) return null;
  function responder(proximo: NivelLetra) {
    void definirLetra(proximo);
    marcarPerguntaLetra();
  }
  return <Surface style={styles.cartao}>
    <Text accessibilityRole="header" style={styles.titulo}>As letras estão boas de ler?</Text>
    <Text variant="muted">Dá para mudar depois, na aba Eu.</Text>
    <Button onPress={() => responder('grande')}>Quero letras maiores</Button>
    <Button variant="ghost" onPress={() => responder('normal')}>Estão boas assim</Button>
  </Surface>;
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 8 },
  botao: {
    flex: 1,
    minHeight: 72,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  escolhido: { borderColor: theme.colors.champagne },
  rotulo: { fontSize: 14, lineHeight: 18, textAlign: 'center', fontFamily: theme.fonts.medium },
  cartao: { gap: 12 },
  titulo: { fontFamily: theme.fonts.semibold, fontSize: 20, lineHeight: 28 },
});
