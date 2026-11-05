import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useConquistas } from './data';

export function SelosPerfil({ id }: { id: number }) {
  const consulta = useConquistas(id);
  if (consulta.isError) return <Text variant="muted">Não foi possível carregar os selos.</Text>;
  const dados = consulta.data;
  if (!dados) return null;
  const selos = dados.selos.filter((s) => s.conquistado);
  return <View style={styles.bloco}><Text variant="kicker">Selos de {dados.ano}</Text>
    <View style={styles.selos}>{selos.map((s) => <View key={s.id} style={styles.selo} accessibilityLabel={`${s.nome}. ${s.descricao}`}><Text style={styles.texto}>{s.nome}</Text></View>)}</View>
    {!selos.length ? <Text variant="muted">As conquistas estão por chegar.</Text> : null}
    <Button variant="quiet" onPress={() => router.push('/conquistas')}>Conhecer todos os selos</Button>
  </View>;
}
const styles = StyleSheet.create({
  bloco: { alignSelf: 'stretch', alignItems: 'center', gap: 12, marginTop: 20 },
  selos: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  selo: { borderWidth: 1, borderColor: theme.colors.champagne, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  texto: { color: theme.colors.champagne, fontSize: 12 },
});
