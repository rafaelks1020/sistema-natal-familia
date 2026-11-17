import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import CalendarCog from 'lucide-react-native/icons/calendar-cog';
import LogOut from 'lucide-react-native/icons/log-out';
import Pencil from 'lucide-react-native/icons/pencil';
import { situacaoPush } from '../../push';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Surface } from '../../ui/Surface';
import { TamanhoDaLetra } from '../../ui/TamanhoDaLetra';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { AtivarAvisos } from '../AtivarAvisos';
import { Cabecalho } from '../familia/Cabecalho';
import CartaoPontos from '../pontos/CartaoPontos';
import { ListaAtalhos, type Atalho } from './ListaAtalhos';

const ORGANIZAR: Atalho[] = [
  { rota: '/organizar', titulo: 'Organizar o Natal', texto: 'Datas, lista e o que a noite precisa', icon: CalendarCog },
];

export default function AbaEu() {
  const { user, signOut } = useSession();
  const toast = useToast();
  const [avisos, setAvisos] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  useEffect(() => {
    let vivo = true;
    situacaoPush().then(s => { if (vivo) setAvisos(s); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!user) return null;
  // Sair pede confirmação: um toque sem querer obrigaria a pessoa a digitar usuário e senha de novo.
  function sair() {
    Alert.alert('Sair do aplicativo?', 'Para entrar de novo você vai precisar do seu usuário e da sua senha.', [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { void signOut().catch(() => toast('O acesso foi encerrado. Não conseguimos remover todos os dados salvos.', 'error')); } },
    ]);
  }
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Sua área" titulo="Eu" />
    <View style={styles.conteudo}>
      <Surface style={styles.perfil}>
        <Avatar name={user.name} src={user.avatar_url} size={96} />
        <Text variant="display" style={styles.nome}>{user.name}</Text>
        <Button variant="ghost" style={styles.largo} onPress={() => router.push(`/familia/${user.id}`)}
          icon={<Pencil size={18} color={theme.colors.champagne} strokeWidth={1.6} />}>Editar meu perfil e foto</Button>
      </Surface>

      <View style={styles.secao}>
        <Text variant="kicker" accessibilityRole="header">Tamanho da letra</Text>
        <Text variant="muted">Escolha o que fica melhor para ler. Vale para o app inteiro.</Text>
        <TamanhoDaLetra />
      </View>

      <CartaoPontos />

      <View style={styles.secao}>
        <Text variant="kicker" accessibilityRole="header">Avisos</Text>
        {avisos === 'granted' ? <Text variant="muted">Os avisos da família estão ligados neste celular.</Text>
          : avisos === 'denied' ? <Text variant="muted">Os avisos estão desligados. Para ligar, abra os Ajustes do celular, procure Natal em Família e permita as notificações.</Text>
            : null}
        <View style={styles.avisos}><AtivarAvisos /></View>
      </View>

      {user.is_admin ? <View style={styles.secao}>
        <Text variant="kicker" accessibilityRole="header">Organizar</Text>
        <ListaAtalhos itens={ORGANIZAR} />
      </View> : null}

      <Button variant="ghost" onPress={sair} icon={<LogOut size={18} color={theme.colors.ivory} strokeWidth={1.6} />}>Sair</Button>

      <View style={styles.links}>
        <Pressable accessibilityRole="link" accessibilityLabel="Termos de uso" onPress={() => router.push('/termos')} style={({ pressed }) => [styles.link, pressed && styles.apertado]}>
          <Text variant="muted" style={styles.linkTexto}>Termos de uso</Text>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="Privacidade" onPress={() => router.push('/privacidade')} style={({ pressed }) => [styles.link, pressed && styles.apertado]}>
          <Text variant="muted" style={styles.linkTexto}>Privacidade</Text>
        </Pressable>
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, marginTop: 16, gap: 32 },
  perfil: { alignItems: 'center', gap: 16 },
  nome: { fontSize: 28, lineHeight: 36, textAlign: 'center' },
  largo: { alignSelf: 'stretch' },
  secao: { gap: 12 },
  // O cartão de avisos traz margem própria para o Hoje; aqui ele já está dentro da coluna.
  avisos: { marginHorizontal: -16, marginTop: -16 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 },
  link: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 8 },
  apertado: { opacity: 0.7 },
  linkTexto: { textDecorationLine: 'underline' },
});
