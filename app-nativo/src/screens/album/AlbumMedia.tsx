import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Images from 'lucide-react-native/icons/images';
import { media, type MediaName } from '../../media';
import { theme } from '../../theme';
import { LoopVideo } from '../../ui/LoopVideo';

// A integração adiciona os novos vídeos ao manifesto compartilhado.
// Até lá, preserva a faixa sem usar outro vídeo nem uma URL externa.
export function AlbumMedia({ name, visible = true, style }: {
  name: 'mn-album' | 'mn-vazio'; visible?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const available = (Object.keys(media) as MediaName[]).find(key => String(key) === name);
  return available ? <LoopVideo name={available} visible={visible} style={style} />
    : <View accessible={false} style={[styles.fallback, style]}>
      <Images size={44} strokeWidth={1} color={theme.colors.champagne} />
    </View>;
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
});
