import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Bell from 'lucide-react-native/icons/bell';
import { ativarPush, situacaoPush } from '../push';
import { theme } from '../theme';
import { Button } from '../ui/Button';
import { Surface } from '../ui/Surface';
import { Text } from '../ui/Text';
import { useToast } from '../ui/Toast';

// Cartão do Início que pede a permissão de notificação só quando a pessoa toca.
// Some quando a permissão já foi dada ou negada (negada: o sistema não deixa pedir de novo).
export function AtivarAvisos() {
  const toast = useToast();
  const [mostrar, setMostrar] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    situacaoPush()
      .then((s) => vivo && setMostrar(s === 'undetermined'))
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!mostrar) return null;

  async function ativar() {
    setBusy(true);
    try {
      const ok = await ativarPush();
      if (ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast('Pronto! Você vai saber quando a família postar.');
      }
      setMostrar(false);
    } catch {
      toast('Não deu para ativar agora. Tente de novo mais tarde.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface style={styles.card}>
      <View style={styles.row}>
        <Bell size={22} strokeWidth={1.5} color={theme.colors.champagne} />
        <View style={styles.texto}>
          <Text variant="kicker">Avisos da família</Text>
          <Text variant="muted">Saiba na hora quando comentarem sua foto, quando sair o amigo oculto e quando seu Pix cair.</Text>
        </View>
      </View>
      <Button variant="primary" loading={busy} disabled={busy} onPress={() => { void ativar(); }}>Ativar avisos</Button>
      <Button variant="quiet" onPress={() => setMostrar(false)}>Agora não</Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.lg },
  row: { flexDirection: 'row', gap: theme.space.md, alignItems: 'flex-start' },
  texto: { flex: 1, gap: 4 },
});
