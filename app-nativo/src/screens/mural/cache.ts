import type { InfiniteData } from '@tanstack/react-query';
import type { CommentItem, NotificationItem, NotificationsResponse, PollItem, PostItem, PostWrite, ReactionType, VoteResult } from '../../types/mural';

export const MURAL_PAGE_SIZE = 20;
export const MURAL_MAX_PHOTOS = 6;
export const MURAL_PREVIEW_COMMENTS = 2;
export const MURAL_POST_LIMIT = 2000;
export const MURAL_COMMENT_LIMIT = 600;
export const MURAL_QUESTION_LIMIT = 240;
export const MURAL_OPTION_LIMIT = 120;

export const muralKeys = {
  posts: ['mural', 'posts'] as const,
  polls: ['mural', 'polls'] as const,
  notifications: ['mural', 'notifications'] as const,
  comments: (postId: number) => ['mural', 'comments', postId] as const,
};

export type PostsData = InfiniteData<PostItem[], number | null>;

export type FeedEntry =
  | { kind: 'post'; id: string; post: PostItem }
  | { kind: 'poll'; id: string; poll: PollItem };

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asIso(value: unknown): string {
  if (typeof value === 'string' && value) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export function normalizeComment(raw: Partial<CommentItem> | null | undefined): CommentItem {
  return {
    id: Number(raw?.id) || 0,
    user_id: Number(raw?.user_id) || 0,
    user_name: asText(raw?.user_name),
    avatar_url: raw?.avatar_url ?? null,
    content: asText(raw?.content),
    created_at: asIso(raw?.created_at),
    likes: Number(raw?.likes) || 0,
    liked_by_me: Boolean(raw?.liked_by_me),
  };
}

export function normalizePost(raw: Partial<PostItem> | null | undefined): PostItem {
  const reactions = raw?.reactions && typeof raw.reactions === 'object' ? raw.reactions : {};
  return {
    id: Number(raw?.id) || 0,
    user_id: Number(raw?.user_id) || 0,
    user_name: asText(raw?.user_name),
    avatar_url: raw?.avatar_url ?? null,
    content: asText(raw?.content),
    images: Array.isArray(raw?.images) ? raw.images.filter((item): item is string => typeof item === 'string') : [],
    pinned: Boolean(raw?.pinned),
    created_at: asIso(raw?.created_at),
    updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : null,
    reactions: { ...reactions },
    my_reactions: Array.isArray(raw?.my_reactions) ? raw.my_reactions.map(item => String(item)) : [],
    comments: Array.isArray(raw?.comments) ? raw.comments.map(item => normalizeComment(item)) : [],
    comments_count: Number(raw?.comments_count) || 0,
  };
}

export function normalizePostWrite(raw: Partial<PostWrite> | null | undefined): PostWrite {
  return {
    id: Number(raw?.id) || 0,
    user_id: Number(raw?.user_id) || 0,
    user_name: asText(raw?.user_name),
    avatar_url: raw?.avatar_url ?? null,
    content: asText(raw?.content),
    images: Array.isArray(raw?.images) ? raw.images.filter((item): item is string => typeof item === 'string') : [],
    pinned: Boolean(raw?.pinned),
    created_at: asIso(raw?.created_at),
    updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : null,
  };
}

export function normalizePoll(raw: Partial<PollItem> | null | undefined): PollItem {
  const options = Array.isArray(raw?.options) ? raw.options.map(item => String(item)) : [];
  const votes = options.map((_, index) => Number(raw?.votes?.[index] ?? 0) || 0);
  const myVote = raw?.my_vote;
  return {
    id: Number(raw?.id) || 0,
    question: asText(raw?.question),
    options,
    votes,
    my_vote: myVote === null || myVote === undefined || Number.isNaN(Number(myVote)) ? null : Number(myVote),
    total: Number(raw?.total) || votes.reduce((sum, count) => sum + count, 0),
    created_by: Number(raw?.created_by) || 0,
    created_by_name: asText(raw?.created_by_name),
    created_by_avatar: raw?.created_by_avatar ?? null,
    created_at: asIso(raw?.created_at),
  };
}

export function normalizeNotification(raw: Partial<NotificationItem> | null | undefined): NotificationItem {
  const postId = raw?.post_id;
  return {
    id: Number(raw?.id) || 0,
    type: asText(raw?.type),
    actor_name: asText(raw?.actor_name),
    actor_avatar: raw?.actor_avatar ?? null,
    post_id: postId === null || postId === undefined ? null : Number(postId) || null,
    reaction_type: raw?.reaction_type ?? null,
    created_at: asIso(raw?.created_at),
    read: Boolean(raw?.read),
  };
}

export function normalizeNotifications(raw: Partial<NotificationsResponse> | null | undefined): NotificationsResponse {
  return {
    unread: Number(raw?.unread) || 0,
    items: Array.isArray(raw?.items) ? raw.items.map(item => normalizeNotification(item)) : [],
  };
}

function stamp(value: string): number {
  const time = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function buildFeed(posts: PostItem[], polls: PollItem[]): FeedEntry[] {
  const seen = new Set<number>();
  const pinned: PostItem[] = [];
  const regular: { entry: FeedEntry; time: number; rank: number }[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    if (post.pinned) pinned.push(post);
    else regular.push({ entry: { kind: 'post', id: `post-${post.id}`, post }, time: stamp(post.created_at), rank: post.id });
  }
  pinned.sort((a, b) => b.id - a.id);
  for (const poll of polls) {
    regular.push({ entry: { kind: 'poll', id: `poll-${poll.id}`, poll }, time: stamp(poll.created_at), rank: poll.id });
  }
  regular.sort((a, b) => b.time - a.time || b.rank - a.rank);
  return [
    ...pinned.map(post => ({ kind: 'post' as const, id: `post-${post.id}`, post })),
    ...regular.map(item => item.entry),
  ];
}

export function flattenPosts(data: PostsData | undefined): PostItem[] {
  if (!data) return [];
  return data.pages.flat();
}

export function mapPosts(data: PostsData | undefined, postId: number, update: (post: PostItem) => PostItem): PostsData | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map(page => page.map(post => post.id === postId ? update(post) : post)) };
}

export function insertPost(data: PostsData | undefined, post: PostItem): PostsData {
  if (!data || data.pages.length === 0) return { pages: [[post]], pageParams: [null] };
  const pages = data.pages.map(page => page.filter(item => item.id !== post.id));
  const first = [...(pages[0] ?? [])];
  let cursor = 0;
  while (first[cursor]?.pinned) cursor += 1;
  first.splice(cursor, 0, post);
  pages[0] = first;
  return { ...data, pages };
}

export function removePost(data: PostsData | undefined, postId: number): PostsData | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map(page => page.filter(post => post.id !== postId)) };
}

export function mergePost(post: PostItem, saved: PostWrite): PostItem {
  return {
    ...post,
    content: saved.content,
    images: saved.images,
    pinned: saved.pinned,
    updated_at: saved.updated_at,
    created_at: saved.created_at || post.created_at,
    user_name: saved.user_name || post.user_name,
    avatar_url: saved.avatar_url,
  };
}

export function applyReaction(post: PostItem, type: ReactionType): PostItem {
  const mine = post.my_reactions.includes(type);
  const count = Number(post.reactions[type] ?? 0);
  const next = mine ? Math.max(0, count - 1) : count + 1;
  const reactions = { ...post.reactions };
  if (next === 0) delete reactions[type];
  else reactions[type] = next;
  return {
    ...post,
    reactions,
    my_reactions: mine ? post.my_reactions.filter(item => item !== type) : [...post.my_reactions, type],
  };
}

export function setReactionActive(post: PostItem, type: ReactionType, active: boolean): PostItem {
  if (post.my_reactions.includes(type) === active) return post;
  return applyReaction(post, type);
}

export function applyCommentLike(comment: CommentItem): CommentItem {
  const liked = !comment.liked_by_me;
  return { ...comment, liked_by_me: liked, likes: liked ? comment.likes + 1 : Math.max(0, comment.likes - 1) };
}

export function setCommentLiked(comment: CommentItem, liked: boolean): CommentItem {
  if (comment.liked_by_me === liked) return comment;
  return applyCommentLike(comment);
}

export function appendComment(post: PostItem, comment: CommentItem): PostItem {
  if (post.comments.some(item => item.id === comment.id)) return post;
  return { ...post, comments: [...post.comments, comment], comments_count: post.comments_count + 1 };
}

export function replaceComment(post: PostItem, previousId: number, comment: CommentItem): PostItem {
  return { ...post, comments: post.comments.map(item => item.id === previousId ? comment : item) };
}

export function withoutComment(post: PostItem, commentId: number): PostItem {
  return {
    ...post,
    comments: post.comments.filter(item => item.id !== commentId),
    comments_count: Math.max(0, post.comments_count - 1),
  };
}

export function mapCommentList(comments: CommentItem[] | undefined, commentId: number, update: (comment: CommentItem) => CommentItem): CommentItem[] | undefined {
  if (!comments) return comments;
  return comments.map(comment => comment.id === commentId ? update(comment) : comment);
}

export function mapPolls(polls: PollItem[] | undefined, pollId: number, update: (poll: PollItem) => PollItem): PollItem[] | undefined {
  if (!polls) return polls;
  return polls.map(poll => poll.id === pollId ? update(poll) : poll);
}

export function withPoll(polls: PollItem[] | undefined, poll: PollItem): PollItem[] {
  return [poll, ...(polls ?? []).filter(item => item.id !== poll.id)];
}

export function withoutPoll(polls: PollItem[] | undefined, pollId: number): PollItem[] | undefined {
  return polls?.filter(poll => poll.id !== pollId);
}

export function applyVote(poll: PollItem, optionIndex: number): PollItem {
  if (poll.my_vote === optionIndex) return poll;
  if (optionIndex < 0 || optionIndex >= poll.options.length) return poll;
  const votes = poll.options.map((_, index) => poll.votes[index] ?? 0);
  if (poll.my_vote !== null) {
    const previous = votes[poll.my_vote] ?? 0;
    votes[poll.my_vote] = Math.max(0, previous - 1);
  }
  votes[optionIndex] = (votes[optionIndex] ?? 0) + 1;
  return { ...poll, votes, my_vote: optionIndex, total: votes.reduce((sum, count) => sum + count, 0) };
}

export function applyVoteResult(poll: PollItem, result: VoteResult): PollItem {
  const votes = poll.options.map((_, index) => Number(result.votes[index] ?? 0) || 0);
  return {
    ...poll,
    votes,
    my_vote: result.my_vote,
    total: Number(result.total) || votes.reduce((sum, count) => sum + count, 0),
  };
}
