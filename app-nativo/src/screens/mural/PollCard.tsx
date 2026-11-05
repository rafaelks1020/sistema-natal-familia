import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Check from 'lucide-react-native/icons/check';
import Trash from 'lucide-react-native/icons/trash';
import { timeAgo } from '../../format';
import type { PollItem } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Text } from '../../ui/Text';

function PollCardComponent({ poll, canDelete, onAuthor, onVote, onDelete }: {
  poll: PollItem;
  canDelete: boolean;
  onAuthor: (userId: number) => void;
  onVote: (pollId: number, optionIndex: number) => void;
  onDelete: (pollId: number) => void;
}) {
  const authorKnown = poll.created_by > 0;
  return <View style={styles.card}>
    <View style={styles.authorRow}>
      <Pressable disabled={!authorKnown} accessibilityRole="button" accessibilityLabel={`Perfil de ${poll.created_by_name}`} onPress={() => onAuthor(poll.created_by)} style={styles.author}>
        <Avatar name={poll.created_by_name} src={poll.created_by_avatar} size={42} />
        <View style={styles.authorText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{poll.created_by_name}</Text>
            <Text variant="kicker" style={styles.kicker}>Enquete</Text>
          </View>
          <Text variant="muted" style={styles.time}>{timeAgo(poll.created_at)}</Text>
        </View>
      </Pressable>
      {canDelete ? <Pressable accessibilityRole="button" accessibilityLabel="Apagar enquete" onPress={() => onDelete(poll.id)} style={styles.iconHit}>
        <Trash size={18} color={theme.colors.muted} strokeWidth={1.6} />
      </Pressable> : null}
    </View>
    <Text style={styles.question}>{poll.question}</Text>
    <View style={styles.options}>
      {poll.options.map((option, index) => {
        const count = poll.votes[index] ?? 0;
        const percent = poll.total > 0 ? Math.round((count / poll.total) * 100) : 0;
        const selected = poll.my_vote === index;
        return <Pressable key={`${poll.id}-${index}`} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${option}, ${percent}%`} onPress={() => {
          if (selected) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onVote(poll.id, index);
        }} style={[styles.option, selected && styles.optionOn]}>
          <View pointerEvents="none" style={[styles.fill, { width: `${percent}%` }, selected && styles.fillOn]} />
          <View style={[styles.mark, selected && styles.markOn]}>{selected ? <Check size={12} color={theme.colors.ivory} strokeWidth={2.4} /> : null}</View>
          <Text style={styles.optionLabel}>{option}</Text>
          <Text style={styles.percent}>{percent}%</Text>
        </Pressable>;
      })}
    </View>
    <Text variant="muted" style={styles.total}>{poll.total === 0 ? 'Toque em uma opção para votar' : poll.total === 1 ? '1 voto' : `${poll.total} votos`}</Text>
  </View>;
}

export const PollCard = memo(PollCardComponent);

const styles = StyleSheet.create({
  card: { paddingTop: 18, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  author: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  authorText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: theme.fonts.semibold, fontSize: 15, lineHeight: 20 },
  kicker: { fontSize: 9, letterSpacing: 1.4 },
  time: { fontSize: 12, lineHeight: 16 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  question: { fontFamily: theme.fonts.medium, fontSize: 17, lineHeight: 24, paddingHorizontal: 4 },
  options: { gap: 8 },
  option: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  optionOn: { borderColor: 'rgba(191,165,119,0.7)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(243,235,220,0.08)' },
  fillOn: { backgroundColor: 'rgba(197,41,45,0.28)' },
  mark: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(143,136,124,0.7)', alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: theme.colors.cherry, borderColor: theme.colors.cherry },
  optionLabel: { flex: 1, minWidth: 0, fontFamily: theme.fonts.medium, fontSize: 14, lineHeight: 20 },
  percent: { fontVariant: ['tabular-nums'], color: theme.colors.secondary, fontSize: 13, fontFamily: theme.fonts.medium },
  total: { fontSize: 12, paddingHorizontal: 4 },
});
