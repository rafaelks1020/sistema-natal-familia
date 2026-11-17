import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useConquistas } from './data';

export function SelosPerfil({ id }: { id: number }) {
  const consulta = useConquistas(id);
  if (consulta.isError) return <Text variant="muted">Não foi possível carregar as conquistas.</Text>;
  const dados = consulta.data;
  if (!dados) return null;
  const ganhas = dados.conquistas.filter((c) => c.conquistado);
  return <View style={styles.bloco}><Text variant="kicker">Conquistas de {dados.ano}</Text>
    <View style={styles.lista}>{ganhas.map((c) => <View key={c.id} style={styles.item} accessibilityLabel={`${c.nome}. ${c.descricao}`}><Text style={styles.texto}>{c.nome}</Text></View>)}</View>
    {!ganhas.length ? <Text variant="muted">As conquistas estão por chegar.</Text> : null}
    <Button variant="quiet" onPress={() => router.push('/conquistas')}>Conhecer todas as conquistas</Button>
  </View>;
}
const styles = StyleSheet.create({
  bloco: { alignSelf: 'stretch', alignItems: 'center', gap: 12, marginTop: 20 },
  lista: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  item: { borderWidth: 1, borderColor: theme.colors.champagne, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  texto: { color: theme.colors.champagne, fontSize: 14 },
});
