import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ExternalLink from 'lucide-react-native/icons/external-link';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';
import { abrirNoSite } from '../../web';

export type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
// `rota` abre uma tela do app; `site` abre a tela do site no navegador, já com a pessoa logada.
export type Atalho = { titulo: string; texto: string; icon: Icone } & ({ rota: string; site?: never } | { site: string; rota?: never });

function abrir(item: Atalho) {
  if (item.site !== undefined) void abrirNoSite(item.site);
  else router.push(item.rota as Href);
}

export function ListaAtalhos({ itens }: { itens: Atalho[] }) {
  return <View style={styles.lista}>
    {itens.map(item => {
      const { titulo, texto, icon: Icon } = item;
      const noSite = item.site !== undefined;
      return <Pressable key={item.site ?? item.rota} accessibilityRole={noSite ? 'link' : 'button'}
        accessibilityLabel={`${titulo}. ${texto}${noSite ? '. Abre no navegador' : ''}`}
        onPress={() => abrir(item)} style={({ pressed }) => [styles.item, pressed && styles.apertado]}>
        <View style={styles.icone}><Icon size={22} color={theme.colors.champagne} strokeWidth={1.5} /></View>
        <View style={styles.flex}>
          <Text variant="display" style={styles.titulo}>{titulo}</Text>
          <Text variant="muted">{texto}</Text>
          {noSite ? <View style={styles.navegador}>
            <ExternalLink size={16} color={theme.colors.champagne} strokeWidth={1.6} />
            <Text variant="muted" style={styles.navegadorTexto}>Abre no navegador</Text>
          </View> : null}
        </View>
        <ChevronRight size={22} color={theme.colors.champagne} strokeWidth={1.6} />
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  lista: { borderTopWidth: 1, borderColor: theme.colors.line },
  item: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: theme.colors.line },
  apertado: { opacity: 0.7 },
  icone: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(191,165,119,0.4)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  titulo: { fontSize: 22, lineHeight: 28 },
  navegador: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  navegadorTexto: { color: theme.colors.champagne },
});
