import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../theme';
export default function Termos() {
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 24, backgroundColor: theme.colors.background }}>
    <Text variant="kicker">Natal em Família</Text><Text variant="display" accessibilityRole="header">Termos de uso</Text>
    <Text variant="muted">Atualizados em 5 de novembro de 2026.</Text>
    {[["Um espaço da família", "O Natal em Família é um espaço privado da família. O acesso é permitido apenas por convite ou código da família."], ["Respeito em cada publicação", "É proibido publicar conteúdo ofensivo, ilegal ou abusivo, inclusive em fotos, textos e comentários. Ao usar este espaço, você concorda em respeitar todas as pessoas da família."], ["Moderação e denúncias", "Você pode denunciar publicações e comentários e bloquear pessoas. Quem organiza pode remover conteúdo e acessos que violem estes termos. As denúncias são analisadas em até 24 horas."], ["Contato", "Para dúvidas ou pedidos, fale com quem organiza ou escreva para pagamentos@speedupti.com.br."]].map(([titulo, texto]) => <View key={titulo} style={{ gap: 12 }}><Text variant="display" accessibilityRole="header" style={{ fontSize: 26 }}>{titulo}</Text><Text style={{ lineHeight: 25 }}>{texto}</Text></View>)}
    <Button variant="ghost" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/entrar'); }}>Voltar</Button>
  </ScrollView>;
}
