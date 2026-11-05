import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api } from '../../api';
import type { BillingAddress, PaymentInput, PaymentStatus } from '../../types/vaquinha';
import { brl } from '../../format';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Text } from '../../ui/Text';
import { parseValue } from '../vaquinha/data';

const digits = (value: string) => value.replace(/\D/g, '');
export function maskCpf(value: string) {
  return digits(value).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
export function validCpf(value: string) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length < 11; length++) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(cpf[length])) return false;
  }
  return true;
}
const emptyAddress: BillingAddress = { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' };
const states = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);

export function PaymentForm({ status, busy, initialValue, onSubmit, onCancel }: { status: PaymentStatus; busy: boolean; initialValue?: number; onSubmit: (input: PaymentInput) => void; onCancel?: () => void }) {
  const [choice, setChoice] = useState(initialValue && initialValue !== status.amount ? 0 : 1);
  const [custom, setCustom] = useState(initialValue ? initialValue.toFixed(2).replace('.', ',') : '');
  const [cpf, setCpf] = useState('');
  const [address, setAddress] = useState<BillingAddress>(() => ({ ...emptyAddress, ...status.billing.address }));
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentInput, string>>>({});
  const [cepState, setCepState] = useState(() => digits(status.billing.address?.cep ?? '').length === 8 ? 'Buscando endereço...' : '');
  const addressRevision = useRef(0);
  const cep = digits(address.cep);
  useEffect(() => {
    if (cep.length !== 8) return;
    const controller = new AbortController();
    const revision = addressRevision.current;
    void api<Omit<BillingAddress, 'cep' | 'numero'>>(`/api/cep/${cep}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (addressRevision.current === revision) setAddress(current => ({ ...current, ...result }));
      setCepState('Confira o endereço e informe o número.');
    }).catch(cause => { if (!controller.signal.aborted) setCepState(cause instanceof Error ? cause.message : 'Preencha o endereço à mão.'); });
    return () => controller.abort();
  }, [cep]);
  function update(key: keyof BillingAddress, value: string) {
    if (key === 'cep') setCepState(digits(value).length === 8 ? 'Buscando endereço...' : '');
    if (key !== 'cep' && key !== 'numero') addressRevision.current++;
    setAddress(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  }
  const value = choice ? Math.round(status.amount * choice * 100) / 100 : parseValue(custom);
  function submit() {
    const next: typeof errors = {};
    if (!Number.isFinite(value) || value < status.amount || value > 5000) next.valor = `Escolha um valor entre ${brl(status.amount)} e ${brl(5000)}, sem separador de milhar.`;
    if ((!status.billing.has_cpf || cpf.length > 0) && !validCpf(cpf)) next.cpf = 'Confira os 11 números do CPF.';
    if (cep.length !== 8) next.cep = 'O CEP precisa ter 8 números.';
    if (!address.logradouro.trim()) next.logradouro = 'Informe a rua.';
    if (!address.numero.trim()) next.numero = 'Informe o número ou S/N.';
    if (`${address.logradouro.trim()}, ${address.numero.trim()}`.length > 40) next.logradouro = 'Abrevie a rua: rua e número devem somar até 40 caracteres.';
    if (!address.bairro.trim()) next.bairro = 'Informe o bairro.';
    if (!address.cidade.trim()) next.cidade = 'Informe a cidade.';
    if (!states.has(address.uf.trim().toUpperCase())) next.uf = 'Confira a UF.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ valor: value, cpf: digits(cpf), cep, logradouro: address.logradouro.trim(), numero: address.numero.trim(), bairro: address.bairro.trim(), cidade: address.cidade.trim(), uf: address.uf.trim().toUpperCase() });
  }
  return <View style={styles.form}>
    <Text variant="kicker">Um gesto que vira encontro</Text>
    <Text variant="display" style={styles.heading}>Quanto você quer contribuir?</Text>
    <Text variant="muted">Nossa parte começa em {brl(status.amount)}. Se quiser, você pode dar um pouco mais.</Text>
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Valor da contribuição">{[1, 2, 3, 0].map(multiplier => <Pressable key={multiplier} accessibilityRole="radio" accessibilityLabel={multiplier ? `${multiplier === 1 ? 'Mínimo' : `${multiplier} vezes o mínimo`}, ${brl(status.amount * multiplier)}` : 'Outro valor'} accessibilityState={{ checked: choice === multiplier, disabled: busy || (multiplier > 0 && status.amount * multiplier > 5000) }} disabled={busy || (multiplier > 0 && status.amount * multiplier > 5000)} onPress={() => setChoice(multiplier)} style={[styles.choice, choice === multiplier && styles.selected, multiplier > 0 && status.amount * multiplier > 5000 && styles.disabled]}>
      <Text variant="muted" style={styles.choiceLabel}>{multiplier === 1 ? 'Mínimo' : multiplier ? `${multiplier}x` : 'Livre'}</Text><Text style={styles.choiceValue}>{multiplier ? brl(Math.round(status.amount * multiplier * 100) / 100) : 'Outro'}</Text>
    </Pressable>)}</View>
    {!choice ? <Field label="Outro valor (R$)" placeholder="0,00" value={custom} onChangeText={setCustom} keyboardType="decimal-pad" maxLength={8} editable={!busy} error={errors.valor} /> : errors.valor ? <Text accessibilityRole="alert" style={styles.error}>{errors.valor}</Text> : null}
    <View style={styles.divider} />
    <Text variant="display" style={styles.sectionTitle}>Seus dados para o pagamento</Text>
    <Text variant="muted">O banco precisa do CPF e do endereço para emitir seu Pix e boleto.</Text>
    <Field label={status.billing.has_cpf ? `CPF salvo: ${status.billing.cpf_masked ?? 'já informado'}` : 'CPF'} placeholder={status.billing.has_cpf ? 'Deixe vazio para usar o CPF salvo' : '000.000.000-00'} keyboardType="number-pad" value={cpf} onChangeText={text => { setCpf(maskCpf(text)); setErrors(current => ({ ...current, cpf: undefined })); }} maxLength={14} editable={!busy} error={errors.cpf} />
    <Field label="CEP" placeholder="00000-000" keyboardType="number-pad" value={cep.replace(/(\d{5})(\d)/, '$1-$2')} onChangeText={text => update('cep', digits(text).slice(0, 8))} maxLength={9} editable={!busy} error={errors.cep} />
    {cepState ? <Text variant="muted" accessibilityLiveRegion="polite" style={styles.help}>{cepState}</Text> : null}
    <Field label="Rua ou avenida" value={address.logradouro} onChangeText={text => update('logradouro', text)} maxLength={60} editable={!busy} error={errors.logradouro} autoComplete="street-address" />
    <View style={styles.row}><View style={styles.number}><Field label="Número" value={address.numero} onChangeText={text => update('numero', text)} maxLength={10} editable={!busy} error={errors.numero} /></View><View style={styles.flex}><Field label="Bairro" value={address.bairro} onChangeText={text => update('bairro', text)} maxLength={40} editable={!busy} error={errors.bairro} /></View></View>
    <View style={styles.row}><View style={styles.flex}><Field label="Cidade" value={address.cidade} onChangeText={text => update('cidade', text)} maxLength={40} editable={!busy} error={errors.cidade} /></View><View style={styles.uf}><Field label="UF" value={address.uf} onChangeText={text => update('uf', text.replace(/[^a-z]/gi, '').toUpperCase())} maxLength={2} editable={!busy} error={errors.uf} autoCapitalize="characters" /></View></View>
    <Button loading={busy} onPress={submit}>{busy ? 'Preparando seu Pix' : `Gerar Pix${Number.isFinite(value) ? ` de ${brl(value)}` : ''}`}</Button>
    {onCancel ? <Button variant="quiet" disabled={busy} onPress={onCancel}>Voltar ao Pix atual</Button> : null}
  </View>;
}
const styles = StyleSheet.create({
  form: { gap: 18 }, heading: { fontSize: 36, lineHeight: 46 }, sectionTitle: { fontSize: 27, lineHeight: 36 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { flexGrow: 1, flexBasis: '44%', padding: 14, minHeight: 76, borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: 16, justifyContent: 'center', gap: 4 }, selected: { borderColor: theme.colors.champagne, backgroundColor: theme.colors.field }, disabled: { opacity: 0.4 }, choiceLabel: { fontSize: 10 }, choiceValue: { fontFamily: theme.fonts.medium, fontSize: 15 }, divider: { height: 1, backgroundColor: theme.colors.line, marginVertical: 8 }, row: { flexDirection: 'row', gap: 12 }, flex: { flex: 1, minWidth: 0 }, number: { width: 100 }, uf: { width: 76 }, help: { fontSize: 11 }, error: { color: theme.colors.error, fontSize: 13 },
});
