import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAutenticado } from '../familia/sessao';
import { theme } from '../../theme';
import { Cabecalho } from '../familia/Cabecalho';
import { PedidosConvite } from './Pedidos';

export default function Convidar() {
  const autenticado = useAutenticado();
  if (!autenticado) return null;
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Cabe mais um" titulo="Convidar parente" aoVoltar={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <View style={styles.conteudo}><PedidosConvite /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ pagina: { flex: 1, backgroundColor: theme.colors.background }, miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 }, conteudo: { paddingHorizontal: 24 } });
