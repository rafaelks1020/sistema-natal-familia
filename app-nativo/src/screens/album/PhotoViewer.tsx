import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import X from 'lucide-react-native/icons/x';
import Download from 'lucide-react-native/icons/download';
import Share2 from 'lucide-react-native/icons/share-2';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import { API_BASE_URL, sessionStore } from '../../api';
import { theme } from '../../theme';
import type { AlbumItem } from '../../types/album';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { ZoomPhoto } from './ZoomPhoto';

class AlbumExportError extends Error {}

export function PhotoViewer({ photos, initialKey, onClose, hasMore, loadingMore, error, onLoadMore }: {
  photos: AlbumItem[]; initialKey: string; onClose: () => void; hasMore: boolean;
  loadingMore: boolean; error: string | null; onLoadMore: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const inset = useSafeAreaInsets();
  const [currentKey, setCurrentKey] = useState(initialKey);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [stageHeight, setStageHeight] = useState(Math.max(120, height - inset.top - inset.bottom - 260));
  const lock = useRef(false);
  const mounted = useRef(true);
  const dismissY = useSharedValue(0);
  const index = photos.findIndex(item => item.key === currentKey);
  const photo = photos[index];
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - dismissY.get() / Math.max(1, stageHeight)) }));
  const chrome = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - dismissY.get() / 180) }));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!photo) onClose(); }, [photo, onClose]);
  const navigate = useCallback((delta: number) => {
    const target = photos[index + delta];
    if (!target) return;
    dismissY.set(0); setCurrentKey(target.key); setNotice(null);
    void Haptics.selectionAsync().catch(() => {});
  }, [dismissY, index, photos]);
  if (!photo) return null;
  const current = photo;

  function inform(text: string, isError = false) {
    if (!mounted.current) return;
    setNotice({ text, error: isError }); AccessibilityInfo.announceForAccessibility(text);
  }

  async function exportPhoto(action: 'save' | 'share') {
    if (lock.current) return;
    lock.current = true; setBusy(action); setNotice(null);
    const generation = sessionStore.getGeneration();
    let temporary: Directory | null = null;
    const sessionActive = () => generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
    try {
      if (action === 'save') {
        const config = Constants.expoConfig;
        const hasPlugin = config?.plugins?.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-media-library');
        if (Platform.OS === 'ios' && !config?.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription && !hasPlugin && Constants.appOwnership !== 'expo') {
          throw new AlbumExportError('Salvar fotos precisa ser habilitado na próxima versão do app. Por enquanto, use Compartilhar.');
        }
        const permission = await requestPermissionsAsync(true, ['photo']);
        if (!permission.granted) throw new AlbumExportError(permission.canAskAgain
          ? 'Permita salvar fotos para guardar esta memória na galeria.'
          : 'Permita adicionar fotos nos Ajustes do aparelho para salvar esta memória.');
      } else if (!await Sharing.isAvailableAsync()) throw new AlbumExportError('O compartilhamento não está disponível neste aparelho.');
      if (!sessionActive() || !mounted.current) return;
      const url = new URL(current.url, API_BASE_URL);
      if (url.protocol !== 'https:') throw new AlbumExportError('O endereço desta foto não está disponível para download.');
      const extension = url.pathname.match(/\.(jpe?g|png|webp|heic|heif|gif|avif)$/i)?.[1]?.toLowerCase();
      temporary = new Directory(Paths.cache, `album-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      temporary.create();
      // A pasta temporária também é removida quando o Android deixa download parcial.
      const destination = extension ? new File(temporary, `natal-em-familia.${extension}`) : temporary;
      const file = await File.downloadFileAsync(url.toString(), destination);
      if (!sessionActive() || !mounted.current) return;
      if (action === 'save') {
        await Asset.create(file.uri);
        if (sessionActive()) {
          inform('Foto salva na sua galeria.');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else await Sharing.shareAsync(file.uri, { dialogTitle: 'Compartilhar memória de Natal' });
    } catch (failure) {
      if (sessionActive()) inform(failure instanceof AlbumExportError
        ? failure.message : 'Não foi possível preparar a foto. Confira a conexão e tente de novo.', true);
    } finally {
      try { if (temporary?.exists) temporary.delete(); } catch { /* O sistema também limpa seu cache temporário. */ }
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  const date = new Date(current.created_at);
  const dateLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
  return <Modal visible transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent
    navigationBarTranslucent onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
    <GestureHandlerRootView style={styles.root}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <View style={[styles.content, { paddingTop: inset.top, paddingBottom: inset.bottom }]}
        accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <Animated.View style={[styles.top, chrome]}>
          <Text variant="muted" accessibilityLiveRegion="polite">{index + 1} de {photos.length}{hasMore ? ' carregadas' : ''}</Text>
          <Button variant="quiet" accessibilityLabel="Fechar foto" onPress={onClose} icon={<X size={24} color={theme.colors.ivory} />}>{null}</Button>
        </Animated.View>
        <View style={styles.stage} onLayout={event => setStageHeight(Math.max(1, event.nativeEvent.layout.height))}><ZoomPhoto key={`${current.key}-${width}-${stageHeight}`} photo={current}
          previous={photos[index - 1]} next={photos[index + 1]} width={width} height={stageHeight}
          dismissY={dismissY} onClose={onClose} onNavigate={navigate} /></View>
        <Animated.View style={[styles.details, chrome]}>
          <ScrollView style={styles.captionScroll} contentContainerStyle={styles.caption}>
            <Text style={styles.author}>{current.author_name || (current.source === 'compra' ? 'Compras da ceia' : 'Família')}</Text>
            {dateLabel ? <Text variant="muted">{dateLabel}</Text> : null}
            {current.caption ? <Text>{current.caption}</Text> : null}
            {notice ? <Text accessibilityRole="alert" style={{ color: notice.error ? theme.colors.error : theme.colors.champagne }}>{notice.text}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button variant="ghost" style={styles.flex} loading={busy === 'save'} disabled={busy !== null}
              onPress={() => { void exportPhoto('save'); }} icon={<Download size={18} color={theme.colors.ivory} />}>Salvar na galeria</Button>
            <Button variant="ghost" style={styles.flex} loading={busy === 'share'} disabled={busy !== null}
              onPress={() => { void exportPhoto('share'); }} icon={<Share2 size={18} color={theme.colors.ivory} />}>Compartilhar</Button>
          </View>
          <View style={styles.navigation}>
            <Button variant="quiet" accessibilityLabel="Foto anterior" disabled={index === 0} onPress={() => navigate(-1)}
              icon={<ChevronLeft size={24} color={theme.colors.ivory} />}>{null}</Button>
            {current.source === 'post' && current.post_id ? <Button variant="quiet" onPress={() => {
              onClose(); router.navigate({ pathname: '/(tabs)/mural', params: { post: String(current.post_id) } });
            }} icon={<ArrowUpRight size={16} color={theme.colors.champagne} />}>Ver no mural</Button> : <Text variant="muted">Memórias da ceia</Text>}
            {index === photos.length - 1 && hasMore ? <Button variant="quiet" loading={loadingMore}
              onPress={onLoadMore}>{error ? 'Tentar de novo' : 'Mais fotos'}</Button>
              : <Button variant="quiet" accessibilityLabel="Próxima foto" disabled={index === photos.length - 1}
                onPress={() => navigate(1)} icon={<ChevronRight size={24} color={theme.colors.ivory} />}>{null}</Button>}
          </View>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, backdrop: { backgroundColor: theme.colors.background },
  content: { flex: 1 }, top: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 8 },
  stage: { flex: 1, minHeight: 120, justifyContent: 'center' },
  details: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8, maxHeight: '47%' },
  captionScroll: { maxHeight: 130, flexShrink: 1 }, caption: { gap: 4, paddingHorizontal: 8, paddingBottom: 6 },
  author: { fontFamily: theme.fonts.semibold }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1, minWidth: 140 }, navigation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
});
