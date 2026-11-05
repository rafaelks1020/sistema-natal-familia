import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { months, revealDateLabel } from './data';

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value ?? '').join('-');
}

export function RevealDate({ value, onChange, disabled }: { value: string | null; onChange: (value: string | null) => void; disabled: boolean }) {
  const [year = new Date().getFullYear(), month = 1, day = 1] = (value ?? today()).split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  function change(nextYear: number, nextMonth: number, nextDay: number) {
    const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(nextDay, lastDay)).padStart(2, '0')}`);
  }
  return <View style={styles.group}>
    <View style={styles.row}><View style={styles.flex}><Text>Agendar a revelação</Text><Text variant="muted">{value ? `Abre em ${revealDateLabel(value)}` : 'Liberar assim que o sorteio terminar'}</Text></View>
      <Switch accessibilityLabel="Agendar a data da revelação" value={value !== null} disabled={disabled} onValueChange={enabled => onChange(enabled ? today() : null)} trackColor={{ false: theme.colors.field, true: theme.colors.sage }} thumbColor={theme.colors.ivory} />
    </View>
    {value ? <View style={styles.selector}>
      <View style={styles.year}><Button variant="quiet" style={styles.yearButton} disabled={disabled || year <= 2000} accessibilityLabel="Ano anterior" onPress={() => change(year - 1, month, day)}>-</Button>
        <Text variant="numeral" style={styles.yearText}>{year}</Text><Button variant="quiet" style={styles.yearButton} disabled={disabled || year >= 2100} accessibilityLabel="Próximo ano" onPress={() => change(year + 1, month, day)}>+</Button></View>
      <View style={styles.row}>
        <View style={styles.column}><Text variant="kicker" style={styles.center}>Dia</Text><ScrollView nestedScrollEnabled style={styles.wheel} contentOffset={{ x: 0, y: Math.max(0, day - 2) * 50 }} keyboardShouldPersistTaps="handled" accessibilityLabel="Dia da revelação">
          {Array.from({ length: days }, (_, i) => i + 1).map(number => <Button key={number} variant={day === number ? 'ghost' : 'quiet'} selected={day === number} disabled={disabled} accessibilityLabel={`Dia ${number}`} onPress={() => change(year, month, number)}>{String(number).padStart(2, '0')}</Button>)}
        </ScrollView></View>
        <View style={styles.column}><Text variant="kicker" style={styles.center}>Mês</Text><ScrollView nestedScrollEnabled style={styles.wheel} contentOffset={{ x: 0, y: Math.max(0, month - 2) * 50 }} keyboardShouldPersistTaps="handled" accessibilityLabel="Mês da revelação">
          {months.map((label, index) => <Button key={label} variant={month === index + 1 ? 'ghost' : 'quiet'} selected={month === index + 1} disabled={disabled} onPress={() => change(year, index + 1, day)}>{label}</Button>)}
        </ScrollView></View>
      </View>
      <Text variant="muted" style={styles.note}>Abertura no início do dia escolhido, no horário de São Paulo.</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, flex: { flex: 1 },
  selector: { padding: 12, borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.line, gap: 12 },
  year: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, yearText: { fontSize: 27, lineHeight: 35 }, yearButton: { minWidth: 50 },
  column: { flex: 1, gap: 10 }, wheel: { height: 160, flexGrow: 0, backgroundColor: theme.colors.field, borderRadius: theme.radius.field }, center: { textAlign: 'center' }, note: { fontSize: 11 },
});
