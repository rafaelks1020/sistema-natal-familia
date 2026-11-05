import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from '@tanstack/react-query';
import Camera from 'lucide-react-native/icons/camera';
import Trash2 from 'lucide-react-native/icons/trash-2';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { timeAgo } from '../../format';
import { useSession } from '../../session';
import { escolherFotos, enviarFoto, type FotoLocal } from '../../upload';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { sessaoVigente } from '../familia/sessao';
import { ModerationActions } from '../moderacao/Actions';
import { adventoKeys, ROTULO, TIPOS, type CalendarioAdvento, type DiaAdvento, type TipoAdvento } from './data';

const AJUDA: Record<TipoAdvento, string> = {
  foto: 'Mande uma foto e uma frase para a família.',
  receita: 'Escreva o modo de fazer. A foto do prato é por sua conta.',
  enquete: 'Escolha uma opção. Se mudar de ideia, é só votar de novo.',
  desafio: 'Mande a foto do desafio e uma frase.',
  pergunta: 'Conte a sua resposta. A foto fica por sua conta.',
};

function marcarCalendario(dia: number, respondida: boolean) {
  queryClient.setQueryData<CalendarioAdvento>(adventoKeys.calendario, (atual) => {
    if (!atual) return atual;
    return {
      ...atual,
      janelas: atual.janelas.map((item) => item.dia === dia ? { ...item, abriu: true, respondida } : item),
    };
  });
}

export function Painel({ dia, onVoltar }: { dia: number; onVoltar: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const escolhendo = useRef(false);
  const marcou = useRef(false);
  const consulta = useQuery({
    queryKey: adventoKeys.dia(dia),
    queryFn: ({ signal }) => api<DiaAdvento>(`/api/advento/${dia}`, { signal }),
  });
  const dados = consulta.data;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [fotoResposta, setFotoResposta] = useState<FotoLocal | null>(null);
  const [tipo, setTipo] = useState<TipoAdvento>('pergunta');
  const [titulo, setTitulo] = useState('');
  const [textoJanela, setTextoJanela] = useState('');
  const [opcoesTexto, setOpcoesTexto] = useState('');
  const [fotoJanelaUrl, setFotoJanelaUrl] = useState<string | null>(null);
  const [fotoJanelaNova, setFotoJanelaNova] = useState<FotoLocal | null>(null);
  const copiou = useRef(false);

  useEffect(() => {
    if (!dados || copiou.current) return;
    copiou.current = true;
    setTipo(dados.tipo);
    setTitulo(dados.titulo);
    setTextoJanela(dados.texto);
    setOpcoesTexto((dados.opcoes ?? []).join('\n'));
    setFotoJanelaUrl(dados.image_url);
  }, [dados]);

  useEffect(() => {
    if (!dados || dados.abriu || marcou.current) return;
    marcou.current = true;
    const generation = sessionStore.getGeneration();
    void api(`/api/advento/${dia}/abrir`, { method: 'POST' }).then(() => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData<DiaAdvento>(adventoKeys.dia(dia), (atual) => atual ? { ...atual, abriu: true } : atual);
      marcarCalendario(dia, dados.respondida);
    }).catch(() => { marcou.current = false; });
  }, [dados, dia]);

  useEffect(() => { if (consulta.error) toast(consulta.error.message, 'error'); }, [consulta.error, toast]);

  const votar = useMutation({
    mutationFn: async (opcao: string) => {
      const generation = sessionStore.getGeneration();
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const salvo = await api<DiaAdvento>(`/api/advento/${dia}/voto`, { method: 'POST', json: { opcao } });
      return { salvo, generation };
    },
    onMutate: async (opcao) => {
      await queryClient.cancelQueries({ queryKey: adventoKeys.dia(dia) });
      const previous = queryClient.getQueryData<DiaAdvento>(adventoKeys.dia(dia));
      const generation = sessionStore.getGeneration();
      if (previous && sessaoVigente(generation)) {
        const votos = previous.votos.map((item) => {
          let total = item.total;
          if (item.opcao === previous.meu_voto) total = Math.max(0, total - 1);
          if (item.opcao === opcao) total += 1;
          return { ...item, total };
        });
        queryClient.setQueryData<DiaAdvento>(adventoKeys.dia(dia), {
          ...previous,
          votos,
          meu_voto: opcao,
          total_votos: votos.reduce((soma, item) => soma + item.total, 0),
          respondida: true,
          abriu: true,
        });
      }
      return { previous, generation };
    },
    onError: (error, _opcao, ctx) => {
      if (ctx && sessaoVigente(ctx.generation) && ctx.previous) queryClient.setQueryData(adventoKeys.dia(dia), ctx.previous);
      toast(error.message, 'error');
    },
    onSuccess: ({ salvo, generation }) => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData(adventoKeys.dia(dia), salvo);
      marcarCalendario(dia, salvo.respondida);
    },
  });

  const responder = useMutation({
    mutationFn: async (entrada: { texto: string; foto: FotoLocal | null }) => {
      const generation = sessionStore.getGeneration();
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const image = entrada.foto ? await enviarFoto(entrada.foto) : null;
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const salvo = await api<DiaAdvento>(`/api/advento/${dia}/resposta`, { method: 'POST', json: { texto: entrada.texto, image_url: image } });
      return { salvo, generation };
    },
    onMutate: async (entrada) => {
      await queryClient.cancelQueries({ queryKey: adventoKeys.dia(dia) });
      const previous = queryClient.getQueryData<DiaAdvento>(adventoKeys.dia(dia));
      const generation = sessionStore.getGeneration();
      if (previous && user && sessaoVigente(generation)) {
        queryClient.setQueryData<DiaAdvento>(adventoKeys.dia(dia), {
          ...previous,
          abriu: true,
          respondida: true,
          respostas: [...previous.respostas, {
            id: -Date.now(),
            user_id: user.id,
            user_name: user.name,
            avatar_url: user.avatar_url,
            texto: entrada.texto,
            image_url: null,
            created_at: new Date().toISOString(),
            minha: true,
          }],
        });
      }
      return { previous, generation };
    },
    onError: (error, _entrada, ctx) => {
      if (ctx && sessaoVigente(ctx.generation) && ctx.previous) queryClient.setQueryData(adventoKeys.dia(dia), ctx.previous);
      toast(error.message, 'error');
    },
    onSuccess: ({ salvo, generation }) => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData(adventoKeys.dia(dia), salvo);
      marcarCalendario(dia, true);
      setTexto('');
      setFotoResposta(null);
      toast('Resposta guardada.');
    },
  });

  const apagar = useMutation({
    mutationFn: async (id: number) => {
      const generation = sessionStore.getGeneration();
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const salvo = await api<DiaAdvento>(`/api/advento/respostas/${id}`, { method: 'DELETE' });
      return { salvo, generation };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: adventoKeys.dia(dia) });
      const previous = queryClient.getQueryData<DiaAdvento>(adventoKeys.dia(dia));
      const generation = sessionStore.getGeneration();
      if (previous && sessaoVigente(generation)) {
        const respostas = previous.respostas.filter((item) => item.id !== id);
        queryClient.setQueryData<DiaAdvento>(adventoKeys.dia(dia), {
          ...previous,
          respostas,
          respondida: respostas.some((item) => item.minha) || (previous.tipo === 'enquete' && previous.meu_voto != null),
        });
      }
      return { previous, generation };
    },
    onError: (error, _id, ctx) => {
      if (ctx && sessaoVigente(ctx.generation) && ctx.previous) queryClient.setQueryData(adventoKeys.dia(dia), ctx.previous);
      toast(error.message, 'error');
    },
    onSuccess: ({ salvo, generation }) => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData(adventoKeys.dia(dia), salvo);
      marcarCalendario(dia, salvo.respondida);
      toast('Resposta apagada.');
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const generation = sessionStore.getGeneration();
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const image = fotoJanelaNova ? await enviarFoto(fotoJanelaNova) : fotoJanelaUrl;
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const salvo = await api<DiaAdvento>(`/api/advento/janelas/${dia}`, {
        method: 'PUT',
        json: { tipo, titulo, texto: textoJanela, image_url: image, opcoes: tipo === 'enquete' ? opcoesTexto.split('\n') : null },
      });
      return { salvo, generation };
    },
    onSuccess: ({ salvo, generation }) => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData(adventoKeys.dia(dia), salvo);
      queryClient.setQueryData<CalendarioAdvento>(adventoKeys.calendario, (atual) => atual ? {
        ...atual,
        janelas: atual.janelas.map((item) => item.dia !== dia ? item : {
          ...item, tipo: salvo.tipo, titulo: salvo.titulo, texto: salvo.texto, image_url: salvo.image_url, opcoes: salvo.opcoes, personalizada: salvo.personalizada,
        }),
      } : atual);
      setTipo(salvo.tipo);
      setTitulo(salvo.titulo);
      setTextoJanela(salvo.texto);
      setOpcoesTexto((salvo.opcoes ?? []).join('\n'));
      setFotoJanelaUrl(salvo.image_url);
      setFotoJanelaNova(null);
      setEditando(false);
      toast('Janela guardada.');
    },
    onError: (error) => toast(error.message, 'error'),
  });

  const restaurar = useMutation({
    mutationFn: async () => {
      const generation = sessionStore.getGeneration();
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      const salvo = await api<DiaAdvento>(`/api/advento/janelas/${dia}`, { method: 'DELETE' });
      return { salvo, generation };
    },
    onSuccess: ({ salvo, generation }) => {
      if (!sessaoVigente(generation)) return;
      queryClient.setQueryData(adventoKeys.dia(dia), salvo);
      void queryClient.invalidateQueries({ queryKey: adventoKeys.calendario });
      setTipo(salvo.tipo);
      setTitulo(salvo.titulo);
      setTextoJanela(salvo.texto);
      setOpcoesTexto((salvo.opcoes ?? []).join('\n'));
      setFotoJanelaUrl(salvo.image_url);
      setFotoJanelaNova(null);
      setEditando(false);
      toast('Voltamos ao texto sugerido.');
    },
    onError: (error) => toast(error.message, 'error'),
  });

  async function escolher(destino: 'resposta' | 'janela', origem: 'camera' | 'galeria') {
    if (escolhendo.current) return;
    escolhendo.current = true;
    try {
      const fotos = await escolherFotos(origem, 1);
      const foto = fotos[0];
      if (!foto) return;
      if (destino === 'resposta') setFotoResposta(foto);
      else setFotoJanelaNova(foto);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível escolher a foto.', 'error');
    } finally {
      escolhendo.current = false;
    }
  }

  const ocupado = votar.isPending || responder.isPending || apagar.isPending || salvar.isPending || restaurar.isPending;
  const pedeFoto = dados?.tipo === 'foto' || dados?.tipo === 'desafio';
  const jaRespondeu = Boolean(dados?.respostas.some((item) => item.minha));
  const previaJanela = fotoJanelaNova?.uri ?? fotoJanelaUrl;

  return (
    <View style={styles.pagina}>
      <Cabecalho kicker="Advento" titulo={`Dia ${dia}`} aoVoltar={onVoltar} rotuloVoltar="Voltar ao calendário" />
      {consulta.isPending ? (
        <View style={styles.corpo}><Skeleton style={{ height: 180 }} /><Skeleton style={{ height: 88 }} /></View>
      ) : !dados ? (
        <EmptyState title="Essa janela não abriu" message={consulta.error?.message ?? 'Não conseguimos abrir esta janela.'} action="Voltar" onAction={onVoltar} />
      ) : (
        <ScrollView contentContainerStyle={styles.corpo} keyboardShouldPersistTaps="handled">
          <Text variant="kicker">{ROTULO[dados.tipo]}</Text>
          <Text variant="display" accessibilityRole="header" style={styles.titulo}>{dados.titulo}</Text>
          {!dados.liberada ? <Text style={styles.aviso}>A família vê esta janela no dia {dia} de dezembro. Você já pode deixar o texto e uma foto antiga.</Text> : null}
          {dados.texto ? <Text variant="muted">{dados.texto}</Text> : null}
          {dados.image_url ? <Image source={{ uri: dados.image_url }} style={styles.foto} contentFit="cover" accessibilityLabel={dados.titulo} /> : null}

          {dados.liberada && dados.tipo === 'enquete' ? (
            <View accessibilityRole="radiogroup" accessibilityLabel={dados.titulo} style={styles.bloco}>
              <Text variant="muted">{dados.total_votos === 1 ? '1 voto' : `${dados.total_votos} votos`}</Text>
              {dados.votos.map((item) => {
                const pct = dados.total_votos > 0 ? Math.round((item.total / dados.total_votos) * 100) : 0;
                const minha = dados.meu_voto === item.opcao;
                return (
                  <Pressable key={item.opcao} accessibilityRole="radio" accessibilityState={{ checked: minha, disabled: ocupado }} disabled={ocupado} onPress={() => votar.mutate(item.opcao)} style={[styles.opcao, minha && styles.opcaoMinha]}>
                    <View style={styles.opcaoLinha}><Text style={styles.flex}>{item.opcao}</Text><Text variant="numeral" style={styles.contagem}>{item.total}</Text></View>
                    <View style={styles.trilha}><View style={[styles.barra, { width: `${pct}%` }]} /></View>
                  </Pressable>
                );
              })}
              <Text variant="muted">{AJUDA.enquete}</Text>
            </View>
          ) : null}

          {dados.liberada && dados.tipo !== 'enquete' && !jaRespondeu ? (
            <View style={styles.bloco}>
              <Text variant="muted">{AJUDA[dados.tipo]}</Text>
              <Field label="Sua resposta" value={texto} onChangeText={setTexto} multiline maxLength={2000} editable={!ocupado} style={styles.area} />
              {fotoResposta ? <Image source={{ uri: fotoResposta.uri }} style={styles.foto} contentFit="cover" accessibilityLabel="Foto escolhida" /> : null}
              <View style={styles.linha}>
                <Button variant="ghost" style={styles.flex} disabled={ocupado} onPress={() => { void escolher('resposta', 'camera'); }} icon={<Camera size={16} color={theme.colors.ivory} />}>Câmera</Button>
                <Button variant="ghost" style={styles.flex} disabled={ocupado} onPress={() => { void escolher('resposta', 'galeria'); }}>Galeria</Button>
              </View>
              {fotoResposta ? <Button variant="quiet" disabled={ocupado} onPress={() => setFotoResposta(null)}>Tirar foto</Button> : null}
              <Button loading={responder.isPending} disabled={ocupado || !texto.trim() || (pedeFoto && !fotoResposta)} onPress={() => responder.mutate({ texto: texto.trim(), foto: fotoResposta })}>Enviar para a família</Button>
            </View>
          ) : null}

          {dados.liberada && dados.respostas.length > 0 ? (
            <View style={styles.bloco}>
              <Text variant="kicker">Respostas da família</Text>
              {dados.respostas.map((item) => (
                <View key={item.id} style={styles.resposta}>
                  <View style={styles.linha}>
                    <Avatar name={item.user_name} src={item.avatar_url} size={40} />
                    <View style={styles.flex}>
                      <Text style={styles.nome}>{item.user_name}</Text>
                      <Text variant="muted" style={styles.quando}>{item.id < 0 ? 'enviando' : timeAgo(item.created_at)}</Text>
                    </View>
                  </View>
                  <Text>{item.texto}</Text>
                  {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.foto} contentFit="cover" accessibilityLabel={`Foto de ${item.user_name}`} /> : null}
                  {item.id > 0 && !item.minha ? <ModerationActions userId={item.user_id} name={item.user_name} alvoTipo="advento" alvoId={item.id} onDone={() => { void queryClient.invalidateQueries({ queryKey: adventoKeys.dia(dia) }); }} /> : null}
                  {item.id > 0 && (item.minha || dados.organizador) ? (
                    <Button variant="quiet" disabled={ocupado} icon={<Trash2 size={15} color={theme.colors.secondary} />} onPress={() => Alert.alert('Apagar esta resposta?', item.user_name, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Apagar', style: 'destructive', onPress: () => apagar.mutate(item.id) },
                    ])}>Apagar</Button>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {dados.liberada && dados.tipo !== 'enquete' && dados.respostas.length === 0 ? <Text variant="muted">Seja a primeira pessoa da família a responder.</Text> : null}

          {dados.organizador ? (
            <View style={styles.bloco}>
              {!editando ? <Button variant="ghost" onPress={() => setEditando(true)}>Preparar esta janela</Button> : (
                <View style={styles.bloco}>
                  <Text variant="kicker">Preparar o dia {dia}</Text>
                  <View style={styles.tipos} accessibilityRole="radiogroup" accessibilityLabel="Tipo da janela">
                    {TIPOS.map((item) => (
                      <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: tipo === item }} onPress={() => setTipo(item)} style={[styles.chip, tipo === item && styles.chipAtivo]}>
                        <Text style={styles.chipTexto}>{ROTULO[item]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={120} editable={!ocupado} />
                  <Field label="Texto" value={textoJanela} onChangeText={setTextoJanela} multiline maxLength={2000} editable={!ocupado} style={styles.area} />
                  {tipo === 'enquete' ? <Field label="Opções, uma por linha (de 2 a 6)" value={opcoesTexto} onChangeText={setOpcoesTexto} multiline editable={!ocupado} style={styles.area} /> : null}
                  {previaJanela ? <Image source={{ uri: previaJanela }} style={styles.foto} contentFit="cover" accessibilityLabel="Foto da janela" /> : null}
                  <View style={styles.linha}>
                    <Button variant="ghost" style={styles.flex} disabled={ocupado} onPress={() => { void escolher('janela', 'camera'); }}>Câmera</Button>
                    <Button variant="ghost" style={styles.flex} disabled={ocupado} onPress={() => { void escolher('janela', 'galeria'); }}>Foto antiga</Button>
                  </View>
                  {previaJanela ? <Button variant="quiet" disabled={ocupado} onPress={() => { setFotoJanelaNova(null); setFotoJanelaUrl(null); }}>Tirar foto</Button> : null}
                  <Button loading={salvar.isPending} disabled={ocupado || !titulo.trim()} onPress={() => salvar.mutate()}>Guardar janela</Button>
                  {dados.personalizada ? <Button variant="quiet" disabled={ocupado} onPress={() => Alert.alert('Voltar ao texto sugerido?', 'A família volta a ver o texto padrão deste dia.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Voltar ao sugerido', onPress: () => restaurar.mutate() },
                  ])}>Voltar ao texto sugerido</Button> : null}
                  <Button variant="ghost" disabled={ocupado} onPress={() => setEditando(false)}>Cancelar</Button>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  corpo: { paddingHorizontal: 24, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  titulo: { fontSize: 32, lineHeight: 40 },
  bloco: { gap: 12 },
  aviso: { color: theme.colors.champagne },
  foto: { width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.colors.field },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  opcao: { minHeight: 44, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  opcaoMinha: { borderColor: theme.colors.champagne, backgroundColor: 'rgba(191,165,119,0.1)' },
  opcaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contagem: { fontSize: 22, lineHeight: 28, color: theme.colors.champagne },
  trilha: { height: 4, borderRadius: 2, backgroundColor: theme.colors.field, overflow: 'hidden' },
  barra: { height: 4, backgroundColor: theme.colors.champagne },
  area: { minHeight: 96, textAlignVertical: 'top' },
  resposta: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.line },
  nome: { fontFamily: theme.fonts.medium },
  quando: { fontSize: 11 },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { borderColor: theme.colors.champagne },
  chipTexto: { fontSize: 13 },
});
