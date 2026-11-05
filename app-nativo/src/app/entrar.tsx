import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { api } from '../api';
import { normalizeUsername } from '../format';
import { useSession } from '../session';
import { theme } from '../theme';
import type { Invite } from '../types';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Surface } from '../ui/Surface';
import { LoopVideo } from '../ui/LoopVideo';
import { Rise } from '../ui/motion';
export default function Login() {
  const params = useLocalSearchParams<{ convite?: string | string[] }>();
  const invitation = typeof params.convite === 'string' ? params.convite.trim() : '';
  return <LoginForm key={invitation} invitation={invitation} />;
}
function LoginForm({ invitation }: { invitation: string }) {
  const [ignoreInvite, setIgnoreInvite] = useState(false);
  const invite = ignoreInvite ? '' : invitation;
  const [mode, setMode] = useState<'login' | 'register'>(invite ? 'register' : 'login');
  const [form, setForm] = useState<{ name: string | null; username: string; password: string; code: string }>({ name: null, username: '', password: '', code: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useSession();
  const check = useQuery({ queryKey: ['invite', invite], enabled: Boolean(invite), retry: false, staleTime: 0,
    queryFn: ({ signal }) => api<Invite>(`/api/invites/check?t=${encodeURIComponent(invite)}`, { public: true, signal }) });
  const name = form.name ?? (check.data?.valid ? check.data.participant_name : '') ?? '';
  const update = (key: keyof typeof form) => (value: string) => { setForm(current => ({ ...current, [key]: value })); setError(''); };
  async function submit() {
    if (busy) return;
    const username = normalizeUsername(form.username);
    if (username.length < 3) { setError('O usuário precisa ter pelo menos 3 letras ou números.'); return; }
    if (!form.password) { setError('Preencha sua senha.'); return; }
    if (mode === 'register') {
      if (!name.trim()) { setError('Preencha seu nome, como a família te chama.'); return; }
      if (form.password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
      if (invite && !check.data?.valid) { setError('Confira seu convite antes de continuar.'); return; }
      if (!invite && !form.code.trim()) { setError('Informe o código da família ou abra seu link de convite.'); return; }
    }
    setBusy(true); setError('');
    try {
      const result = await api<{ ok: boolean; token?: string }>('/api/auth', { method: 'POST', public: true,
        json: { action: mode, username, password: form.password, client: 'app',
          ...(mode === 'register' ? { name: name.trim(), code: invite ? undefined : form.code.trim(), invite: invite || undefined } : {}) } });
      if (!result.ok || !result.token) throw new Error('O servidor não enviou seu acesso ao app. Tente novamente em instantes.');
      await session.signIn(result.token);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível entrar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function unlock() {
    setBusy(true); setError('');
    try { await session.unlock(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível desbloquear. Tente novamente ou use sua senha.'); }
    finally { setBusy(false); }
  }
  const invalidInvite = Boolean(invite) && !check.data?.valid;
  return <View style={styles.page}>
    <LoopVideo name="mn-login" style={[StyleSheet.absoluteFill, { opacity: 0.75 }]} />
    <LinearGradient colors={['rgba(23,27,24,0.2)', 'rgba(23,27,24,0.65)', theme.colors.background]} locations={[0, 0.32, 1]} style={StyleSheet.absoluteFill} />
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.column}>
            <Rise style={styles.brand}><Sparkles color={theme.colors.champagne} size={34} strokeWidth={1} />
              <Text variant="kicker">Dezembro de 2026</Text>
              <View accessible accessibilityRole="header" accessibilityLabel="Natal em Família">
                <Text variant="display" style={styles.title}>Natal em</Text><Text variant="displayItalic" style={styles.title}>Família</Text>
              </View><View style={styles.rule} />
              <Text variant="muted">O melhor do Natal é estar perto.</Text>
            </Rise>
            <Rise index={1} style={styles.form}>
              {session.status === 'locked' && !invite ? <View style={styles.form}>
                <Button onPress={() => { void unlock(); }} loading={busy} icon={<Fingerprint size={19} color={theme.colors.ivory} />}>Entrar com Face ID/digital</Button>
                <Text variant="muted" style={styles.center}>ou entre com seu usuário e senha</Text>
              </View> : null}
              {invite ? <Surface style={styles.invite}>
                <Text variant="kicker">Você foi convidado</Text>
                <Text variant="muted" accessibilityLiveRegion="polite">{check.isPending ? 'Conferindo seu convite...' : check.isError ? check.error.message : check.data?.valid
                  ? `Convite ${check.data.label || 'da família'}. Crie seu acesso para participar.` : `${check.data?.reason ?? 'Convite inválido.'} Peça um novo para quem organiza.`}</Text>
                {check.isError ? <Button variant="ghost" onPress={() => { void check.refetch(); }}>Conferir novamente</Button> : null}
                {invalidInvite && !check.isPending ? <Button variant="quiet" onPress={() => setIgnoreInvite(true)}>Usar o código da família</Button> : null}
              </Surface> : null}
              {mode === 'register' ? <Field label="Seu nome" placeholder="Como a família te chama" value={name} onChangeText={update('name')} autoComplete="name" maxLength={60} editable={!busy} /> : null}
              <Field label="Usuário" placeholder="Seu usuário" value={form.username} onChangeText={update('username')} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={60} editable={!busy} />
              {form.username.trim() && normalizeUsername(form.username) !== form.username.trim() ? <Text variant="muted" style={styles.hint}>
                {mode === 'register' ? 'Seu usuário vai ficar: ' : 'Entrando como: '}<Text style={styles.normalized}>{normalizeUsername(form.username) || '...'}</Text>
              </Text> : null}
              <Field label="Senha" placeholder={mode === 'register' ? 'Pelo menos 6 caracteres' : 'Sua senha'} value={form.password} onChangeText={update('password')}
                secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} editable={!busy}
                onSubmitEditing={() => { if (mode === 'login' || invite) void submit(); }}
                trailing={<Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setShow(value => !value)} style={styles.eye}>
                  {show ? <EyeOff color={theme.colors.secondary} size={20} strokeWidth={1.5} /> : <Eye color={theme.colors.secondary} size={20} strokeWidth={1.5} />}
                </Pressable>} />
              {mode === 'register' && !invite ? <Field label="Código da família" placeholder="Peça para quem organiza" value={form.code} onChangeText={update('code')}
                autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={120} onSubmitEditing={() => { void submit(); }} /> : null}
              {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
              <Button loading={busy} disabled={mode === 'register' && invalidInvite} onPress={() => { void submit(); }}>{mode === 'login' ? 'Entrar' : 'Criar meu acesso'}</Button>
              <Button disabled={busy} variant="quiet" onPress={() => { setMode(current => current === 'login' ? 'register' : 'login'); setError(''); }}>
                {mode === 'login' ? 'Primeira vez aqui? Cadastrar parente' : 'Já tenho acesso. Entrar'}
              </Button>
            </Rise>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 28 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 32 }, brand: { alignItems: 'center', gap: 14 },
  title: { fontSize: 58, lineHeight: 66, textAlign: 'center' }, rule: { width: 64, height: 1, backgroundColor: theme.colors.cherry, marginTop: 6 },
  form: { gap: 14 }, center: { textAlign: 'center' }, invite: { gap: 10, padding: 16 }, hint: { fontSize: 11 },
  normalized: { fontSize: 12, color: theme.colors.champagne }, eye: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 13, color: theme.colors.error },
});
