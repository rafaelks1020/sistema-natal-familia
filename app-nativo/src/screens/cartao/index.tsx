import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useQuery } from '@tanstack/react-query';
import Download from 'lucide-react-native/icons/download';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Share2 from 'lucide-react-native/icons/share-2';
import { api, baixarArquivo, sessionStore } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { enviarFoto, escolherFotos } from '../../upload';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';

// Cartão de Natal: monta a imagem 1080x1350 no servidor (GET /api/cartao/imagem) e a pessoa baixa ou compartilha.

type Modelo = 'meia-noite' | 'cereja' | 'flash';
const MODELOS: { id: Modelo; nome: string }[] = [
  { id: 'meia-noite', nome: 'Meia-Noite' },
  { id: 'cereja', nome: 'Cereja' },
  { id: 'flash', nome: 'Flash' },
];
const FRASE_PADRAO = 'Feliz Natal! Que a nossa mesa seja sempre cheia de amor.';
const FRASES = [
  FRASE_PADRAO,
  'Que o Natal una ainda mais a nossa família.',
  'Juntos, o Natal fica muito mais bonito.',
  'Paz, saúde e muita gente querida por perto.',
  'O melhor presente é ter vocês na ceia.',
];
const MAX_TEXTO = 120;
const MAX_ASSINATURA = 40;

const ehBlob = (u: string | null | undefined): u is string => !!u && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(u);

function caminhoImagem(foto: string, modelo: Modelo, texto: string, assinatura: string, baixar = false) {
  const q = new URLSearchParams({ foto, modelo, texto, assinatura });
  if (baixar) q.set('baixar', '1');
  return `/api/cartao/imagem?${q.toString()}`;
}

export default function Cartao() {
  const autenticado = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const avatar = user?.avatar_url ?? null;
  const [escolhida, setFoto] = useState<string | null>(null);
  const [modelo, setModelo] = useState<Modelo>('meia-noite');
  const [frase, setFrase] = useState<string>(FRASE_PADRAO);
  const [propria, setPropria] = useState(false);
  const [assinatura, setAssinatura] = useState((user?.name ?? '').slice(0, MAX_ASSINATURA));
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<'baixar' | 'compartilhar' | null>(null);
  const [previa, setPrevia] = useState<{ uri: string | null; carregando: boolean; erro: string | null }>({ uri: null, carregando: false, erro: null });
  const contador = useRef(0);

  const fotos = useQuery({
    queryKey: ['cartao-fotos', user?.id],
    enabled: autenticado,
    queryFn: ({ signal }) => api<{ avatar: string | null; fotos: string[] }>('/api/cartao/fotos', { signal }),
  });

  // Sem escolha ainda: foto do perfil; sem perfil, a primeira do álbum.
  const foto = escolhida ?? (ehBlob(avatar) ? avatar : null) ?? fotos.data?.fotos[0] ?? null;

  // A prévia espera 600 ms sem digitar. Cada pedido tem um número; só o último vale.
  useEffect(() => {
    if (!foto || !autenticado) return;
    const meu = ++contador.current;
    const geracao = sessionStore.getGeneration();
    const t = setTimeout(() => {
      setPrevia((p) => ({ ...p, carregando: true, erro: null }));
      baixarArquivo(caminhoImagem(foto, modelo, frase, assinatura), `cartao-previa-${Date.now()}.png`)
        .then((arq) => {
          if (meu !== contador.current || geracao !== sessionStore.getGeneration()) return;
          setPrevia({ uri: arq.uri, carregando: false, erro: null });
        })
        .catch((e: unknown) => {
          if (meu !== contador.current) return;
          setPrevia((p) => ({ ...p, carregando: false, erro: e instanceof Error ? e.message : 'Não deu para montar a prévia.' }));
        });
    }, 600);
    return () => clearTimeout(t);
  }, [foto, modelo, frase, assinatura, autenticado]);

  if (!autenticado) return null;

  const miniaturas = [...(fotos.data?.fotos ?? [])];
  if (ehBlob(avatar) && !miniaturas.includes(avatar)) miniaturas.unshift(avatar);
  if (foto && !miniaturas.includes(foto)) miniaturas.unshift(foto);

  async function novaFoto() {
    if (enviando) return;
    setEnviando(true);
    try {
      const escolhidas = await escolherFotos('galeria', 1);
      if (!escolhidas[0]) return;
      setFoto(await enviarFoto(escolhidas[0]));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para enviar a foto.', 'error');
    } finally {
      setEnviando(false);
    }
  }

  async function gerar(acao: 'baixar' | 'compartilhar') {
    if (!foto || ocupado) return;
    setOcupado(acao);
    try {
      if (acao === 'baixar') {
        const permissao = await requestPermissionsAsync(true, ['photo']);
        if (!permissao.granted) {
          toast('Permita salvar fotos nos Ajustes do aparelho para guardar o cartão.', 'error');
          return;
        }
      } else if (!(await Sharing.isAvailableAsync())) {
        toast('O compartilhamento não está disponível neste aparelho.', 'error');
        return;
      }
      const arq = await baixarArquivo(caminhoImagem(foto, modelo, frase, assinatura, true), `cartao-natal-${Date.now()}.png`);
      if (acao === 'baixar') {
        await Asset.create(arq.uri);
        toast('Cartão salvo na sua galeria.');
      } else {
        await Sharing.shareAsync(arq.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Enviar cartão de Natal' });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para preparar o cartão.', 'error');
    } finally {
      setOcupado(null);
    }
  }

  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Para mandar a quem você ama" titulo="Cartão de Natal" aoVoltar={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <View style={styles.conteudo}>
      <View style={styles.previa}>
        {previa.uri ? <Image source={{ uri: previa.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel="Prévia do seu cartão de Natal" />
          : <View style={styles.vazio}><Text variant="muted" style={styles.centro}>{foto ? 'Montando o cartão...' : 'Escolha uma foto para ver o cartão.'}</Text></View>}
        {previa.carregando && previa.uri ? <View style={styles.veu}><Skeleton style={styles.veuSkeleton} /></View> : null}
      </View>
      {previa.erro ? <Text accessibilityRole="alert" style={styles.erro}>{previa.erro}</Text> : null}

      <View style={styles.acoes}>
        <Button icon={<Share2 size={18} color={theme.colors.ivory} strokeWidth={1.5} />} disabled={!foto || !!ocupado} loading={ocupado === 'compartilhar'} onPress={() => { void gerar('compartilhar'); }}>Enviar no WhatsApp</Button>
        <Button variant="ghost" icon={<Download size={18} color={theme.colors.ivory} strokeWidth={1.5} />} disabled={!foto || !!ocupado} loading={ocupado === 'baixar'} onPress={() => { void gerar('baixar'); }}>Salvar na galeria</Button>
      </View>

      <Text variant="kicker">1. Foto</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotos}>
        <Pressable accessibilityRole="button" accessibilityLabel="Escolher outra foto da galeria" disabled={enviando} onPress={() => { void novaFoto(); }} style={[styles.miniatura, styles.nova]}>
          <ImagePlus size={20} color={theme.colors.secondary} strokeWidth={1.5} />
          <Text variant="muted" style={styles.novaTexto}>{enviando ? 'Enviando' : 'Nova'}</Text>
        </Pressable>
        {fotos.isPending ? <Skeleton style={styles.miniatura} /> : null}
        {miniaturas.map((u) => <Pressable key={u} accessibilityRole="button" accessibilityLabel="Usar esta foto" accessibilityState={{ selected: foto === u }} onPress={() => setFoto(u)}
          style={[styles.miniatura, foto === u && styles.miniaturaAtiva]}>
          <Image source={{ uri: u }} style={styles.imagemMini} contentFit="cover" />
        </Pressable>)}
      </ScrollView>

      <Text variant="kicker">2. Modelo</Text>
      <View style={styles.linha}>
        {MODELOS.map((m) => <Button key={m.id} style={styles.flex} variant={modelo === m.id ? 'primary' : 'ghost'} selected={modelo === m.id} onPress={() => setModelo(m.id)}>{m.nome}</Button>)}
      </View>

      <Text variant="kicker">3. Frase</Text>
      <View style={styles.frases}>
        {FRASES.map((f) => {
          const ativa = !propria && frase === f;
          return <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: ativa }} onPress={() => { setFrase(f); setPropria(false); }} style={[styles.frase, ativa && styles.fraseAtiva]}>
            <Text variant="muted" style={ativa ? styles.fraseTextoAtiva : undefined}>{f}</Text>
          </Pressable>;
        })}
        <Field label="Ou escreva a sua frase" multiline maxLength={MAX_TEXTO} value={propria ? frase : ''} onChangeText={(t) => { setPropria(true); setFrase(t); }} style={styles.multilinha} />
        <Text variant="muted" style={styles.contagem}>{propria ? frase.length : 0}/{MAX_TEXTO}</Text>
      </View>

      <Text variant="kicker">4. Assinatura</Text>
      <Field label="Quem assina" maxLength={MAX_ASSINATURA} value={assinatura} onChangeText={setAssinatura} />
      <Text variant="muted">O cartão também leva “Natal em Família” com o ano da ceia.</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 56 },
  conteudo: { paddingHorizontal: 24, gap: 16 },
  previa: { width: '100%', maxWidth: 380, alignSelf: 'center', aspectRatio: 1080 / 1350, borderRadius: theme.radius.card, overflow: 'hidden', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centro: { textAlign: 'center' },
  veu: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(23,27,24,0.45)' },
  veuSkeleton: { flex: 1, opacity: 0.3 },
  erro: { color: theme.colors.error, fontSize: 13, textAlign: 'center' },
  acoes: { gap: 10 },
  fotos: { gap: 8, paddingVertical: 2 },
  miniatura: { width: 76, height: 76, borderRadius: theme.radius.field, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: theme.colors.field },
  miniaturaAtiva: { borderColor: theme.colors.champagne },
  nova: { alignItems: 'center', justifyContent: 'center', gap: 2, borderStyle: 'dashed', borderColor: theme.colors.lineStrong },
  novaTexto: { fontSize: 11, lineHeight: 16 },
  imagemMini: { width: '100%', height: '100%' },
  linha: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  frases: { gap: 8 },
  frase: { minHeight: 44, borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  fraseAtiva: { borderColor: theme.colors.champagne },
  fraseTextoAtiva: { color: theme.colors.ivory },
  multilinha: { minHeight: 84, textAlignVertical: 'top' },
  contagem: { textAlign: 'right', fontSize: 12 },
});
