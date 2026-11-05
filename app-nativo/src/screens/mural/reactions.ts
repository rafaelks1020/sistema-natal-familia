import Heart from 'lucide-react-native/icons/heart';
import Star from 'lucide-react-native/icons/star';
import FaceGrinning from 'lucide-react-native/icons/face-grinning';
import Wine from 'lucide-react-native/icons/wine';
import type { NotificationItem, ReactionType } from '../../types/mural';

export const REACTIONS: { type: ReactionType; label: string; Icon: typeof Heart }[] = [
  { type: 'coracao', label: 'Coração', Icon: Heart },
  { type: 'estrela', label: 'Estrela', Icon: Star },
  { type: 'risada', label: 'Risada', Icon: FaceGrinning },
  { type: 'brinde', label: 'Brinde', Icon: Wine },
];

export function describeNotification(item: NotificationItem): string {
  if (item.type === 'report') return 'enviou uma denúncia. Analise em Organizar.';
  if (item.type === 'post_comment') return 'comentou na sua publicação.';
  if (item.type === 'comment_reaction') return 'curtiu seu comentário.';
  if (item.type === 'post_reaction') {
    if (item.reaction_type === 'estrela') return 'destacou sua publicação com estrela.';
    if (item.reaction_type === 'risada') return 'riu da sua publicação.';
    if (item.reaction_type === 'brinde') return 'fez um brinde na sua publicação.';
    return 'reagiu com coração na sua publicação.';
  }
  return 'interagiu com você no mural.';
}
