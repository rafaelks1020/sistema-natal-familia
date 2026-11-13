import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import FaceGrinning from 'lucide-react-native/icons/face-grinning';
import Heart from 'lucide-react-native/icons/heart';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Star from 'lucide-react-native/icons/star';
import Trophy from 'lucide-react-native/icons/trophy';
import Wine from 'lucide-react-native/icons/wine';
import { timeAgo } from '../../format';
import type { NotificationItem } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { describeNotification } from './reactions';

function Badge({ item }: { item: NotificationItem }) {
  if (item.type === 'conquista') return <Trophy size={12} color={theme.colors.champagne} strokeWidth={1.8} />;
  if (item.type === 'post_comment') return <MessageCircle size={12} color={theme.colors.champagne} strokeWidth={1.8} />;
  if (item.reaction_type === 'estrela') return <Star size={12} color={theme.colors.champagne} strokeWidth={1.8} />;
  if (item.reaction_type === 'risada') return <FaceGrinning size={12} color={theme.colors.champagne} strokeWidth={1.8} />;
  if (item.reaction_type === 'brinde') return <Wine size={12} color={theme.colors.champagne} strokeWidth={1.8} />;
  return <Heart size={12} color={theme.colors.cherry} fill={theme.colors.cherry} strokeWidth={1.8} />;
}

export function NotificationsSheet({ visible, items, freshIds, loading, error, onClose, onRetry, onSelect }: {
  visible: boolean;
  items: NotificationItem[];
  freshIds: number[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (postId: number) => void;
}) {
  const { height } = useWindowDimensions();
  return <Sheet visible={visible} onClose={onClose} title="Notificações">
    <ScrollView style={{ maxHeight: height * 0.56 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
      {loading ? <View accessibilityLabel="Carregando notificações" style={styles.gap}><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /></View>
        : error ? <View style={styles.gap}>
          <Text variant="muted" style={styles.center}>{error}</Text>
          <Button variant="ghost" onPress={onRetry}>Tentar de novo</Button>
        </View>
        : items.length === 0 ? <View style={styles.empty}>
          <Text style={styles.quiet}>Tudo tranquilo por aqui.</Text>
          <Text variant="muted" style={styles.center}>Quando alguém comentar ou reagir, aparece aqui.</Text>
        </View>
        : items.map(item => {
          const fresh = !item.read || freshIds.includes(item.id);
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.type === 'conquista' ? describeNotification(item) : `${item.actor_name} ${describeNotification(item)}`} onPress={() => { onClose(); if (item.type === 'conquista') router.push('/conquistas'); else if (item.type === 'report') router.push('/organizar'); else if (item.post_id) onSelect(item.post_id); }} style={styles.row}>
            <View>
              <Avatar name={item.actor_name} src={item.actor_avatar} size={40} />
              <View style={styles.badge}><Badge item={item} /></View>
            </View>
            <View style={styles.body}>
              <Text style={styles.copy}>{item.type === 'conquista' ? <Text style={styles.name}>{describeNotification(item)}</Text> : <><Text style={styles.name}>{item.actor_name}</Text> <Text style={styles.action}>{describeNotification(item)}</Text></>}</Text>
              <Text variant="muted" style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            {fresh ? <View style={styles.dot} accessibilityLabel="Não lida" /> : null}
          </Pressable>;
        })}
    </ScrollView>
  </Sheet>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 8 },
  gap: { gap: 12 },
  center: { textAlign: 'center' },
  empty: { paddingVertical: 28, gap: 8 },
  quiet: { textAlign: 'center', fontFamily: theme.fonts.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderTopWidth: 1, borderTopColor: theme.colors.line },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  copy: { fontSize: 14, lineHeight: 20 },
  name: { fontFamily: theme.fonts.semibold, fontSize: 14, lineHeight: 20 },
  action: { color: theme.colors.secondary, fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.cherry },
});
