import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import MapPin from 'lucide-react-native/icons/map-pin';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import type { HomeData } from '../../types';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { ceiaKeys } from './chaves';
import { Secao } from './Secao';
import { sessaoVigente } from '../familia/sessao';
import type { CeiaDados, CeiaEvento } from './tipos';
import { camposDeIso, diasAte, formatarQuando, isoDeBrasilia, mascaraData, mascaraHora, textoDias } from './texto';

export function EventoCeia({ evento, admin }: { evento: CeiaEvento; admin: boolean }) {
  const toast = useToast();
  const quando = formatarQuando(evento.event_date);
  const [agora, setAgora] = useState(Date.now);
  const inicio = camposDeIso(evento.event_date);
  const [rascunho, setRascunho] = useState<{ data: string; hora: string; local: string } | null>(null);
  const data = rascunho?.data ?? inicio.data;
  const hora = rascunho?.hora ?? inicio.hora;
  const local = rascunho?.local ?? evento.event_place;
  useFocusEffect(useCallback(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []));
  const dias = diasAte(evento.event_date, agora);
  const salvar = useMutation({
    mutationFn: (vars: { ajustes: CeiaEvento; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<CeiaEvento>('/api/settings', { method: 'PUT', json: vars.ajustes });
    },
    onSuccess: (salvo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, evento: salvo } : atual);
      queryClient.setQueryData<HomeData>(queryKeys.home, (atual) => atual ? { ...atual, settings: { ...atual.settings, ...salvo } } : atual);
      setRascunho(null);
      toast('Data, hora e local da ceia foram salvos.');
    },
    onError: (erro) => toast(erro.message, 'error'),
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
  function guardar() {
    if (salvar.isPending) return;
    const iso = isoDeBrasilia(data, hora);
    if (!iso) { toast('Informe uma data e um horário válidos. Use o horário de Brasília.', 'error'); return; }
    if (local.trim().length > 500) { toast('O local passou de 500 caracteres.', 'error'); return; }
    const contribution_value = Number(evento.contribution_value);
    if (!Number.isFinite(contribution_value)) { toast('Não deu para guardar a contribuição atual da ceia.', 'error'); return; }
    salvar.mutate({
      generation: sessionStore.getGeneration(),
      ajustes: { event_title: evento.event_title, event_date: iso, event_place: local.trim(), contribution_value },
    });
  }
  return <Secao indice="01" kicker="Quando e onde" titulo="A nossa noite">
    <Text style={styles.data}>{quando.data}</Text>
    {quando.hora ? <Text variant="muted">{quando.hora}, horário de Brasília</Text> : null}
    <View style={styles.local}>
      <MapPin size={16} color={theme.colors.champagne} strokeWidth={1.5} />
      <Text variant="muted" style={styles.flex}>{evento.event_place || 'O local ainda vai ser combinado.'}</Text>
    </View>
    {dias !== null && dias >= 0 ? <Text variant="numeral" style={styles.dias}>{dias}</Text> : null}
    <Text variant="muted">{textoDias(dias)}</Text>
    {admin ? <View style={styles.form}>
      <View style={styles.quando}>
        <View style={styles.flex}><Field label="Data" value={data} onChangeText={(texto) => setRascunho({ data: mascaraData(texto), hora, local })} placeholder="24/12/2026" keyboardType="number-pad" maxLength={10} /></View>
        <View style={styles.hora}><Field label="Hora" value={hora} onChangeText={(texto) => setRascunho({ data, hora: mascaraHora(texto), local })} placeholder="20:00" keyboardType="number-pad" maxLength={5} /></View>
      </View>
      <Field label="Local" value={local} onChangeText={(texto) => setRascunho({ data, hora, local: texto })} placeholder="Casa, endereço ou ponto de encontro" maxLength={500} />
      <Button loading={salvar.isPending} onPress={guardar}>Salvar data e local</Button>
    </View> : null}
  </Secao>;
}

const styles = StyleSheet.create({
  data: { fontSize: 18, textTransform: 'capitalize' },
  local: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  dias: { fontSize: 64, lineHeight: 72 },
  form: { gap: 14, marginTop: 8 },
  quando: { flexDirection: 'row', gap: 12 },
  hora: { width: 110 },
});
