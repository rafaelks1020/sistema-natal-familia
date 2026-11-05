import { useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useSession } from '../../session';
import { sessionStore } from '../../api';
import { escolherFotos, type FotoLocal, type Origem } from '../../upload';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Surface } from '../../ui/Surface';
import { Field } from '../../ui/Field';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';
import { FestaFrame, FestaLoading, styles } from './shared';
import { officialPath, festaKeys, useOfficialPhotos, useFestaMutation, type OfficialData } from './data';
export default function FotoOficial() {
  const { user } = useSession();
  const query = useOfficialPhotos();
  const write = useFestaMutation<OfficialData>(officialPath, festaKeys.official(user?.id));
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [legenda, setLegenda] = useState<string | null>(null);
  const [pose, setPose] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const pickingLock = useRef(false);
  const toast = useToast();
  const data = query.data;
  const atual = data?.fotos.find((p) => p.ano === data.ano);
  const anterior = data?.fotos.find((p) => p.ano === data.ano - 1);
  const busy = write.isPending || picking;
  async function pick(origem: Origem) {
    if (busy || pickingLock.current) return;
    pickingLock.current = true; setPicking(true);
    const generation = sessionStore.getGeneration();
    try { const next = (await escolherFotos(origem, 1))[0]; if (next && generation === sessionStore.getGeneration()) setFoto(next); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { pickingLock.current = false; setPicking(false); }
  }
  return <FestaFrame title="Foto oficial" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <Text variant="kicker">Mesma pose todo ano</Text><Text variant="muted">Todo mundo no seu lugar. Repetir a pose faz parte da nossa história.</Text>
    {query.isPending && <FestaLoading />}{query.isError && <EmptyState title="Não foi possível atualizar" message={query.error.message} action="Tentar novamente" onAction={() => { void query.refetch(); }} />}
    {data && !atual && <Surface style={styles.gap}><Text variant="display">Vamos repetir a pose?</Text>{anterior ? <><Image source={{ uri: anterior.image_url }} contentFit="contain" style={styles.image} accessibilityLabel={`Referência da pose de ${anterior.ano}`} /><Text variant="muted">Referência: Natal {anterior.ano}. {anterior.dica_pose || 'Escolham os mesmos lugares e sorriam juntos.'}</Text></> : <Text variant="muted">Nossa tradição começa aqui. Escolham os lugares de cada pessoa para repetir no próximo Natal.</Text>}<Text variant="muted">A foto de {data.ano} ainda será enviada por quem organiza.</Text></Surface>}
    {data && <><Text variant="display">Nossos Natais</Text><Text variant="muted">Deslize para comparar os anos.</Text><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>{data.fotos.map((p) => <Surface key={p.id} style={[styles.gap, { width: 280 }]}><Text variant="kicker">Natal {p.ano}</Text><Image source={{ uri: p.image_url }} contentFit="contain" style={styles.image} accessibilityLabel={p.legenda || `Foto oficial de ${p.ano}`} />{!!p.legenda && <Text>{p.legenda}</Text>}{!!p.dica_pose && <Text variant="muted">A pose: {p.dica_pose}</Text>}</Surface>)}</ScrollView>{!data.fotos.length && <Text variant="muted">Em breve, a primeira foto da nossa tradição.</Text>}</>}
    {data?.is_admin && <Surface style={styles.gap}><Text variant="display">{atual ? 'Trocar' : 'Enviar'} foto de {data.ano}</Text><Button disabled={busy} variant="ghost" onPress={() => { void pick('camera'); }}>Tirar foto</Button><Button disabled={busy} variant="ghost" onPress={() => { void pick('galeria'); }}>Escolher da galeria</Button>{foto && <Image source={{ uri: foto.uri }} contentFit="contain" style={styles.image} accessibilityLabel="Foto oficial escolhida" />}<Field label="Legenda (opcional)" value={legenda ?? atual?.legenda ?? ''} onChangeText={setLegenda} maxLength={500} multiline editable={!busy} /><Field label="Dica para repetir a pose" value={pose ?? atual?.dica_pose ?? ''} onChangeText={setPose} maxLength={500} multiline editable={!busy} placeholder="Quem ficou em cada lugar?" /><Button loading={write.isPending} disabled={busy || !foto} onPress={() => { if (!foto || busy) return; const generation = sessionStore.getGeneration(); write.mutate({ method: 'PUT', foto, json: { legenda: legenda ?? atual?.legenda ?? '', dica_pose: pose ?? atual?.dica_pose ?? '' }, success: 'Foto oficial guardada!' }, { onSuccess: () => { if (generation === sessionStore.getGeneration()) setFoto(null); } }); }}>Guardar foto oficial</Button>{atual && <Button disabled={busy} variant="quiet" onPress={() => Alert.alert('Remover foto oficial?', 'A foto deste ano será removida.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => write.mutate({ method: 'DELETE', success: 'Foto removida.' }) }])}>Remover foto deste ano</Button>}</Surface>}
  </FestaFrame>;
}
