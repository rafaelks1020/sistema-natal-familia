import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import Check from 'lucide-react-native/icons/check';
import { api, ApiError, sessionStore } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from './Cabecalho';
import { sessaoVigente, useAutenticado } from './sessao';

const APAGA = ['seu login e perfil', 'suas fotos, recados, comentários, curtidas e votos', 'CPF e endereço guardados para o Pix'];

export default function ExcluirConta() {
  const ok = useAutenticado();
  const { signOut } = useSession();
  const toast = useToast();
  const [senha, setSenha] = useState('');
  const [certeza, setCerteza] = useState(false);
  const excluir = useMutation({
    mutationFn: ({ password, generation }: { password: string; generation: number }) => {
      if (!sessaoVigente(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<{ ok: boolean }>('/api/me', { method: 'DELETE', json: { password } });
    },
    onSuccess: async (_resposta, { generation }) => {
      if (!sessaoVigente(generation)) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Sua conta foi excluída.');
      try { await signOut(); }
      catch { toast('A conta foi excluída. Não conseguimos limpar todos os dados deste aparelho.', 'error'); }
    },
    onError: (erro) => toast(erro.message, 'error'),
  });
  if (!ok) return null;
  function confirmar() {
    if (excluir.isPending || !certeza || !senha) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    excluir.mutate({ password: senha, generation: sessionStore.getGeneration() });
  }
  return <KeyboardAvoidingView style={styles.pagina} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
      <Cabecalho kicker="Sua conta" titulo="Excluir conta" aoVoltar={() => { if (router.canGoBack()) router.back(); else router.replace('/familia'); }} />
      <View style={styles.aviso}>
        <Text style={styles.corpo}>Ao excluir, apagamos para sempre:</Text>
        {APAGA.map((item) => <Text key={item} style={styles.item}>{item}</Text>)}
        <Text style={styles.corpo}>O registro de que você contribuiu continua na vaquinha da família, sem seus dados pessoais.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacidade')} style={styles.link}>
          <Text style={styles.linkTexto}>Política de privacidade</Text>
        </Pressable>
      </View>
      <View style={styles.form}>
        <Field label="Sua senha, para confirmar" value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" maxLength={1024} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: certeza }} accessibilityLabel="Entendo que isso não pode ser desfeito" onPress={() => setCerteza((atual) => !atual)} style={styles.certeza}>
          <View style={[styles.caixa, certeza && styles.caixaOn]}>{certeza ? <Check size={14} color={theme.colors.ivory} strokeWidth={2} /> : null}</View>
          <Text variant="muted" style={styles.flex}>Entendo que isso não pode ser desfeito.</Text>
        </Pressable>
        <Button loading={excluir.isPending} disabled={!certeza || senha.length === 0} onPress={confirmar}>Excluir minha conta</Button>
        <Button variant="quiet" disabled={excluir.isPending} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/familia'); }}>Cancelar</Button>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  aviso: { marginHorizontal: 24, marginTop: 12, padding: 22, gap: 12, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  corpo: { color: theme.colors.secondary, fontSize: 15, lineHeight: 23 },
  item: { fontSize: 15, lineHeight: 23 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkTexto: { color: theme.colors.champagne, textDecorationLine: 'underline', fontSize: 14 },
  form: { paddingHorizontal: 24, paddingTop: 22, gap: 16 },
  certeza: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  caixa: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  caixaOn: { backgroundColor: theme.colors.cherry, borderColor: theme.colors.cherry },
  flex: { flex: 1 },
});
