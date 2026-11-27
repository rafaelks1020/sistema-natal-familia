import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Lock from 'lucide-react-native/icons/lock';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Trophy from 'lucide-react-native/icons/trophy';
import { ApiError, api } from '../../api';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';

// Tela aberta ao tocar na notificação com pontos surpresa (rota /bonus/<codigo> dentro do push).
type Resultado = { ok: boolean; ganhou: boolean; ja_resgatado: boolean; pontos: number; titulo: string };
type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'ganhou'; dados: Resultado }
  | { tipo: 'ja'; dados: Resultado }
  | { tipo: 'expirou' }
  | { tipo: 'nao-existe' }
  | { tipo: 'erro'; mensagem: string };

const textoPontos = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'ponto' : 'pontos'}`;
function voltar() { if (router.canGoBack()) router.back(); else router.replace('/'); }

export default function Bonus() {
  const autenticado = useAutenticado();
  const { codigo } = useLocalSearchParams<{ codigo?: string | string[] }>();
  const codigoTexto = Array.isArray(codigo) ? (codigo[0] ?? '') : (codigo ?? '');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const iniciou = useRef(false);

  const resgatar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const dados = await api<Resultado>('/api/bonus/resgatar', { method: 'POST', json: { codigo: codigoTexto } });
      setEstado(dados.ja_resgatado ? { tipo: 'ja', dados } : { tipo: 'ganhou', dados });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setEstado({ tipo: 'nao-existe' });
      else if (e instanceof ApiError && e.status === 410) setEstado({ tipo: 'expirou' });
      else setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Não deu certo. Tente novamente.' });
    }
  }, [codigoTexto]);

  useEffect(() => {
    // Um resgate só por abertura da tela.
    if (!autenticado || !codigoTexto || iniciou.current) return;
    iniciou.current = true;
    void resgatar();
  }, [autenticado, codigoTexto, resgatar]);

  if (!autenticado) return null;
  const irParaPontos = () => router.replace('/pontos');

  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Natal em Família" titulo="Bônus surpresa" aoVoltar={voltar} />
    <View style={styles.conteudo}>
      {estado.tipo === 'carregando' ? <Skeleton style={{ minHeight: 220 }} />
        : estado.tipo === 'ganhou' ? <Surface style={styles.cartao} accessibilityLabel={`Você ganhou ${textoPontos(estado.dados.pontos)}`}>
          <Sparkles size={36} color={theme.colors.champagne} strokeWidth={1.4} />
          <Text variant="kicker">{estado.dados.titulo}</Text>
          <View style={styles.numeroLinha}>
            <Text variant="numeral" style={styles.numeroGrande}>+{estado.dados.pontos.toLocaleString('pt-BR')}</Text>
            <Text variant="display" style={styles.unidade}>{estado.dados.pontos === 1 ? 'ponto' : 'pontos'}</Text>
          </View>
          <Text variant="display" style={styles.titulo}>Você ganhou {textoPontos(estado.dados.pontos)}!</Text>
          <Text variant="muted" style={styles.centro}>Os pontos entram no Campeão do Natal e aparecem em Meus pontos em até 5 minutos.</Text>
          <Button onPress={irParaPontos} icon={<Trophy size={18} color={theme.colors.ivory} strokeWidth={1.6} />}>Ver meus pontos</Button>
        </Surface>
        : estado.tipo === 'ja' ? <Surface style={styles.cartao}>
          <Trophy size={36} color={theme.colors.champagne} strokeWidth={1.4} />
          <Text variant="kicker">{estado.dados.titulo}</Text>
          <Text variant="display" style={styles.titulo}>Você já resgatou este bônus</Text>
          <Text variant="muted" style={styles.centro}>Os {textoPontos(estado.dados.pontos)} já estão na sua conta. Cada pessoa resgata uma vez só.</Text>
          <Button onPress={irParaPontos}>Ver meus pontos</Button>
        </Surface>
        : estado.tipo === 'expirou' ? <Surface style={styles.cartao}>
          <Lock size={36} color={theme.colors.champagne} strokeWidth={1.4} />
          <Text variant="display" style={styles.titulo}>Esse bônus já expirou</Text>
          <Text variant="muted" style={styles.centro}>O prazo acabou. Fique de olho nas próximas notificações: de vez em quando tem ponto surpresa.</Text>
          <Button variant="ghost" onPress={irParaPontos}>Ver meus pontos</Button>
        </Surface>
        : estado.tipo === 'nao-existe' ? <Surface style={styles.cartao}>
          <Lock size={36} color={theme.colors.champagne} strokeWidth={1.4} />
          <Text variant="display" style={styles.titulo}>Bônus não encontrado</Text>
          <Text variant="muted" style={styles.centro}>Esse link não vale mais. O bônus só pode ser aberto pela notificação.</Text>
          <Button variant="ghost" onPress={irParaPontos}>Ver meus pontos</Button>
        </Surface>
        : <Surface style={styles.cartao}>
          <Text variant="display" style={styles.titulo}>Não foi possível resgatar</Text>
          <Text variant="muted" style={styles.centro}>{estado.mensagem}</Text>
          <Button onPress={() => { void resgatar(); }}>Tentar novamente</Button>
        </Surface>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, gap: 24, paddingTop: 8 },
  cartao: { gap: 14, alignItems: 'center', borderColor: 'rgba(191,165,119,0.4)', padding: 24 },
  centro: { textAlign: 'center' },
  titulo: { fontSize: 28, lineHeight: 36, textAlign: 'center' },
  numeroLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  numeroGrande: { fontSize: 60, lineHeight: 72, color: theme.colors.champagne },
  unidade: { fontSize: 26, lineHeight: 36, color: theme.colors.champagne },
});
