import { router, type Href } from 'expo-router';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Surface } from '../../ui/Surface';
import { LoopVideo } from '../../ui/LoopVideo';
import { FestaFrame, styles } from './shared';
import { useChallenges } from './data';
const links: { href: Href; title: string; text: string }[] = [
  { href: '/festa-desafio', title: 'Desafio de foto', text: 'Envie sua foto e vote na sua favorita.' },
  { href: '/festa-foto-oficial', title: 'Foto oficial', text: 'Mesma pose todo ano. Compare as lembranças.' },
  { href: '/festa-quiz', title: 'Quiz da família', text: 'Quem conhece melhor a nossa história?' },
  { href: '/festa-bingo', title: 'Bingo de Natal', text: 'Prepare sua cartela e venha brincar.' },
  { href: '/festa-enquete', title: 'Enquete ao vivo', text: 'A família escolhe e acompanha o resultado.' },
  { href: '/amigo-oculto-ao-vivo', title: 'Revelação do amigo oculto', text: 'Acompanhe cada surpresa da noite.' },
];
export default function Festa() {
  const query = useChallenges();
  const aberto = query.data?.desafios.find((c) => c.aberto);
  return <FestaFrame title="A noite da ceia" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <Surface style={styles.gap}><LoopVideo name="mn-ceia" style={styles.video} /><Text variant="kicker">{query.data ? `Natal ${query.data.ano}` : 'Todo mundo junto'}</Text><Text variant="display">A festa é nossa.</Text><Text variant="muted">Fotos, brincadeiras e as lembranças que ficam.</Text>{aberto && <Text>Desafio aberto: {aberto.titulo}</Text>}</Surface>
    {links.map((link) => <Surface key={String(link.href)} style={styles.gap}><Text variant="display" style={{ fontSize: 26 }}>{link.title}</Text><Text variant="muted">{link.text}</Text><Button variant="ghost" onPress={() => router.push(link.href)}>Abrir {link.title.toLocaleLowerCase('pt-BR')}</Button></Surface>)}
    <Text variant="muted">Para usar o telão, abra natalemfamilia.com.br/telao no navegador da TV e entre com sua conta.</Text>
  </FestaFrame>;
}
