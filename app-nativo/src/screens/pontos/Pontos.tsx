import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Lock from 'lucide-react-native/icons/lock';
import MicVocal from 'lucide-react-native/icons/mic-vocal';
import Plus from 'lucide-react-native/icons/plus';
import Trophy from 'lucide-react-native/icons/trophy';
import { theme } from '../../theme';
import { abrirNoSite } from '../../web';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';
import { usePontos } from './dados';
import { dataHoraCurtaSP, maisPontos, situacaoSugestao } from './logica';

function voltar() { if (router.canGoBack()) router.back(); else router.replace('/'); }

function Secao({ kicker, titulo, texto, children }: { kicker: string; titulo: string; texto?: string; children: ReactNode }) {
  return <View style={styles.secao}>
    <View style={styles.secaoTopo}>
      <Text variant="kicker">{kicker}</Text>
      <Text variant="display" accessibilityRole="header" style={styles.secaoTitulo}>{titulo}</Text>
      {texto ? <Text variant="muted">{texto}</Text> : null}
    </View>
    {children}
  </View>;
}

function LinhaToque({ titulo, texto, onPress, rotulo }: { titulo: string; texto: string; onPress: () => void; rotulo: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={onPress} style={[styles.linha, styles.linhaBorda]}>
    <View style={styles.flex}><Text>{titulo}</Text><Text variant="muted">{texto}</Text></View>
    <ChevronRight size={22} color={theme.colors.champagne} strokeWidth={1.6} />
  </Pressable>;
}

export default function Pontos() {
  const autenticado = useAutenticado();
  const consulta = usePontos();
  if (!autenticado) return null;
  const p = consulta.data;
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
    <Cabecalho kicker={p ? `Natal de ${p.ano}` : 'Natal em Família'} titulo="Meus pontos" aoVoltar={voltar} />
    <View style={styles.conteudo}>
      {consulta.isPending ? <><Skeleton style={{ minHeight: 220 }} /><Skeleton style={{ minHeight: 160 }} /></>
        : !p ? <EmptyState title="Não foi possível abrir seus pontos" message={consulta.error?.message ?? 'Tente de novo em instantes.'} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} />
        : <>
          <Surface style={styles.resumo} accessibilityLabel="Seus pontos">
            <Text variant="kicker">Você tem</Text>
            <View style={styles.numeroLinha}>
              <Text variant="numeral" style={styles.numeroGrande}>{p.total.toLocaleString('pt-BR')}</Text>
              <Text variant="display" style={styles.unidade}>{p.total === 1 ? 'ponto' : 'pontos'}</Text>
            </View>
            <View style={styles.inline}>
              {p.posicao !== null ? <Trophy size={20} color={theme.colors.champagne} strokeWidth={1.6} /> : <Lock size={20} color={theme.colors.champagne} strokeWidth={1.6} />}
              <Text style={[styles.flex, styles.destaque]}>{p.posicao !== null ? `Você está em ${p.posicao}º lugar na família` : 'Sua posição fica em segredo até a festa'}</Text>
            </View>
            <Text>{p.encerrado ? 'A contagem de pontos terminou. O Campeão do Natal é revelado na TV da festa.' : 'Quem tiver mais pontos na noite de Natal é o Campeão do Natal e ganha um brinde.'}</Text>
            <Text variant="muted">Os pontos não se trocam por nada: servem para a classificação da família.{p.encerrado ? '' : ' Ponto novo leva até 5 minutos para aparecer aqui.'}</Text>
          </Surface>

          <Secao kicker="É só participar" titulo="Como ganhar pontos" texto={p.sugestoes.length ? 'Toque em uma linha para ir direto fazer.' : undefined}>
            {p.sugestoes.length ? <Surface style={styles.lista}>
              {p.sugestoes.map((s, i) => {
                const { texto, completo } = situacaoSugestao(s);
                return <Pressable key={s.regra} accessibilityRole="button" accessibilityLabel={`${s.titulo}. ${texto} ${maisPontos(s.pontos)}`}
                  onPress={() => router.push(s.href as Href)} style={[styles.linha, i > 0 && styles.linhaBorda]}>
                  <View style={[styles.circulo, completo && styles.circuloCompleto]}>
                    {completo ? <Check size={20} color={theme.colors.ivory} strokeWidth={2} /> : <Plus size={20} color={theme.colors.champagne} strokeWidth={1.8} />}
                  </View>
                  <View style={styles.flex}><Text style={styles.medio}>{s.titulo}</Text><Text variant="muted">{texto}</Text></View>
                  <Text style={styles.valor}>{maisPontos(s.pontos)}</Text>
                </Pressable>;
              })}
            </Surface> : null}
            <Surface style={styles.lista}>
              <Text accessibilityRole="header" style={styles.subtitulo}>{p.encerrado ? 'O que valeu pontos' : 'Também valem pontos'}</Text>
              <View style={[styles.linha, styles.linhaBorda]}><View style={styles.flex}><Text>Abrir o aplicativo</Text><Text variant="muted">5 pontos por dia. Conta sozinho, é só entrar.</Text></View></View>
              <LinhaToque titulo="Missões relâmpago" texto="Um desafio surpresa, com prazo. De 20 a 80 pontos." rotulo="Abrir as missões relâmpago" onPress={() => router.push('/missoes')} />
              <LinhaToque titulo={`Conquistas (${p.conquistas_ganhas} de ${p.conquistas_total})`} texto="Prêmios por participar bastante. De 20 a 250 pontos cada." rotulo="Abrir as conquistas" onPress={() => router.push('/conquistas')} />
              <View style={[styles.linha, styles.linhaBorda]}><View style={styles.flex}><Text>Na noite de Natal</Text><Text variant="muted">Quiz, bingo, karaokê e brincadeiras também valem pontos.</Text></View></View>
            </Surface>
          </Secao>

          <Secao kicker="Disputa saudável da família" titulo="Ranking do Natal" texto={p.ranking !== null && !p.encerrado ? `Aparece até ${dataHoraCurtaSP(p.ranking_oculto_em)}` : undefined}>
            {p.ranking === null ? <Surface style={styles.segredo}>
              <View style={styles.cadeado}><Lock size={22} color={theme.colors.champagne} strokeWidth={1.6} /></View>
              <Text variant="display" style={styles.tituloCartao}>A classificação está em segredo: o resultado sai na festa</Text>
              <Text variant="muted">Nos últimos dias ninguém vê a posição de ninguém, para manter a surpresa. Continue participando: os pontos seguem valendo até o fim.</Text>
            </Surface> : p.ranking.length === 0 ? <Surface><Text variant="muted">Os primeiros pontos da família vão aparecer aqui assim que a participação começar.</Text></Surface>
              : <Surface style={styles.lista}>
                {p.ranking.map((linha, i) => {
                  const souEu = linha.user_id === p.user_id;
                  return <View key={linha.user_id} accessible accessibilityLabel={`${linha.posicao}º lugar, ${linha.nome}${souEu ? ', você' : ''}, ${linha.total.toLocaleString('pt-BR')} pontos`}
                    style={[styles.linha, i > 0 && styles.linhaBorda]}>
                    <Text variant="numeral" style={[styles.posicao, souEu && styles.destaque]}>{linha.posicao}º</Text>
                    <Avatar name={linha.nome} src={linha.avatar_url} size={44} />
                    <Text style={[styles.flex, souEu && styles.destaque]} numberOfLines={2}>{linha.nome}{souEu ? ' (você)' : ''}</Text>
                    <Text style={styles.valorLinha}>{linha.total.toLocaleString('pt-BR')} {linha.total === 1 ? 'ponto' : 'pontos'}</Text>
                  </View>;
                })}
              </Surface>}
          </Secao>

          <Secao kicker="Para que servem os pontos" titulo="Os dois brindes da noite" texto="Na noite de Natal a família conhece dois vencedores, revelados na TV da festa.">
            <Surface style={[styles.brinde, { borderColor: 'rgba(191,165,119,0.4)' }]}>
              <View style={styles.inline}>
                <View style={styles.cadeado}><Trophy size={20} color={theme.colors.champagne} strokeWidth={1.6} /></View>
                <View style={styles.flex}><Text variant="kicker">1º Brinde</Text><Text variant="display" style={styles.tituloCartao}>Campeão do Natal</Text></View>
              </View>
              <Text variant="muted">Para quem tiver mais pontos. Vale tudo o que está na lista Como ganhar pontos: recados, fotos, Advento, brincadeiras da festa, karaokê, missões e conquistas.</Text>
            </Surface>
            <Surface style={[styles.brinde, { borderColor: 'rgba(197,41,45,0.4)' }]}>
              <View style={styles.inline}>
                <View style={[styles.cadeado, { borderColor: 'rgba(197,41,45,0.6)' }]}><MicVocal size={20} color={theme.colors.cherry} strokeWidth={1.6} /></View>
                <View style={styles.flex}><Text variant="kicker">2º Brinde</Text><Text variant="display" style={styles.tituloCartao}>Voz do Natal</Text></View>
              </View>
              <Text variant="muted">Para quem vencer a Prova do Karaokê, que não depende destes pontos: 5 músicas oficiais no nível Difícil, uma tentativa por música, e a final ao vivo na noite de Natal. A mesma pessoa pode ganhar os dois brindes.</Text>
            </Surface>
            <Surface style={styles.brinde}>
              <Text style={styles.medio}>Regras de justiça</Text>
              <Text variant="muted">Carona e dinheiro (vaquinha ou pagamentos) não dão pontos, para ninguém levar vantagem por ter mais dinheiro. As conquistas ligadas a dinheiro valem 0 pontos: são só uma lembrança.</Text>
              <Text variant="muted">Os pontos contam até {dataHoraCurtaSP(p.encerra_em)}. A classificação aparece até {dataHoraCurtaSP(p.ranking_oculto_em)} e depois fica em segredo até ser revelada na TV da festa.</Text>
            </Surface>
          </Secao>

          <Secao kicker="Para quem quer os detalhes" titulo="Tabela completa de pontos" texto="O dia vira à meia-noite, no horário de Brasília. O que for apagado deixa de contar.">
            {p.regras.length === 0 ? <Surface><Text variant="muted">A tabela será carregada em instantes.</Text></Surface> : <Surface style={styles.lista}>
              {p.regras.map((r, i) => <View key={r.regra} style={[styles.linha, styles.topo, i > 0 && styles.linhaBorda]}>
                <View style={styles.flex}><Text style={styles.medio}>{r.titulo}</Text><Text variant="muted">{r.teto ? `Limite: ${r.teto}` : 'Vale toda vez'}</Text></View>
                <Text style={styles.valorRegra}>{r.pontos}</Text>
              </View>)}
            </Surface>}
          </Secao>

          <View style={styles.extrato}>
            <Button variant="ghost" onPress={() => { void abrirNoSite('/pontos'); }}>Ver meu extrato completo</Button>
            <Text variant="muted" style={styles.centro}>Abre no navegador</Text>
          </View>
        </>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, gap: 36, paddingTop: 8 },
  flex: { flex: 1, minWidth: 0 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 12 }, centro: { textAlign: 'center' },
  resumo: { gap: 14, borderColor: 'rgba(191,165,119,0.4)', padding: 24 },
  numeroLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  numeroGrande: { fontSize: 60, lineHeight: 72, color: theme.colors.champagne }, unidade: { fontSize: 26, lineHeight: 36, color: theme.colors.champagne },
  destaque: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold },
  secao: { gap: 16 }, secaoTopo: { gap: 6 }, secaoTitulo: { fontSize: 32, lineHeight: 40 },
  lista: { paddingVertical: 4, paddingHorizontal: 16, gap: 0 },
  subtitulo: { fontFamily: theme.fonts.semibold, paddingTop: 14, paddingBottom: 6 },
  linha: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  topo: { alignItems: 'flex-start' },
  linhaBorda: { borderTopWidth: 1, borderColor: theme.colors.line },
  medio: { fontFamily: theme.fonts.medium },
  circulo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(191,165,119,0.5)', alignItems: 'center', justifyContent: 'center' },
  circuloCompleto: { borderColor: theme.colors.sage, backgroundColor: theme.colors.sage },
  valor: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold, fontSize: 15, textAlign: 'right', maxWidth: 110 },
  posicao: { fontSize: 24, lineHeight: 32, minWidth: 44, color: theme.colors.champagne },
  valorLinha: { fontFamily: theme.fonts.semibold, fontSize: 15, textAlign: 'right', maxWidth: 110 },
  valorRegra: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold, fontSize: 17, textAlign: 'right', maxWidth: '42%' },
  segredo: { gap: 12, borderColor: 'rgba(191,165,119,0.4)' },
  cadeado: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(191,165,119,0.5)', alignItems: 'center', justifyContent: 'center' },
  tituloCartao: { fontSize: 24, lineHeight: 32 }, brinde: { gap: 12 },
  extrato: { gap: 10 },
});
