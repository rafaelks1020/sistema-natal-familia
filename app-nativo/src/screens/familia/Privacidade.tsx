import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';
import { Cabecalho } from './Cabecalho';

const SECOES: { titulo: string; texto: string[] }[] = [
  {
    titulo: 'Quem somos',
    texto: [
      'O Natal em Família é um espaço privado para uma família organizar o Natal: mural de fotos e recados, amigo oculto, vaquinha da ceia, álbum e confirmação de presença. Só entra quem recebe convite ou o código da família.',
    ],
  },
  {
    titulo: 'O que guardamos',
    texto: [
      'Nome, usuário e senha (a senha é guardada cifrada, ninguém consegue lê-la).',
      'O que você publica: fotos, textos, comentários, curtidas, votos, lista de desejos e presença.',
      'Para pagar a vaquinha pelo Pix, o banco exige CPF e endereço de quem paga. Guardamos esses dados só para gerar os próximos pagamentos.',
      'No aplicativo, um identificador do aparelho para enviar notificações, se você permitir.',
    ],
  },
  {
    titulo: 'Para que usamos',
    texto: [
      'Só para o funcionamento do app dentro da família. Não vendemos, não alugamos e não usamos seus dados para propaganda.',
      'O pagamento é processado pelo C6 Bank, que recebe nome, CPF, endereço e valor para emitir o Pix.',
      'Fotos, vídeos e áudios ficam guardados em armazenamento da Hetzner, na Alemanha; o banco de dados fica em servidor no Brasil.',
    ],
  },
  {
    titulo: 'Quem vê',
    texto: [
      'Tudo o que você publica é visto pelas pessoas da família cadastradas no app.',
      'O nome de quem você tirou no amigo oculto só aparece para você. Nem quem organiza vê os pares.',
      'CPF e endereço não aparecem para ninguém da família.',
    ],
  },
  {
    titulo: 'Seus direitos (LGPD)',
    texto: [
      'Você pode editar seu perfil a qualquer momento e excluir sua conta em Perfil > Excluir minha conta. A exclusão apaga login, publicações, comentários, curtidas e os dados de pagamento guardados. O registro de que uma contribuição foi paga continua na vaquinha, sem seus dados pessoais.',
      'Para qualquer pedido sobre seus dados, fale com quem organiza o Natal da sua família ou escreva para pagamentos@speedupti.com.br.',
    ],
  },
];

export default function Privacidade() {
  const { status } = useSession();
  function voltar() {
    if (router.canGoBack()) router.back();
    else router.replace(status === 'authenticated' ? '/' : '/entrar');
  }
  return <View style={styles.pagina}>
    <ScrollView contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
      <Cabecalho kicker="Natal em Família" titulo="Privacidade" aoVoltar={voltar} />
      <Text variant="muted" style={styles.quando}>Atualizada em 5 de novembro de 2026.</Text>
      {SECOES.map((secao) => <View key={secao.titulo} style={styles.secao}>
        <Text variant="display" accessibilityRole="header" style={styles.titulo}>{secao.titulo}</Text>
        {secao.texto.map((paragrafo) => <Text key={paragrafo} style={styles.paragrafo}>{paragrafo}</Text>)}
      </View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  quando: { paddingHorizontal: 24, marginBottom: 28 },
  secao: { paddingHorizontal: 24, marginBottom: 32, gap: 12 },
  titulo: { fontSize: 26, lineHeight: 34 },
  paragrafo: { color: theme.colors.secondary, fontSize: 15, lineHeight: 24 },
});
