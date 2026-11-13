'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Bell,
  BookOpen,
  Cake,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Camera,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Compass,
  Crown,
  Dices,
  Eye,
  Feather,
  Film,
  Flag,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  HandHeart,
  Heart,
  HelpCircle,
  Home,
  Hourglass,
  Image,
  Images,
  Key,
  Laugh,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  Medal,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  Mic2,
  MicVocal,
  Moon,
  Music,
  Music2,
  Music4,
  Palette,
  PartyPopper,
  Puzzle,
  Radio,
  Receipt,
  Rocket,
  Send,
  Share2,
  Shield,
  ShoppingBag,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  ThumbsUp,
  Ticket,
  Timer,
  TreePine,
  Trophy,
  Tv,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  Video,
  Volume2,
  Vote,
  Wand2,
  Wine,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/app/ui/client';
import type { ConquistaVista, PainelPontos } from '@/app/lib/gamificacao/tipos';
import {
  ESTILO_NIVEL,
  ROTULOS_NIVEL,
  filtrarConquistasNovas,
} from '@/app/(app)/pontos/_logica';

const MAPA_ICONES: Record<string, LucideIcon> = {
  award: Award,
  bell: Bell,
  bookopen: BookOpen,
  cake: Cake,
  calendar: Calendar,
  calendarcheck: CalendarCheck,
  calendardays: CalendarDays,
  camera: Camera,
  car: Car,
  check: Check,
  checkcircle: CheckCircle2,
  checkcircle2: CheckCircle2,
  clock: Clock,
  coffee: Coffee,
  compass: Compass,
  crown: Crown,
  dices: Dices,
  eye: Eye,
  feather: Feather,
  film: Film,
  flag: Flag,
  flame: Flame,
  gamepad: Gamepad2,
  gamepad2: Gamepad2,
  gem: Gem,
  gift: Gift,
  globe: Globe,
  handheart: HandHeart,
  heart: Heart,
  helpcircle: HelpCircle,
  home: Home,
  hourglass: Hourglass,
  image: Image,
  images: Images,
  key: Key,
  laugh: Laugh,
  lightbulb: Lightbulb,
  lock: Lock,
  mail: Mail,
  mappin: MapPin,
  medal: Medal,
  megaphone: Megaphone,
  messagecircle: MessageCircle,
  messagesquare: MessageSquare,
  mic: Mic,
  mic2: Mic2,
  micvocal: MicVocal,
  moon: Moon,
  music: Music,
  music2: Music2,
  music4: Music4,
  palette: Palette,
  partypopper: PartyPopper,
  puzzle: Puzzle,
  radio: Radio,
  receipt: Receipt,
  rocket: Rocket,
  send: Send,
  share2: Share2,
  shield: Shield,
  shoppingbag: ShoppingBag,
  shuffle: Shuffle,
  smile: Smile,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  swords: Swords,
  target: Target,
  thumbsup: ThumbsUp,
  ticket: Ticket,
  timer: Timer,
  treepine: TreePine,
  trophy: Trophy,
  tv: Tv,
  usercheck: UserCheck,
  userplus: UserPlus,
  users: Users,
  utensils: Utensils,
  video: Video,
  volume2: Volume2,
  vote: Vote,
  wand2: Wand2,
  wine: Wine,
  zap: Zap,
};

export function IconeConquista({
  nome,
  size = 22,
  className = '',
  oculta = false,
}: {
  nome: string;
  size?: number;
  className?: string;
  oculta?: boolean;
}) {
  if (oculta) {
    return <HelpCircle size={size} strokeWidth={1.6} className={className} aria-hidden />;
  }
  const chave = (nome || '').replace(/[-_\s]/g, '').toLowerCase();
  const Comp = MAPA_ICONES[chave] ?? Award;
  return <Comp size={size} strokeWidth={1.6} className={className} aria-hidden />;
}

function chaveStorage(ano?: number, userId?: number): string {
  return `natal:conquistas-mostradas:${ano ?? 'atual'}:${userId ?? 'me'}`;
}

/** null = aparelho novo (chave ausente) ou sem acesso ao localStorage. */
function lerMostradas(chave: string): string[] | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;
    const parsed: unknown = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

const FILA_MAXIMA = 3;

function salvarMostradas(chave: string, ids: string[]): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(ids));
  } catch {
    // Sem acesso ao localStorage (modo privado restrito ou quota cheia).
  }
}

interface Props {
  conquistas?: ConquistaVista[];
  ano?: number;
  userId?: number;
}

export default function ToastConquista({ conquistas, ano, userId }: Props) {
  const [remotas, setRemotas] = useState<{
    lista: ConquistaVista[];
    ano: number;
    userId: number;
  } | null>(null);
  const [fila, setFila] = useState<ConquistaVista[]>([]);

  useEffect(() => {
    if (conquistas !== undefined) return;
    let ativo = true;
    api<PainelPontos>('/api/pontos')
      .then((p) => {
        if (ativo) {
          setRemotas({ lista: p.conquistas, ano: p.ano, userId: p.user_id });
        }
      })
      .catch(() => {
        // Silencioso se a rota ainda não responder.
      });
    return () => {
      ativo = false;
    };
  }, [conquistas]);

  const listaEfetiva = conquistas ?? remotas?.lista;
  const anoEfetivo = ano ?? remotas?.ano;
  const userEfetivo = userId ?? remotas?.userId;

  useEffect(() => {
    if (!listaEfetiva || listaEfetiva.length === 0) return;
    const chave = chaveStorage(anoEfetivo, userEfetivo);
    const jaMostradas = lerMostradas(chave);
    if (jaMostradas === null) {
      // Aparelho novo: o que já foi ganho antes não vira aviso em fila.
      salvarMostradas(chave, listaEfetiva.filter((c) => Boolean(c.ganha_em)).map((c) => c.id));
      return;
    }
    const novas = filtrarConquistasNovas(listaEfetiva, jaMostradas);
    if (novas.length === 0) return;

    const timer = window.setTimeout(() => {
      setFila((atual) => {
        const existentes = new Set(atual.map((c) => c.id));
        const adicionar = novas.filter((c) => !existentes.has(c.id));
        if (adicionar.length === 0 || atual.length >= FILA_MAXIMA) return atual;
        return [...atual, ...adicionar].slice(0, FILA_MAXIMA);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [listaEfetiva, anoEfetivo, userEfetivo]);

  const atual = fila[0] ?? null;

  const idAtual = atual?.id;
  useEffect(() => {
    if (!idAtual) return;
    const chave = chaveStorage(anoEfetivo, userEfetivo);
    const vistas = lerMostradas(chave) ?? [];
    if (!vistas.includes(idAtual)) salvarMostradas(chave, [...vistas, idAtual]);
  }, [idAtual, anoEfetivo, userEfetivo]);

  useEffect(() => {
    if (!atual) return;
    const id = window.setTimeout(() => {
      setFila((f) => f.slice(1));
    }, 6500);
    return () => window.clearTimeout(id);
  }, [atual]);

  if (!atual) return null;

  const estilo = ESTILO_NIVEL[atual.nivel] ?? ESTILO_NIVEL.bronze;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-[85] mx-auto max-w-md px-4"
    >
      <div
        className={`pointer-events-auto rise surface relative overflow-hidden border ${estilo.borda} bg-carvao-2 p-4 shadow-2xl`}
      >
        <div className="flex items-start gap-3.5">
          <span
            className={`pop flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${estilo.iconeFundo}`}
          >
            <IconeConquista nome={atual.icone} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker">Conquista nova!</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${estilo.selo}`}
              >
                {ROTULOS_NIVEL[atual.nivel]}
              </span>
              {atual.pontos > 0 && (
                <span className="text-xs font-semibold text-champagne">+{atual.pontos} pts</span>
              )}
            </div>
            <p className="display mt-1 break-words text-xl leading-tight text-marfim">
              {atual.nome}
            </p>
            <p className="mt-1 break-words text-xs leading-relaxed text-marfim-2">
              {atual.descricao}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link
                href="/conquistas"
                onClick={() => setFila([])}
                className="text-xs font-semibold text-champagne underline-offset-4 hover:underline"
              >
                Ver no álbum
              </Link>
              {fila.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFila((f) => f.slice(1))}
                  className="text-xs text-marfim-2 hover:text-marfim"
                >
                  Próxima (+{fila.length - 1})
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar aviso de conquista"
            onClick={() => setFila((f) => f.slice(1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-marfim-3 hover:text-marfim"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
