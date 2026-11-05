import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../session';
import { sessionStore } from '../../api';
import { escolherFotos, type FotoLocal, type Origem } from '../../upload';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Surface } from '../../ui/Surface';
import { Field } from '../../ui/Field';
import { Avatar } from '../../ui/Avatar';
import { LoopVideo } from '../../ui/LoopVideo';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';
import { ModerationActions } from '../moderacao/Actions';
import { FestaFrame, FestaLoading, styles } from './shared';
import { challengePath, festaKeys, useChallenges, useFestaMutation, type ChallengeData } from './data';
const sugestoes = ['Melhor careta', 'Melhor look', 'Foto mais natalina', 'Melhor foto com a vó'];
export default function Desafio() {
  const { user } = useSession();
  const query = useChallenges();
  const cache = useQueryClient();
  const write = useFestaMutation<ChallengeData>(challengePath, festaKeys.challenge(user?.id));
  const [titulo, setTitulo] = useState(sugestoes[0] ?? '');
  const [legenda, setLegenda] = useState('');
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [picking, setPicking] = useState(false);
  const pickingLock = useRef(false);
  const toast = useToast();
  const data = query.data;
  const aberto = data?.desafios.find((c) => c.aberto);
  const minha = data?.fotos.find((p) => p.desafio_id === aberto?.id && p.user_id === data.me.id);
  const busy = write.isPending || picking;
  async function pick(origem: Origem) {
    if (busy || pickingLock.current) return;
    pickingLock.current = true; setPicking(true);
    const generation = sessionStore.getGeneration();
    try { const next = (await escolherFotos(origem, 1))[0]; if (next && generation === sessionStore.getGeneration()) setFoto(next); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { pickingLock.current = false; setPicking(false); }
  }
  return <FestaFrame title="Desafio de foto" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    {data && <Text variant="kicker">Edição {data.ano}</Text>}
    <Text variant="muted">Uma foto por pessoa em cada desafio. Vote na foto de outra pessoa. Você pode trocar seu voto até encerrar.</Text>
    {query.isPending && <FestaLoading />}
    {query.isError && <EmptyState title="Não foi possível atualizar" message={query.error.message} action="Tentar novamente" onAction={() => { void query.refetch(); }} />}
    {data?.me.is_admin && !aberto && <Surface style={styles.gap}><Text variant="display">Começar um desafio</Text>{sugestoes.map((s) => <Button key={s} disabled={busy} variant="ghost" onPress={() => setTitulo(s)}>{s}</Button>)}<Field label="Nome do desafio" value={titulo} onChangeText={setTitulo} maxLength={120} editable={!busy} /><Button loading={write.isPending} disabled={busy || !titulo.trim()} onPress={() => write.mutate({ method: 'POST', json: { titulo }, success: 'Desafio aberto. A família será avisada.' })}>Abrir desafio</Button></Surface>}
    {aberto && <Surface style={styles.gap}><Text variant="kicker">Valendo agora</Text><Text variant="display">{aberto.titulo}</Text><Button disabled={busy} variant="ghost" onPress={() => { void pick('camera'); }}>Tirar foto</Button><Button disabled={busy} variant="ghost" onPress={() => { void pick('galeria'); }}>Escolher da galeria</Button>{foto && <Image source={{ uri: foto.uri }} style={styles.image} contentFit="contain" accessibilityLabel="Sua foto escolhida" />}<Field label="Legenda (opcional)" value={legenda} onChangeText={setLegenda} maxLength={500} multiline editable={!busy} />{minha && <Text variant="muted">Ao trocar a foto, os votos que ela recebeu são zerados.</Text>}<Button loading={write.isPending} disabled={busy || !foto} onPress={() => { if (!foto || busy) return; const generation = sessionStore.getGeneration(); write.mutate({ method: 'PUT', foto, json: { acao: 'foto', desafio_id: aberto.id, legenda }, success: 'Foto enviada!' }, { onSuccess: () => { if (generation === sessionStore.getGeneration()) { setFoto(null); setLegenda(''); } } }); }}>{minha ? 'Trocar minha foto' : 'Enviar foto'}</Button>{data?.me.is_admin && <Button disabled={busy} variant="ghost" onPress={() => Alert.alert('Encerrar o desafio?', 'Fotos e votos serão fechados e o resultado será revelado.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Encerrar', onPress: () => write.mutate({ method: 'PATCH', json: { desafio_id: aberto.id }, success: 'Desafio encerrado!' }) }])}>Encerrar e revelar resultado</Button>}</Surface>}
    {data && !data.desafios.length && <EmptyState title="Prepare a câmera" message="Quem organiza vai abrir o primeiro desafio da noite." />}
    {data?.desafios.map((c) => {
      const fotos = data.fotos.filter((p) => p.desafio_id === c.id);
      const winners = fotos.filter((p) => p.vencedor);
      const voto = data.meusVotos.find((v) => v.desafio_id === c.id)?.entry_id;
      return <View key={c.id} style={styles.gap}><Text variant="kicker">{c.aberto ? 'Fotos participantes' : 'Desafio encerrado'}</Text><Text variant="display">{c.titulo}</Text>
        {!c.aberto && <Surface style={[styles.gap, styles.winner]}>{winners.length > 0 && <LoopVideo name="mn-confete" once style={styles.video} />}<Text variant="display">{winners.length > 1 ? 'Empate! Vamos celebrar juntos.' : winners.length ? 'A foto vencedora!' : 'A rodada terminou.'}</Text><Text variant="muted">{winners.length ? winners.map((p) => p.name).join(', ') : 'Ainda não há um vencedor para mostrar.'}</Text></Surface>}
        {!fotos.length && <Text variant="muted">Nenhuma foto para mostrar por aqui.</Text>}
        {fotos.map((p) => <Surface key={p.id} style={[styles.gap, p.vencedor && styles.winner]}><Image source={{ uri: p.image_url }} contentFit="contain" style={styles.image} accessibilityLabel={p.legenda || `Foto de ${p.name}`} /><View style={styles.row}><Avatar name={p.name} src={p.avatar_url} size={36} /><Text style={{ flex: 1 }}>{p.name}{p.vencedor ? ' · Vencedor' : ''}</Text></View>{!!p.legenda && <Text>{p.legenda}</Text>}<Text variant="muted">{p.votos} {p.votos === 1 ? 'voto' : 'votos'}</Text>
          {c.aberto && p.user_id !== data.me.id && <Button disabled={busy || voto === p.id} variant={voto === p.id ? 'primary' : 'ghost'} onPress={() => write.mutate({ method: 'PUT', json: { acao: 'votar', desafio_id: c.id, entry_id: p.id }, success: 'Voto registrado!', optimistic: (old) => { const anterior = old.meusVotos.find((v) => v.desafio_id === c.id)?.entry_id; return ({ ...old, meusVotos: [...old.meusVotos.filter((v) => v.desafio_id !== c.id), { desafio_id: c.id, entry_id: p.id }], fotos: old.fotos.map((e) => ({ ...e, votos: e.votos + (e.id === p.id ? 1 : 0) - (e.id === anterior ? 1 : 0) })) }); } })}>{voto === p.id ? 'Seu voto está aqui' : 'Votar nesta foto'}</Button>}
          {((c.aberto && p.user_id === data.me.id) || data.me.is_admin) && <Button disabled={busy} variant="quiet" onPress={() => Alert.alert('Apagar foto?', 'Os votos recebidos também serão apagados.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => write.mutate({ method: 'DELETE', json: { entry_id: p.id }, success: 'Foto apagada.' }) }])}>Apagar foto</Button>}
          {p.user_id !== data.me.id && <ModerationActions userId={p.user_id} name={p.name} alvoTipo="desafio" alvoId={p.id} onDone={() => { void cache.resetQueries({ queryKey: festaKeys.root }); }} />}
        </Surface>)}
      </View>;
    })}
  </FestaFrame>;
}
