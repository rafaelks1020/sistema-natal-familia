import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import type { HomeData } from '../../types';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { sessaoVigente } from '../familia/sessao';
import { ceiaKeys } from './chaves';
import { Secao } from './Secao';
import type { CeiaDados, CeiaEvento, CeiaVotacao, TipoVotacao } from './tipos';
import { TIPOS_VOTACAO } from './tipos';
import { isoDeBrasilia, mascaraData, mascaraHora, percentual, rotuloTipo, situacaoVotos, textoOpcao } from './texto';

type Rascunho = { texto: string; data: string; hora: string };
const vazio = (): Rascunho => ({ texto: '', data: '', hora: '' });

export function VotacaoCeia({ votacoes, admin }: { votacoes: CeiaVotacao[]; admin: boolean }) {
  const toast = useToast();
  const [formulario, setFormulario] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [tipo, setTipo] = useState<TipoVotacao>('local');
  const [opcoes, setOpcoes] = useState<Rascunho[]>([vazio(), vazio()]);
  const abertas = votacoes.filter((votacao) => votacao.aberta);
  const encerradas = votacoes.filter((votacao) => !votacao.aberta);
  const criar = useMutation({
    mutationFn: (vars: { pergunta: string; tipo: TipoVotacao; opcoes: string[]; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<CeiaVotacao>('/api/ceia/votacoes', { method: 'POST', json: { pergunta: vars.pergunta, tipo: vars.tipo, opcoes: vars.opcoes } });
    },
    onSuccess: (criada, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, votacoes: [criada, ...atual.votacoes.filter((item) => item.id !== criada.id)] } : atual);
      setPergunta('');
      setOpcoes([vazio(), vazio()]);
      setFormulario(false);
      toast('A família já pode votar.');
    },
    onError: (erro) => toast(erro.message, 'error'),
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
    },
  });
  const votar = useMutation({
    mutationFn: (vars: { id: number; opcaoId: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<CeiaVotacao>(`/api/ceia/votacoes/${vars.id}/voto`, { method: 'POST', json: { opcao_id: vars.opcaoId } });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ceiaKeys.tudo });
      const anterior = queryClient.getQueryData<CeiaDados>(ceiaKeys.tudo);
      if (anterior && sessaoVigente(vars.generation)) {
        queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, {
          ...anterior,
          votacoes: anterior.votacoes.map((votacao) => votacao.id === vars.id ? aplicarVoto(votacao, vars.opcaoId) : votacao),
        });
      }
      return { anterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx?.anterior && sessaoVigente(vars.generation)) queryClient.setQueryData(ceiaKeys.tudo, ctx.anterior);
      toast(erro.message, 'error');
    },
    onSuccess: (atualizada, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, votacoes: atual.votacoes.map((item) => item.id === atualizada.id ? atualizada : item) } : atual);
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
    },
  });
  const organizar = useMutation({
    mutationFn: async (vars: { id: number; acao: 'encerrar' | 'aplicar' | 'apagar'; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      if (vars.acao === 'apagar') {
        await api(`/api/ceia/votacoes/${vars.id}`, { method: 'DELETE' });
        return { acao: vars.acao } as const;
      }
      const resp = await api<{ votacao: CeiaVotacao; evento?: CeiaEvento; aplicado?: string }>(`/api/ceia/votacoes/${vars.id}`, { method: 'POST', json: { acao: vars.acao } });
      return { acao: vars.acao, ...resp };
    },
    onSuccess: (resp, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      if (resp.acao === 'apagar') {
        queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, votacoes: atual.votacoes.filter((item) => item.id !== vars.id) } : atual);
        toast('Votação apagada.');
        return;
      }
      queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? {
        ...atual,
        evento: resp.evento ?? atual.evento,
        votacoes: atual.votacoes.map((item) => item.id === resp.votacao.id ? resp.votacao : item),
      } : atual);
      if (resp.evento) queryClient.setQueryData<HomeData>(queryKeys.home, (atual) => atual ? { ...atual, settings: { ...atual.settings, ...resp.evento } } : atual);
      toast(resp.aplicado ? `A ceia agora usa: ${resp.aplicado}.` : 'Votação encerrada.');
    },
    onError: (erro) => toast(erro.message, 'error'),
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
  function abrir() {
    setPergunta('');
    setTipo('local');
    setOpcoes([vazio(), vazio()]);
    setFormulario(true);
  }
  function publicar() {
    if (criar.isPending) return;
    const textos: string[] = [];
    for (let i = 0; i < opcoes.length; i += 1) {
      const opcao = opcoes[i];
      if (!opcao) continue;
      if (tipo === 'data') {
        const iso = isoDeBrasilia(opcao.data, opcao.hora);
        if (!iso) { toast(`A opção ${i + 1} precisa de uma data e um horário válidos.`, 'error'); return; }
        textos.push(iso);
      } else if (!opcao.texto.trim()) {
        toast('Preencha todas as opções.', 'error');
        return;
      } else textos.push(opcao.texto.trim());
    }
    if (!pergunta.trim()) { toast('Escreva a pergunta.', 'error'); return; }
    criar.mutate({ pergunta: pergunta.trim(), tipo, opcoes: textos, generation: sessionStore.getGeneration() });
  }
  function pedir(votacao: CeiaVotacao, acao: 'encerrar' | 'aplicar' | 'apagar') {
    if (acao === 'apagar') {
      Alert.alert('Apagar esta votação?', 'Os votos também saem.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => organizar.mutate({ id: votacao.id, acao, generation: sessionStore.getGeneration() }) },
      ]);
      return;
    }
    if (acao === 'encerrar') {
      Alert.alert('Encerrar esta votação?', 'Ninguém mais muda o voto.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', onPress: () => organizar.mutate({ id: votacao.id, acao, generation: sessionStore.getGeneration() }) },
      ]);
      return;
    }
    const maximo = Math.max(...votacao.opcoes.map((opcao) => opcao.votos));
    const vencedor = votacao.opcoes.find((opcao) => opcao.votos === maximo);
    const texto = vencedor ? textoOpcao(votacao.tipo, vencedor.texto) : 'a vencedora';
    const frase = votacao.tipo === 'data' ? `Usar ${texto} como data da ceia?` : `Usar "${texto}" como local da ceia?`;
    Alert.alert('Usar a resposta', frase, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Usar', onPress: () => organizar.mutate({ id: votacao.id, acao, generation: sessionStore.getGeneration() }) },
    ]);
  }
  return <Secao indice="04" kicker="A família decide" titulo="Votação" texto="Um voto por pessoa. Dá para mudar enquanto estiver aberta.">
    {admin ? <Button onPress={abrir}>Nova votação</Button> : null}
    {votacoes.length ? <>
      <Lista titulo="Abertas" itens={abertas} vazio="Nenhuma votação aberta." onVotar={(votacao, opcaoId) => {
        if (!votacao.aberta) { toast('Essa votação já encerrou.', 'error'); return; }
        if (votacao.meu_voto === opcaoId || votar.isPending) return;
        votar.mutate({ id: votacao.id, opcaoId, generation: sessionStore.getGeneration() });
      }} admin={admin} ocupado={organizar.isPending} onOrganizar={pedir} />
      {encerradas.length ? <Lista titulo="Encerradas" itens={encerradas} vazio="" onVotar={(votacao) => toast(votacao.aberta ? '' : 'Essa votação já encerrou.', 'error')} admin={admin} ocupado={organizar.isPending} onOrganizar={pedir} /> : null}
    </> : <Text variant="muted">Nenhuma pergunta ainda. Quem organiza pode consultar a família.</Text>}
    <Sheet visible={formulario} onClose={() => { if (!criar.isPending) setFormulario(false); }} title="Nova votação">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.folha}>
        <Field label="Pergunta" value={pergunta} onChangeText={setPergunta} placeholder="Ex.: Onde fazemos a ceia?" maxLength={200} />
        <Text variant="muted">Tipo</Text>
        <View style={styles.tipos}>
          {TIPOS_VOTACAO.map((item) => <Button key={item.id} style={styles.tipo} variant={tipo === item.id ? 'primary' : 'ghost'} selected={tipo === item.id} onPress={() => { setTipo(item.id); setOpcoes((atual) => atual.map(() => vazio())); }}>{item.rotulo}</Button>)}
        </View>
        {opcoes.map((opcao, indice) => <View key={indice} style={styles.opcaoForm}>
          {tipo === 'data' ? <View style={styles.quando}>
            <View style={styles.flex}><Field label={`Data ${indice + 1}`} value={opcao.data} onChangeText={(texto) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, data: mascaraData(texto) } : item))} placeholder="24/12/2026" keyboardType="number-pad" maxLength={10} /></View>
            <View style={styles.hora}><Field label="Hora" value={opcao.hora} onChangeText={(texto) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, hora: mascaraHora(texto) } : item))} placeholder="20:00" keyboardType="number-pad" maxLength={5} /></View>
          </View> : <Field label={`Opção ${indice + 1}`} value={opcao.texto} onChangeText={(texto) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, texto } : item))} maxLength={tipo === 'local' ? 500 : 160} />}
        </View>)}
        <View style={styles.tipos}>
          {opcoes.length < 6 ? <Button variant="quiet" onPress={() => setOpcoes((atual) => [...atual, vazio()])}>Mais uma opção</Button> : null}
          {opcoes.length > 2 ? <Button variant="quiet" onPress={() => setOpcoes((atual) => atual.slice(0, -1))}>Tirar a última</Button> : null}
        </View>
        <Button loading={criar.isPending} onPress={publicar}>Abrir votação</Button>
      </ScrollView>
    </Sheet>
  </Secao>;
}

function aplicarVoto(votacao: CeiaVotacao, opcaoId: number): CeiaVotacao {
  if (votacao.meu_voto === opcaoId) return votacao;
  const opcoes = votacao.opcoes.map((opcao) => {
    let votos = opcao.votos;
    if (opcao.id === votacao.meu_voto) votos = Math.max(0, votos - 1);
    if (opcao.id === opcaoId) votos += 1;
    return { ...opcao, votos };
  });
  return { ...votacao, opcoes, meu_voto: opcaoId, total: opcoes.reduce((soma, opcao) => soma + opcao.votos, 0) };
}

function Lista({ titulo, itens, vazio, onVotar, admin, ocupado, onOrganizar }: {
  titulo: string;
  itens: CeiaVotacao[];
  vazio: string;
  onVotar: (votacao: CeiaVotacao, opcaoId: number) => void;
  admin: boolean;
  ocupado: boolean;
  onOrganizar: (votacao: CeiaVotacao, acao: 'encerrar' | 'aplicar' | 'apagar') => void;
}) {
  return <View style={styles.lista}>
    <Text variant="kicker">{titulo}</Text>
    {itens.length ? itens.map((votacao) => {
      const situacao = situacaoVotos(votacao.opcoes);
      const maximo = votacao.opcoes.reduce((maior, opcao) => Math.max(maior, opcao.votos), 0);
      return <View key={votacao.id} style={styles.cartao}>
        <Text variant="kicker">{rotuloTipo(votacao.tipo)}{votacao.aberta ? '' : ' (encerrada)'}</Text>
        <Text style={styles.pergunta}>{votacao.pergunta}</Text>
        {votacao.opcoes.map((opcao) => {
          const texto = textoOpcao(votacao.tipo, opcao.texto);
          const minha = votacao.meu_voto === opcao.id;
          return <Pressable key={opcao.id} accessibilityRole="button" accessibilityState={{ selected: minha }} accessibilityLabel={`${texto}, ${opcao.votos} ${opcao.votos === 1 ? 'voto' : 'votos'}`} onPress={() => onVotar(votacao, opcao.id)} style={[styles.opcao, minha && styles.opcaoMinha]}>
            <View style={styles.linha}>
              <Text style={styles.flex}>{texto}{situacao === 'lider' && opcao.votos === maximo ? ' (na frente)' : ''}</Text>
              <Text variant="numeral">{opcao.votos}</Text>
            </View>
            <View style={styles.trilho} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: votacao.total || 1, now: opcao.votos }}>
              <View style={[styles.barra, { width: `${percentual(opcao.votos, votacao.total)}%` }]} />
            </View>
          </Pressable>;
        })}
        <Text variant="muted" style={styles.nota}>{votacao.total} {votacao.total === 1 ? 'voto' : 'votos'}{situacao === 'empate' ? '. Empate.' : ''}{votacao.aberta ? '' : ' Encerrada: o voto não muda mais.'}</Text>
        {admin ? <View style={styles.acoes}>
          {votacao.aberta ? <Button variant="ghost" disabled={ocupado} onPress={() => onOrganizar(votacao, 'encerrar')}>Encerrar</Button> : null}
          {(votacao.tipo === 'local' || votacao.tipo === 'data') && situacao === 'lider' ? <Button disabled={ocupado} onPress={() => onOrganizar(votacao, 'aplicar')}>{votacao.tipo === 'data' ? 'Usar como data' : 'Usar como local'}</Button> : null}
          <Button variant="quiet" disabled={ocupado} onPress={() => onOrganizar(votacao, 'apagar')}>Apagar</Button>
        </View> : null}
      </View>;
    }) : vazio ? <Text variant="muted">{vazio}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  lista: { gap: 12 },
  cartao: { gap: 10, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.card, backgroundColor: theme.colors.surface, padding: 16 },
  pergunta: { fontSize: 18 },
  opcao: { minHeight: 44, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  opcaoMinha: { borderColor: theme.colors.champagne },
  linha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  trilho: { height: 6, borderRadius: 99, backgroundColor: theme.colors.field, overflow: 'hidden' },
  barra: { height: 6, backgroundColor: theme.colors.sage },
  nota: { fontSize: 12 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  folha: { gap: 14, paddingBottom: 12 },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipo: { minWidth: 96 },
  opcaoForm: { gap: 8 },
  quando: { flexDirection: 'row', gap: 12 },
  hora: { width: 110 },
});
