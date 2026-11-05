import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../../api';
import { theme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { LoopVideo } from '../../ui/LoopVideo';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';
import { Painel } from './Painel';
import { Porta } from './Porta';
import { adventoKeys, dois, faltaPara, type CalendarioAdvento } from './data';

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function Advento() {
  const autenticado = useAutenticado();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [agora, setAgora] = useState(() => Date.now());
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const ultimoAviso = useRef(0);
  const consulta = useQuery({
    queryKey: adventoKeys.calendario,
    queryFn: ({ signal }) => api<CalendarioAdvento>('/api/advento', { signal }),
    enabled: autenticado,
  });
  const cal = consulta.data;

  useEffect(() => { if (consulta.error) toast(consulta.error.message, 'error'); }, [consulta.error, toast]);
  useEffect(() => {
    if (cal?.fase !== 'antes') return;
    const id = setInterval(() => {
      const agoraTick = Date.now();
      setAgora(agoraTick);
      if (agoraTick >= new Date(cal.abre_em).getTime() && agoraTick - ultimoAviso.current > 15000) {
        ultimoAviso.current = agoraTick;
        void queryClient.invalidateQueries({ queryKey: adventoKeys.calendario });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cal?.fase, cal?.abre_em]);

  if (!autenticado) return null;
  if (escolhido != null) return <Painel key={escolhido} dia={escolhido} onVoltar={() => setEscolhido(null)} />;

  const miolo = Math.min(width, 720) - 48;
  const lado = Math.max(44, Math.floor((miolo - 24) / 4));
  if (consulta.isPending || !cal) {
    return (
      <View style={styles.pagina}>
        <Cabecalho kicker="Dezembro" titulo="Advento" aoVoltar={voltar} />
        {consulta.isPending
          ? <View style={styles.corpo}><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 280 }} /></View>
          : <EmptyState title="O calendário já volta" message={consulta.error?.message ?? 'Não conseguimos abrir o Advento.'} action="Tentar de novo" onAction={() => { void consulta.refetch(); }} />}
      </View>
    );
  }

  const falta = cal.fase === 'antes' ? faltaPara(cal.abre_em, agora) : null;
  const partes = falta ? [
    ['dias', String(falta.dias)],
    ['horas', dois(falta.horas)],
    ['min', dois(falta.minutos)],
    ['seg', dois(falta.segundos)],
  ] as const : [];

  return (
    <View style={styles.pagina}>
      <Cabecalho kicker={`Edição ${cal.ano}`} titulo="Advento" aoVoltar={voltar} />
      <ScrollView
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}
      >
        <View style={styles.corpo}>
          <Text variant="muted">Uma portinha por dia, de 1 a 24 de dezembro. Toque para abrir. O visto marca o que você já respondeu.</Text>
          {falta ? (
            <View style={styles.contagem} accessibilityLabel="Contagem até o dia 1º de dezembro">
              <View style={styles.linha}>
                <LoopVideo name="mn-countdown" style={styles.video} />
                <View style={styles.flex}>
                  <Text variant="kicker">Até 1º de dezembro</Text>
                  <Text variant="display" style={styles.tituloFechado}>O calendário ainda está fechado</Text>
                </View>
              </View>
              <Text variant="muted">Na meia-noite do dia 1º, a primeira janela abre para a família.</Text>
              <View style={styles.relogio}>
                {partes.map(([nome, valor]) => (
                  <View key={nome} style={styles.celula}>
                    <Text variant="numeral" style={styles.digito}>{valor}</Text>
                    <Text variant="muted" style={styles.unidade}>{nome}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {cal.organizador && cal.fase === 'antes' ? <Text style={styles.aviso}>Você pode preparar as janelas antes. A família só vê cada uma no dia.</Text> : null}
          <View style={styles.grade} accessibilityLabel="Janelas de 1 a 24 de dezembro">
            {cal.janelas.map((janela) => (
              <Porta
                key={janela.dia}
                janela={janela}
                hoje={cal.dia_de_hoje}
                lado={lado}
                organizador={cal.organizador}
                onAbrir={() => setEscolhido(janela.dia)}
                onTrancada={() => toast(cal.fase === 'antes' ? 'O calendário abre à meia-noite do dia 1º de dezembro.' : `Esta janela abre no dia ${janela.dia} de dezembro.`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  lista: { paddingBottom: 32 },
  corpo: { paddingHorizontal: 24, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contagem: { gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  video: { width: 56, height: 56, borderRadius: 14 },
  tituloFechado: { fontSize: 26, lineHeight: 32, marginTop: 4 },
  relogio: { flexDirection: 'row', gap: 8 },
  celula: { flex: 1, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  digito: { fontSize: 26, lineHeight: 32 },
  unidade: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  aviso: { color: theme.colors.champagne },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
