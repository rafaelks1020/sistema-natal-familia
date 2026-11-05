import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { baixarArquivo } from '../../api';
import Copy from 'lucide-react-native/icons/copy';
import type { Payment } from '../../types/vaquinha';
import { theme } from '../../theme';
import { brl } from '../../format';
import { Button } from '../../ui/Button';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { dateLabel } from '../vaquinha/data';

export function PixPanel({ payment, checking, error, onChange, onRefresh }: { payment: Payment; checking: boolean; error?: string; onChange: () => void; onRefresh: () => void }) {
  const toast = useToast();
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  async function abrirPdf() {
    setBaixandoPdf(true);
    try {
      const arquivo = await baixarArquivo('/api/pagamento/pdf', 'boleto-vaquinha-natal.pdf');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Boleto da vaquinha' });
      } else {
        toast('Não dá para abrir o PDF neste aparelho. Use a linha do boleto.');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para abrir o PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  }
  const { width } = useWindowDimensions();
  const [copying, setCopying] = useState<'pix' | 'boleto' | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const copyingRef = useRef(false);
  async function copy(kind: 'pix' | 'boleto') {
    const code = kind === 'pix' ? payment.pix_copia_cola : payment.linha_digitavel;
    if (!code || copyingRef.current) return;
    copyingRef.current = true; setCopying(kind);
    try {
      const copied = await Clipboard.setStringAsync(code, { android: { isSensitive: true } });
      if (!copied) throw new Error('Não foi possível copiar. Tente novamente.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(kind === 'pix' ? 'Cole no app do seu banco' : 'Linha do boleto copiada. Cole no app do seu banco.');
    } catch (cause) { toast(cause instanceof Error ? cause.message : 'Não foi possível copiar.', 'error'); }
    finally { copyingRef.current = false; setCopying(null); }
  }
  return <View style={styles.content}>
    <Text variant="kicker">Sua contribuição para a ceia</Text>
    <Text variant="display" style={styles.heading}>Um Pix, muitos encontros.</Text>
    <Text variant="numeral" numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>{brl(payment.amount)}</Text>
    <Text variant="muted">Copie o código e escolha Pix Copia e Cola no app do seu banco.</Text>
    {payment.pix_copia_cola ? <Button loading={copying === 'pix'} disabled={copying === 'boleto'} onPress={() => { void copy('pix'); }} icon={<Copy size={18} color={theme.colors.ivory} />}>Copiar código Pix</Button> : <Text accessibilityRole="alert" variant="muted">O código Pix ainda não está disponível. Atualize a consulta ou use a linha do boleto.</Text>}
    <Surface style={styles.waiting}><View style={styles.dot} /><View style={styles.flex}><Text style={styles.waitingTitle}>Aguardando confirmação</Text><Text variant="muted" style={styles.small}>A confirmação aparece aqui assim que o banco avisar. Você pode voltar depois.</Text></View></Surface>
    {error ? <View accessibilityLiveRegion="polite" style={styles.errorBox}><Text style={styles.error}>Não conseguimos confirmar agora.</Text><Text variant="muted">{error}</Text><Button variant="ghost" loading={checking} onPress={onRefresh}>Consultar novamente</Button></View> : null}
    {payment.pix_copia_cola && !qrFailed ? <View style={styles.qrSection}><Text variant="display" style={styles.sectionTitle}>Vai pagar de outro aparelho?</Text><Text variant="muted" style={styles.center}>Abra o banco no outro aparelho e leia este QR Code.</Text><View style={styles.qr} accessible accessibilityLabel={`QR Code Pix de ${brl(payment.amount)}. Você também pode usar o botão Copiar código Pix.`}><QRCode value={payment.pix_copia_cola} size={Math.max(140, Math.min(232, width - 112))} color={theme.colors.background} backgroundColor={theme.colors.ivory} quietZone={16} ecl="M" onError={() => setQrFailed(true)} /></View></View> : qrFailed ? <Text variant="muted">Não foi possível exibir o QR Code. Use o botão Copiar código Pix.</Text> : null}
    <View style={styles.divider} />
    <Text variant="kicker">Também pode ser por boleto</Text>
    {payment.due_date ? <Text variant="muted">Vencimento: {dateLabel(payment.due_date)}</Text> : null}
    <Button variant="ghost" disabled={!payment.linha_digitavel || copying === 'pix'} loading={copying === 'boleto'} onPress={() => { void copy('boleto'); }}>Copiar linha do boleto</Button>
    <Button variant="ghost" loading={baixandoPdf} disabled={baixandoPdf} onPress={() => { void abrirPdf(); }}>Boleto em PDF</Button>
    <Button variant="quiet" onPress={onChange}>Trocar o valor</Button>
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: 18 }, heading: { fontSize: 37, lineHeight: 47 }, amount: { fontSize: 64, lineHeight: 86 }, waiting: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 18 }, waitingTitle: { fontFamily: theme.fonts.medium, fontSize: 13 }, small: { fontSize: 11, lineHeight: 18 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.champagne }, flex: { flex: 1 }, qrSection: { alignItems: 'center', gap: 14, paddingTop: 12 }, sectionTitle: { fontSize: 25, lineHeight: 34, textAlign: 'center' }, center: { textAlign: 'center' }, qr: { padding: 4, borderRadius: 18, overflow: 'hidden', backgroundColor: theme.colors.ivory }, divider: { height: 1, backgroundColor: theme.colors.line, marginVertical: 8 }, errorBox: { gap: 8 }, error: { color: theme.colors.error, fontSize: 13 },
});
