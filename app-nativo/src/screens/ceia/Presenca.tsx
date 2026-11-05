import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Check from 'lucide-react-native/icons/check';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import type { Attendance, HomeData, User } from '../../types';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { sessaoVigente } from '../familia/sessao';
import { ceiaKeys } from './chaves';
import { Secao } from './Secao';
import type { CeiaDados, CeiaPresenca, StatusPresenca } from './tipos';
import { textoGrupo, textoTotais } from './texto';

const OPCOES: { id: StatusPresenca; rotulo: string }[] = [
  { id: 'yes', rotulo: 'Vou' },
  { id: 'maybe', rotulo: 'Talvez' },
  { id: 'no', rotulo: 'Não' },
];

function comResposta(dados: CeiaDados, status: StatusPresenca, adultos: number, criancas: number, restricao: string, eu: User): CeiaDados {
  if (eu.participant_id === null) return dados;
  const pessoas = dados.presenca.pessoas.filter((pessoa) => pessoa.participant_id !== eu.participant_id);
  pessoas.push({
    participant_id: eu.participant_id,
    name: eu.name,
    avatar_url: eu.avatar_url,
    status,
    adultos: status === 'no' ? 0 : adultos,
    criancas: status === 'no' ? 0 : criancas,
    restricao: restricao.trim() || null,
  });
  pessoas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const confirmados = pessoas.filter((pessoa) => pessoa.status === 'yes');
  const totAdultos = confirmados.reduce((soma, pessoa) => soma + pessoa.adultos, 0);
  const totCriancas = confirmados.reduce((soma, pessoa) => soma + pessoa.criancas, 0);
  return {
    ...dados,
    presenca: {
      status,
      adultos: status === 'no' ? 0 : adultos,
      criancas: status === 'no' ? 0 : criancas,
      restricao: restricao.trim() || null,
      pessoas,
      totais: { confirmados: confirmados.length, adultos: totAdultos, criancas: totCriancas, pessoas: totAdultos + totCriancas },
    },
  };
}

type RascunhoPresenca = { status: StatusPresenca | null; adultos: number; criancas: number; restricao: string };

export function PresencaCeia({ presenca, usuario }: { presenca: CeiaPresenca; usuario: User }) {
  const toast = useToast();
  const [rascunho, setRascunho] = useState<RascunhoPresenca | null>(null);
  const status = rascunho?.status ?? presenca.status;
  const adultos = rascunho?.adultos ?? presenca.adultos;
  const criancas = rascunho?.criancas ?? presenca.criancas;
  const restricao = rascunho?.restricao ?? (presenca.restricao ?? '');
  function editar(parcial: Partial<RascunhoPresenca>) {
    setRascunho({ status, adultos, criancas, restricao, ...parcial });
  }
  const salvar = useMutation({
    mutationFn: (vars: { corpo: Record<string, unknown>; generation: number; proximo: StatusPresenca }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<Attendance>('/api/attendance', { method: 'POST', json: vars.corpo });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ceiaKeys.tudo });
      const anterior = queryClient.getQueryData<CeiaDados>(ceiaKeys.tudo);
      if (anterior && sessaoVigente(vars.generation)) {
        const adultosEnvio = typeof vars.corpo.adultos === 'number' ? vars.corpo.adultos : adultos;
        const criancasEnvio = typeof vars.corpo.criancas === 'number' ? vars.corpo.criancas : criancas;
        queryClient.setQueryData(ceiaKeys.tudo, comResposta(anterior, vars.proximo, adultosEnvio, criancasEnvio, restricao, usuario));
      }
      return { anterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx?.anterior && sessaoVigente(vars.generation)) queryClient.setQueryData(ceiaKeys.tudo, ctx.anterior);
      setRascunho(null);
      toast(erro.message, 'error');
    },
    onSuccess: (attendance, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData(queryKeys.attendance, attendance);
      queryClient.setQueryData<HomeData>(queryKeys.home, (atual) => atual ? { ...atual, attendance } : atual);
      setRascunho(null);
      toast(vars.proximo === 'yes' ? 'Seu lugar à mesa está confirmado!' : vars.proximo === 'maybe' ? 'Guardamos o seu talvez.' : 'Avisamos que você não vai.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance });
    },
  });
  function enviar(proximo: StatusPresenca, adultosEnvio: number, criancasEnvio: number) {
    if (salvar.isPending) return;
    if (usuario.participant_id === null) { toast('Seu acesso ainda não está ligado a uma pessoa da família.', 'error'); return; }
    const corpo: Record<string, unknown> = { status: proximo };
    if (proximo === 'no') {
      corpo.adultos = 0;
      corpo.criancas = 0;
    } else {
      corpo.adultos = adultosEnvio;
      corpo.criancas = criancasEnvio;
      corpo.restricao = restricao;
    }
    salvar.mutate({ corpo, generation: sessionStore.getGeneration(), proximo });
  }
  function escolher(proximo: StatusPresenca) {
    let adultosEnvio = adultos;
    const criancasEnvio = criancas;
    if (proximo !== 'no' && adultosEnvio + criancasEnvio < 1) adultosEnvio = 1;
    editar({
      status: proximo,
      adultos: proximo === 'no' ? 0 : adultosEnvio,
      criancas: proximo === 'no' ? 0 : criancasEnvio,
    });
    enviar(proximo, adultosEnvio, criancasEnvio);
  }
  const confirmados = presenca.pessoas.filter((pessoa) => pessoa.status === 'yes');
  const talvez = presenca.pessoas.filter((pessoa) => pessoa.status === 'maybe');
  const nao = presenca.pessoas.filter((pessoa) => pessoa.status === 'no');
  return <Secao indice="02" kicker="Quem vem" titulo="Presença">
    {usuario.participant_id === null ? <Text variant="muted">Seu acesso ainda não está ligado a uma pessoa da família. Peça para quem organiza. Você já pode votar e dizer o que vai levar.</Text> : <>
      <View style={styles.opcoes}>
        {OPCOES.map((opcao) => <Button key={opcao.id} style={styles.flex} variant={status === opcao.id ? 'primary' : 'ghost'} selected={status === opcao.id} disabled={salvar.isPending} onPress={() => escolher(opcao.id)} icon={status === opcao.id ? <Check size={15} color={theme.colors.ivory} /> : undefined}>{opcao.rotulo}</Button>)}
      </View>
      {status === 'yes' || status === 'maybe' ? <View style={styles.form}>
        <Contador rotulo="Adultos" valor={adultos} menos="Menos um adulto" mais="Mais um adulto" onMudar={(valor) => editar({ adultos: valor })} />
        <Contador rotulo="Crianças" valor={criancas} menos="Menos uma criança" mais="Mais uma criança" onMudar={(valor) => editar({ criancas: valor })} />
        <Field label="Restrição alimentar (só quem organiza vê)" value={restricao} onChangeText={(texto) => editar({ restricao: texto })} placeholder="Ex.: sem glúten, alergia a camarão" maxLength={120} />
        <Button loading={salvar.isPending} onPress={() => {
          if (status !== 'yes' && status !== 'maybe') return;
          const adultosEnvio = adultos + criancas < 1 ? 1 : adultos;
          if (adultosEnvio !== adultos) editar({ adultos: adultosEnvio });
          enviar(status, adultosEnvio, criancas);
        }}>Guardar quantidades</Button>
      </View> : null}
    </>}
    <Text variant="numeral" style={styles.total}>{presenca.totais.pessoas}</Text>
    <Text variant="muted">{presenca.totais.pessoas === 1 ? 'pessoa à mesa' : 'pessoas à mesa'}</Text>
    <Text variant="muted">{textoTotais(presenca.totais)}</Text>
    {usuario.is_admin ? <Text variant="muted" style={styles.nota}>As restrições alimentares só aparecem para quem organiza.</Text> : null}
    {confirmados.length ? confirmados.map((pessoa) => <View key={pessoa.participant_id} style={styles.pessoa}>
      <Avatar name={pessoa.name} src={pessoa.avatar_url} />
      <View style={styles.flex}>
        <Text>{pessoa.name}</Text>
        <Text variant="muted">{textoGrupo(pessoa.adultos, pessoa.criancas)}</Text>
        {usuario.is_admin && pessoa.restricao ? <Text style={styles.restricao}>{pessoa.restricao}</Text> : null}
      </View>
    </View>) : <Text variant="muted">Ninguém confirmou ainda. Seja a primeira pessoa à mesa.</Text>}
    {talvez.length ? <View style={styles.grupo}><Text variant="kicker">Talvez</Text><Text variant="muted">{talvez.map((pessoa) => pessoa.name).join(', ')}</Text></View> : null}
    {nao.length ? <View style={styles.grupo}><Text variant="kicker">Não vão</Text><Text variant="muted">{nao.map((pessoa) => pessoa.name).join(', ')}</Text></View> : null}
  </Secao>;
}

function Contador({ rotulo, valor, menos, mais, onMudar }: { rotulo: string; valor: number; menos: string; mais: string; onMudar: (valor: number) => void }) {
  return <View style={styles.contador}>
    <Text variant="muted">{rotulo}</Text>
    <View style={styles.passo}>
      <Pressable accessibilityRole="button" accessibilityLabel={menos} onPress={() => onMudar(Math.max(0, valor - 1))} style={styles.passoBtn}><Text>-</Text></Pressable>
      <Text variant="numeral" style={styles.passoValor}>{valor}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={mais} onPress={() => onMudar(Math.min(40, valor + 1))} style={styles.passoBtn}><Text>+</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  opcoes: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  form: { gap: 14 },
  total: { fontSize: 56, lineHeight: 64 },
  nota: { fontSize: 12 },
  pessoa: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  restricao: { color: theme.colors.champagne, marginTop: 2 },
  grupo: { gap: 6 },
  contador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  passo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passoBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  passoValor: { width: 36, textAlign: 'center', fontSize: 28, lineHeight: 36 },
});
