import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';

interface TimelineItem {
  type: 'payment' | 'purchase';
  date: string;
  value: number;
  description: string;
  image_url?: string;
  image_urls?: string[] | string;
  category?: string;
  brand?: string;
  notes?: string;
}

interface FamilyUser {
  id: number;
  name: string;
  username: string;
}

interface FamilyComment {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

interface FamilyPost {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  image_url?: string;
  created_at: string;
  reactions?: Record<string, number>;
  comments?: FamilyComment[];
}

interface FamilyPoll {
  id: number;
  question: string;
  options: string[];
  created_at: string;
  created_by_name: string;
  votes?: Record<string, number>;
}

interface FamilyAttendance {
  participant_id: number;
  name: string;
  status: 'yes' | 'maybe' | 'no' | null;
}

interface TourStep {
  id: number;
  title: string;
  body: string;
}

interface TimelineSectionProps {
  stars: Array<{ left: string; top: string; size: string }>;
  showTour: boolean;
  setShowTour: (value: boolean) => void;
  tourStep: number;
  setTourStep: (value: number) => void;
  tourSteps: TourStep[];
  totalReceived: number;
  totalSpent: number;
  balance: number;
  formatCurrency: (value: any) => string;
  familyPosts: FamilyPost[];
  familyAttendance: FamilyAttendance[];
  familyUser: FamilyUser | null;
  handleSetAttendance: (status: 'yes' | 'maybe' | 'no') => void | Promise<void>;
  newPollQuestion: string;
  setNewPollQuestion: (value: string) => void;
  newPollOptionsText: string;
  setNewPollOptionsText: (value: string) => void;
  familyPolls: FamilyPoll[];
  handleCreatePoll: () => void | Promise<void>;
  handleVotePoll: (pollId: number, optionIndex: number) => void | Promise<void>;
  handleFamilyLogout: () => void | Promise<void>;
  familyAuthMode: 'login' | 'register';
  setFamilyAuthMode: (mode: 'login' | 'register') => void;
  setFamilyAuthError: Dispatch<SetStateAction<string>>;
  familyAuthError: string;
  familyName: string;
  setFamilyName: (value: string) => void;
  familyUsername: string;
  setFamilyUsername: (value: string) => void;
  familyPassword: string;
  setFamilyPassword: (value: string) => void;
  handleFamilyAuth: () => void | Promise<void>;
  familyLoading: boolean;
  familyPostContent: string;
  setFamilyPostContent: (value: string) => void;
  handleFamilyImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  familyImageFile: File | null;
  handleCreateFamilyPost: () => void | Promise<void>;
  familyPosting: boolean;
  familyUploadingImage: boolean;
  familyImagePreview: string | null;
  pinnedPostId: number | null;
  isAdmin: boolean;
  handleTogglePinPost: (postId: number) => void;
  reactionOptions: string[];
  handleToggleReaction: (postId: number, reaction: string) => void | Promise<void>;
  handleToggleCommentLike: (commentId: number) => void;
  likedComments: Record<number, boolean>;
  familyCommentDrafts: Record<number, string>;
  setFamilyCommentDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  handleCreateComment: (postId: number) => void | Promise<void>;
  timeline: TimelineItem[];
}

// Carousel de imagens usado na timeline
function ImageCarousel({ images, description }: { images: string[]; description: string }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const hasMultipleImages = images.length > 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!hasMultipleImages) return;
    const distance = touchStart - touchEnd;
    const swipeThreshold = 50;

    if (distance > swipeThreshold) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    } else if (distance < -swipeThreshold) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  return (
    <div className="relative w-full h-56 md:h-64 bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-200">
      <img
        src={images[currentImageIndex]}
        alt={description}
        className="w-full h-full object-cover"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {hasMultipleImages && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full border border-white transition-all ${
                index === currentImageIndex ? 'bg-white' : 'bg-black/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineSection(props: TimelineSectionProps) {
  const {
    stars,
    showTour,
    setShowTour,
    tourStep,
    setTourStep,
    tourSteps,
    totalReceived,
    totalSpent,
    balance,
    formatCurrency,
    familyPosts,
    familyAttendance,
    familyUser,
    handleSetAttendance,
    newPollQuestion,
    setNewPollQuestion,
    newPollOptionsText,
    setNewPollOptionsText,
    familyPolls,
    handleCreatePoll,
    handleVotePoll,
    handleFamilyLogout,
    familyAuthMode,
    setFamilyAuthMode,
    setFamilyAuthError,
    familyAuthError,
    familyName,
    setFamilyName,
    familyUsername,
    setFamilyUsername,
    familyPassword,
    setFamilyPassword,
    handleFamilyAuth,
    familyLoading,
    familyPostContent,
    setFamilyPostContent,
    handleFamilyImageSelect,
    familyImageFile,
    handleCreateFamilyPost,
    familyPosting,
    familyUploadingImage,
    familyImagePreview,
    pinnedPostId,
    isAdmin,
    handleTogglePinPost,
    reactionOptions,
    handleToggleReaction,
    handleToggleCommentLike,
    likedComments,
    familyCommentDrafts,
    setFamilyCommentDrafts,
    handleCreateComment,
    timeline,
  } = props;

  const natalDate = new Date('2025-12-25');
  const [selectedAlbumPost, setSelectedAlbumPost] = useState<FamilyPost | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedAlbumPost(null);
      }
    };

    if (selectedAlbumPost) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAlbumPost]);

  return (
    <div className="relative py-12 overflow-hidden">
      {/* Fundo da timeline: elementos decorativos */}
      <div className="absolute bottom-0 left-0 right-0 h-64 opacity-20">
        <svg viewBox="0 0 1200 300" className="w-full h-full">
          <path
            d="M0,300 L0,200 L200,100 L400,180 L600,80 L800,160 L1000,100 L1200,180 L1200,300 Z"
            fill="white"
            opacity="0.3"
          />
          <path
            d="M0,300 L0,240 L150,180 L350,220 L550,150 L750,200 L950,160 L1200,220 L1200,300 Z"
            fill="white"
            opacity="0.2"
          />
        </svg>
      </div>

      <div className="absolute top-20 left-0 w-full pointer-events-none z-0">
        <div className="relative" style={{ animation: 'sleighFly 30s linear infinite' }}>
          <div className="text-8xl">🛷</div>
          <div className="absolute -left-20 top-2 text-6xl">🦌</div>
          <div className="absolute -left-32 top-4 text-5xl">🦌</div>
        </div>
      </div>

      <div className="absolute inset-0 opacity-30 z-0">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute text-yellow-200"
            style={{
              left: star.left,
              top: star.top,
              fontSize: star.size,
              animation: `sparkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          >
            ✨
          </div>
        ))}
      </div>

      <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-100 rounded-full opacity-40 shadow-2xl z-0">
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-200 to-transparent" />
      </div>

      <div className="absolute bottom-0 left-10 z-0 opacity-20">
        <div className="text-6xl">🏠</div>
        <div className="absolute -top-2 left-0 text-4xl">❄️</div>
      </div>
      <div className="absolute bottom-0 right-20 z-0 opacity-20">
        <div className="text-7xl">🏘️</div>
      </div>

      <div className="absolute bottom-20 left-1/4 z-0 opacity-25 text-8xl animate-pulse" style={{ animationDuration: '3s' }}>
        🎄
      </div>
      <div className="absolute bottom-32 right-1/3 z-0 opacity-25 text-7xl animate-pulse" style={{ animationDuration: '4s' }}>
        🎄
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {selectedAlbumPost && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
            onClick={() => setSelectedAlbumPost(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 md:top-8 md:right-8 text-white text-2xl md:text-3xl font-bold"
              onClick={() => setSelectedAlbumPost(null)}
            >
              ×
            </button>
            <div
              className="bg-black/80 rounded-3xl shadow-2xl overflow-hidden max-w-3xl w-full border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedAlbumPost.image_url && (
                <img
                  src={selectedAlbumPost.image_url}
                  alt={selectedAlbumPost.content || `Foto de ${selectedAlbumPost.user_name}`}
                  className="w-full max-h-[75vh] object-contain bg-black"
                />
              )}
              <div className="px-4 py-3 flex items-center justify-between text-xs md:text-sm text-white/90 bg-gradient-to-r from-black/80 via-black/60 to-black/80">
                <span className="font-semibold truncate max-w-[70%]">
                  {selectedAlbumPost.user_name}
                </span>
                <span className="opacity-80">
                  {new Date(selectedAlbumPost.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {showTour && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6 border border-yellow-200">
              {(() => {
                const step = tourSteps.find((s) => s.id === tourStep) || tourSteps[0];
                const isFirst = tourStep === 1;
                const isLast = tourStep === tourSteps.length;
                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👀</span>
                        <h2 className="text-sm md:text-base font-black text-gray-900">
                          Passo {tourStep} de {tourSteps.length}: {step.title}
                        </h2>
                      </div>
                      <button
                        onClick={() => setShowTour(false)}
                        className="text-gray-400 hover:text-gray-700 text-lg font-bold"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-xs md:text-sm text-gray-700 mb-4">{step.body}</p>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => (isFirst ? setShowTour(false) : setTourStep(tourStep - 1))}
                        className="px-3 py-1.5 rounded-full border text-[11px] md:text-xs font-semibold text-gray-700 border-gray-300 hover:bg-gray-100"
                      >
                        {isFirst ? 'Fechar' : 'Voltar'}
                      </button>
                      <button
                        onClick={() => (isLast ? setShowTour(false) : setTourStep(tourStep + 1))}
                        className="px-4 py-1.5 rounded-full bg-yellow-400 text-yellow-900 text-[11px] md:text-xs font-bold shadow-md hover:bg-yellow-300 border border-yellow-500"
                      >
                        {isLast ? 'Entendi tudo' : 'Próximo'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Header Natal 2025 */}
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-block bg-black/40 backdrop-blur-xl rounded-3xl px-6 md:px-10 py-5 md:py-7 border border-yellow-300/70 shadow-xl">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 md:mb-3 drop-shadow">
              🎄 Natal em Família 2025
            </h1>
            <div className="text-base md:text-lg font-semibold text-yellow-200 mb-1">25 de dezembro de 2025</div>
            <div className="text-sm md:text-base text-white/85">
              {(() => {
                const hoje = new Date();
                const diff = Math.ceil((natalDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                return diff > 0 ? `🎅 Faltam ${diff} dias para o Natal!` : '🎉 Feliz Natal!';
              })()}
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => {
              setShowTour(true);
              setTourStep(1);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-yellow-900 text-xs md:text-sm font-bold shadow-md hover:bg-yellow-300 transition-all border border-yellow-500"
          >
            <span>👀</span>
            <span>Me explicar a página</span>
          </button>
        </div>

        {/* Resumo Financeiro */}
        <div className="mb-12">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border-4 border-white/50">
            <h2 className="text-2xl font-black text-gray-900 mb-6 text-center flex items-center justify-center gap-3">
              <span className="text-3xl">💰</span>
              Resumo Financeiro
              <span className="text-3xl">💰</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border-2 border-green-300 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-2xl">💵</div>
                  <div>
                    <p className="text-sm font-bold text-green-700 uppercase">Em Caixa</p>
                    <p className="text-xs text-green-600">Arrecadado</p>
                  </div>
                </div>
                <div className="text-4xl font-black text-green-700">R$ {formatCurrency(totalReceived)}</div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border-2 border-red-300 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-2xl">🛒</div>
                  <div>
                    <p className="text-sm font-bold text-red-700 uppercase">Já Gasto</p>
                    <p className="text-xs text-red-600">Em compras</p>
                  </div>
                </div>
                <div className="text-4xl font-black text-red-700">R$ {formatCurrency(totalSpent)}</div>
              </div>

              <div
                className={`bg-gradient-to-br rounded-2xl p-6 border-2 shadow-lg ${
                  balance >= 0 ? 'from-blue-50 to-blue-100 border-blue-300' : 'from-orange-50 to-orange-100 border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                      balance >= 0 ? 'bg-blue-500' : 'bg-orange-500'
                    }`}
                  >
                    {balance >= 0 ? '✨' : '⚠️'}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold uppercase ${
                        balance >= 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}
                    >
                      {balance >= 0 ? 'Disponível' : 'Faltando'}
                    </p>
                    <p className={`text-xs ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {balance >= 0 ? 'Para gastar' : 'No orçamento'}
                    </p>
                  </div>
                </div>
                <div className={`text-4xl font-black ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  R$ {formatCurrency(Math.abs(balance))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">Progresso do Orçamento</span>
                <span className="text-sm font-bold text-gray-900">
                  {totalReceived > 0 ? Math.round((totalSpent / totalReceived) * 100) : 0}% utilizado
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (totalSpent / totalReceived) * 100 > 90
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : (totalSpent / totalReceived) * 100 > 70
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                      : 'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                  style={{ width: `${Math.min((totalSpent / totalReceived) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Álbum da família */}
        <div className="mb-12 -mx-4 md:-mx-8">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                  <span className="text-sm">📸</span>
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Álbum da família
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Fotos do Natal em Família</h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Todas as fotos postadas no mural aparecem aqui, em uma grade especial do Natal.
                </p>
              </div>
            </div>

            {familyPosts.some((p) => p.image_url) ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {familyPosts
                  .filter((p) => p.image_url)
                  .map((post) => (
                    <div
                      key={post.id}
                      className="relative group rounded-xl overflow-hidden border border-white shadow-sm bg-gray-900/5 cursor-pointer"
                      onClick={() => setSelectedAlbumPost(post)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAlbumPost(post);
                        }
                      }}
                    >
                      <img
                        src={post.image_url as string}
                        alt={post.content || `Foto de ${post.user_name}`}
                        className="w-full h-28 md:h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-1 left-1 right-1 px-2 py-1 flex justify-between items-end text-[10px] text-white">
                        <span className="font-semibold truncate max-w-[70%]">{post.user_name}</span>
                        <span className="opacity-80">
                          {new Date(post.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Ainda não há fotos no álbum. Poste uma mensagem com foto no mural para começar! 🎄
              </p>
            )}
          </div>
        </div>

        {/* Presença */}
        <div className="mb-12 -mx-4 md:-mx-8">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100/70">
            {(() => {
              const yesCount = familyAttendance.filter((a) => a.status === 'yes').length;
              const maybeCount = familyAttendance.filter((a) => a.status === 'maybe').length;
              const noCount = familyAttendance.filter((a) => a.status === 'no').length;
              const totalResponded = yesCount + maybeCount + noCount;
              const myStatus = familyUser
                ? familyAttendance.find((a) => a.name === familyUser.name)?.status || null
                : null;

              return (
                <>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                        <span className="text-sm">✅</span>
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Presença no Natal
                        </span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-gray-900">Quem vai estar na ceia?</h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        Marque se você vai, talvez vá ou não vai. Isso ajuda a organizar comida, bebida e presentes.
                      </p>
                    </div>
                    {totalResponded > 0 && (
                      <div className="hidden md:flex flex-col items-end text-xs text-gray-600">
                        <span className="font-semibold text-emerald-700">
                          {yesCount} confirmad{yesCount === 1 ? 'o' : 'os'}
                        </span>
                        {maybeCount > 0 && <span className="text-amber-600">{maybeCount} talvez</span>}
                        {noCount > 0 && <span className="text-gray-500">{noCount} não vão</span>}
                      </div>
                    )}
                  </div>

                  <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSetAttendance('yes')}
                        className={`px-3 py-2 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 border transition-all ${
                          myStatus === 'yes'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        <span>✅</span>
                        <span>Vou</span>
                      </button>
                      <button
                        onClick={() => handleSetAttendance('maybe')}
                        className={`px-3 py-2 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 border transition-all ${
                          myStatus === 'maybe'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                            : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        <span>🤔</span>
                        <span>Talvez</span>
                      </button>
                      <button
                        onClick={() => handleSetAttendance('no')}
                        className={`px-3 py-2 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 border transition-all ${
                          myStatus === 'no'
                            ? 'bg-gray-600 text-white border-gray-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span>❌</span>
                        <span>Não vou</span>
                      </button>
                    </div>
                    {!familyUser && (
                      <p className="text-[11px] md:text-xs text-gray-500">
                        Faça login no mural para marcar sua presença.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs md:text-sm">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] font-semibold text-emerald-700 uppercase mb-1">
                        Confirmados ✅
                      </span>
                      {yesCount === 0 ? (
                        <span className="text-gray-500">Ninguém confirmou ainda.</span>
                      ) : (
                        <span className="text-gray-800">
                          {familyAttendance
                            .filter((a) => a.status === 'yes')
                            .map((a) => a.name)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] font-semibold text-amber-700 uppercase mb-1">Talvez 🤔</span>
                      {maybeCount === 0 ? (
                        <span className="text-gray-500">Ninguém marcou talvez.</span>
                      ) : (
                        <span className="text-gray-800">
                          {familyAttendance
                            .filter((a) => a.status === 'maybe')
                            .map((a) => a.name)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] font-semibold text-gray-700 uppercase mb-1">Não vão ❌</span>
                      {noCount === 0 ? (
                        <span className="text-gray-500">Ninguém marcou que não vai.</span>
                      ) : (
                        <span className="text-gray-800">
                          {familyAttendance
                            .filter((a) => a.status === 'no')
                            .map((a) => a.name)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Enquetes */}
        <div className="mb-12 -mx-4 md:-mx-8">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-blue-100">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-2">
                  <span className="text-sm">📊</span>
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    Enquetes da família
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Combinações rápidas pro Natal</h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Decidam juntos horário da ceia, sobremesas, brincadeiras e outros detalhes.
                </p>
              </div>
            </div>

            {familyUser ? (
              <div className="mb-5 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Pergunta da enquete</label>
                    <input
                      type="text"
                      value={newPollQuestion}
                      onChange={(e) => setNewPollQuestion(e.target.value)}
                      placeholder="Ex: Que horas começamos a ceia?"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Opções (uma por linha)</label>
                    <textarea
                      value={newPollOptionsText}
                      onChange={(e) => setNewPollOptionsText(e.target.value)}
                      rows={3}
                      placeholder={"Ex:\n20h\n20h30\n21h"}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none bg-gray-50"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCreatePoll}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-xs md:text-sm font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                  >
                    <span>✨</span>
                    <span>Criar enquete</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-xs md:text-sm text-gray-500">
                Faça login no mural para criar enquetes.
              </p>
            )}

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {familyPolls.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Ainda não há enquetes. Crie a primeira para combinar os detalhes do Natal! ✨
                </p>
              ) : (
                familyPolls.map((poll) => {
                  const totalVotes = Object.values(poll.votes || {}).reduce(
                    (sum, v) => sum + Number(v || 0),
                    0,
                  );
                  return (
                    <div key={poll.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900 mb-0.5">{poll.question}</p>
                          <p className="text-[11px] text-gray-500">
                            Criada por {poll.created_by_name} em{' '}
                            {new Date(poll.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </p>
                        </div>
                        {totalVotes > 0 && (
                          <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-full font-semibold">
                            {totalVotes} voto{totalVotes === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {poll.options.map((opt, idx) => {
                          const count = poll.votes?.[String(idx)] || 0;
                          const percent = totalVotes > 0 ? Math.round((Number(count) / totalVotes) * 100) : 0;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleVotePoll(poll.id, idx)}
                              className="flex flex-col items-start text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-xs"
                            >
                              <div className="flex justify-between w-full items-center mb-1">
                                <span className="font-semibold text-gray-800">{opt}</span>
                                <span className="text-[11px] text-gray-500">
                                  {count} voto{Number(count) === 1 ? '' : 's'}
                                  {totalVotes > 0 ? ` • ${percent}%` : ''}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Mural da família */}
        <div className="mb-12">
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-green-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-green-800 flex items-center gap-2">
                  <span>👨‍👩‍👧‍👦</span>
                  <span>Mural da Família</span>
                </h2>
                <p className="text-sm md:text-base text-gray-600 mt-1">
                  Um espaço só de vocês para trocar mensagens e recados do Natal.
                </p>
              </div>
              {familyUser && (
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Conectado como</span>{' '}
                    <span className="font-bold text-green-700">{familyUser.name}</span>
                  </div>
                  <button
                    onClick={handleFamilyLogout}
                    className="px-3 py-2 text-xs md:text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold transition-all"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>

            {!familyUser && (
              <div className="mb-6">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      setFamilyAuthMode('login');
                      setFamilyAuthError('');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      familyAuthMode === 'login'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Já tenho conta
                  </button>
                  <button
                    onClick={() => {
                      setFamilyAuthMode('register');
                      setFamilyAuthError('');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      familyAuthMode === 'register'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Criar conta
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-end">
                  {familyAuthMode === 'register' && (
                    <input
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none text-sm md:text-base"
                    />
                  )}
                  <input
                    type="text"
                    value={familyUsername}
                    onChange={(e) => setFamilyUsername(e.target.value)}
                    placeholder="Usuário (login)"
                    className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none text-sm md:text-base"
                  />
                  <input
                    type="password"
                    value={familyPassword}
                    onChange={(e) => setFamilyPassword(e.target.value)}
                    placeholder="Senha"
                    className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none text-sm md:text-base"
                  />
                  <button
                    onClick={handleFamilyAuth}
                    disabled={familyLoading}
                    className="px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm md:text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {familyLoading ? 'Entrando...' : familyAuthMode === 'login' ? 'Entrar' : 'Cadastrar'}
                  </button>
                </div>

                {familyAuthError && (
                  <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {familyAuthError}
                  </div>
                )}
              </div>
            )}

            {familyUser && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Escreva uma mensagem para a família 🎄
                </label>
                <textarea
                  value={familyPostContent}
                  onChange={(e) => setFamilyPostContent(e.target.value)}
                  rows={3}
                  placeholder="Ex: Feliz Natal, pessoal! Obrigado por mais um ano juntos..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none text-sm md:text-base resize-none"
                />

                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-300 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100">
                      <span>📸</span>
                      <span>Adicionar foto (opcional)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFamilyImageSelect}
                      />
                    </label>
                    {familyImageFile && (
                      <span className="text-[11px] text-gray-500 max-w-[180px] truncate">
                        {familyImageFile.name}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleCreateFamilyPost}
                      disabled={familyPosting || familyUploadingImage}
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-sm md:text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {familyPosting || familyUploadingImage ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {familyUploadingImage ? 'Enviando foto...' : 'Enviando...'}
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          <span>Postar no mural</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {familyImagePreview && (
                  <div className="mt-3">
                    <p className="text-[11px] text-gray-500 mb-1">Pré-visualização da foto:</p>
                    <img
                      src={familyImagePreview}
                      alt="Pré-visualização"
                      className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              {familyPosts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Ainda não há mensagens no mural. Seja o primeiro a escrever! 🎅
                </p>
              ) : (
                (() => {
                  const orderedPosts = pinnedPostId
                    ? [...familyPosts].sort((a, b) => {
                        if (a.id === pinnedPostId) return -1;
                        if (b.id === pinnedPostId) return 1;
                        return 0;
                      })
                    : familyPosts;

                  return orderedPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {post.user_name?.charAt(0)?.toUpperCase() || 'F'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{post.user_name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(post.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pinnedPostId === post.id && (
                              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                                Post fixado
                              </span>
                            )}
                            <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full">
                              Mural de Natal
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleTogglePinPost(post.id)}
                                className="ml-1 text-[11px] text-gray-500 hover:text-amber-700 border border-gray-200 hover:border-amber-300 rounded-full px-2 py-0.5 flex items-center gap-1"
                              >
                                <span>📌</span>
                                <span>{pinnedPostId === post.id ? 'Desafixar' : 'Fixar'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{post.content}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {reactionOptions.map((emoji) => {
                            const count = post.reactions?.[emoji] || 0;
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(post.id, emoji)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold transition-all hover:bg-green-50 hover:border-green-300 ${
                                  count > 0
                                    ? 'border-green-400 text-green-700'
                                    : 'border-gray-200 text-gray-500'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
                          {post.comments && post.comments.length > 0 && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {post.comments.map((comment) => (
                                <div key={comment.id} className="flex items-start gap-2 text-xs">
                                  <div className="mt-0.5">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-700">
                                      {comment.user_name?.charAt(0)?.toUpperCase() || 'F'}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-800">{comment.user_name}</span>
                                      <span className="text-[10px] text-gray-400">
                                        {new Date(comment.created_at).toLocaleString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-700 whitespace-pre-line mb-1">
                                      {comment.content}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCommentLike(comment.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all ${
                                        likedComments[comment.id]
                                          ? 'border-pink-400 text-pink-600 bg-pink-50'
                                          : 'border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50'
                                      }`}
                                    >
                                      <span>{likedComments[comment.id] ? '❤️' : '🤍'}</span>
                                      <span>Curtir</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={familyCommentDrafts[post.id] || ''}
                              onChange={(e) =>
                                setFamilyCommentDrafts((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Escrever comentário..."
                              className="flex-1 px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-400 bg-gray-50"
                            />
                            <button
                              onClick={() => handleCreateComment(post.id)}
                              className="px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-all"
                              disabled={!familyUser}
                            >
                              Enviar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>

        {/* Árvore de Natal */}
        <div className="relative">
          <div className="flex justify-center mb-6 md:mb-10">
            <div className="relative">
              <div
                className="text-4xl md:text-6xl animate-pulse"
                style={{ animationDuration: '2.5s', filter: 'drop-shadow(0 0 14px gold)' }}
              >
                ⭐
              </div>
              <div
                className="absolute inset-0 text-4xl md:text-6xl animate-ping opacity-40"
                style={{ animationDuration: '3.5s' }}
              >
                ⭐
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 top-20 md:top-32 pointer-events-none hidden md:block">
            <div className="relative mb-[-30px]">
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '80px solid transparent',
                  borderRight: '80px solid transparent',
                  borderBottom: '100px solid rgba(34, 197, 94, 0.3)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
            <div className="relative mb-[-30px]">
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '120px solid transparent',
                  borderRight: '120px solid transparent',
                  borderBottom: '120px solid rgba(34, 197, 94, 0.35)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
            <div className="relative mb-[-30px]">
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '160px solid transparent',
                  borderRight: '160px solid transparent',
                  borderBottom: '140px solid rgba(34, 197, 94, 0.4)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
            <div className="relative mb-[-30px]">
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '200px solid transparent',
                  borderRight: '200px solid transparent',
                  borderBottom: '160px solid rgba(34, 197, 94, 0.45)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
            <div className="relative">
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '240px solid transparent',
                  borderRight: '240px solid transparent',
                  borderBottom: '180px solid rgba(34, 197, 94, 0.5)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                }}
              />
            </div>
          </div>

          <div
            className="hidden md:block absolute left-1/2 top-32 bottom-20 w-4 bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 -translate-x-1/2 shadow-2xl z-10"
            style={{ borderRadius: '4px' }}
          />
          <div className="hidden md:block absolute left-1/2 bottom-12 w-16 h-8 bg-amber-950 -translate-x-1/2 shadow-2xl rounded-b-lg z-10" />

          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            const itemDate = new Date(item.date);
            const diasParaNatal = Math.ceil(
              (natalDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            const images =
              item.image_urls
                ? typeof item.image_urls === 'string'
                  ? JSON.parse(item.image_urls)
                  : item.image_urls
                : item.image_url
                ? [item.image_url]
                : [];

            return (
              <div
                key={i}
                className={`relative mb-8 md:mb-16 ${isLeft ? 'md:pr-1/2' : 'md:pl-1/2'}`}
                style={{
                  animation: 'fadeIn 0.6s ease-out forwards',
                  animationDelay: `${i * 0.1}s`,
                  opacity: 0,
                }}
              >
                <div className="md:hidden absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 via-red-500 to-green-500 rounded-full shadow-lg" />

                <div
                  className={`md:hidden absolute left-0 top-4 w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-xl z-10 animate-pulse ${
                    item.type === 'payment'
                      ? 'bg-gradient-to-br from-green-400 to-green-600'
                      : 'bg-gradient-to-br from-red-400 to-red-600'
                  }`}
                  style={{ animationDuration: '3s' }}
                >
                  {item.type === 'payment' ? '💰' : '🎁'}
                </div>

                <div
                  className={`md:hidden absolute left-10 top-8 w-4 h-0.5 ${
                    item.type === 'payment' ? 'bg-green-400' : 'bg-red-400'
                  } opacity-50`}
                />

                <div
                  className={`hidden md:block absolute top-8 w-10 h-10 rounded-full border-4 border-yellow-300 z-20 shadow-2xl ${
                    item.type === 'payment'
                      ? 'bg-gradient-to-br from-green-300 via-green-500 to-green-700'
                      : 'bg-gradient-to-br from-red-400 via-red-600 to-red-800'
                  }`}
                  style={{
                    left: 'calc(50% - 20px)',
                    animation: 'dotPulse 2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                    boxShadow:
                      '0 0 20px rgba(255, 215, 0, 0.6), inset 0 2px 10px rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <div className="absolute top-1 left-2 w-3 h-3 bg-white/80 rounded-full blur-sm" />
                  <div
                    className="absolute inset-0 rounded-full bg-white/20 animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                </div>

                <div
                  className={`hidden md:block absolute top-10 h-1 bg-gradient-to-r ${
                    isLeft ? 'from-amber-700 to-transparent right-1/2' : 'from-transparent to-amber-700 left-1/2'
                  }`}
                  style={{
                    width: 'calc(50% - 80px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />

                <div
                  className={`${isLeft ? 'md:mr-auto md:pr-12' : 'md:ml-auto md:pl-12'} ml-14 md:ml-0 mr-4 md:mr-0 max-w-[calc(100%-4rem)] md:max-w-md relative z-20`}
                >
                  <div className="bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border-2 border-white/60 transform transition-all duration-300 hover:scale-[1.02] md:hover:scale-105 hover:shadow-3xl w-full">
                    <div className="bg-gradient-to-r from-red-600 via-red-500 to-green-600 px-3 md:px-6 py-2.5 md:py-3 text-white text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      <div className="relative z-10">
                        <div className="text-xs md:text-sm font-bold flex items-center justify-center gap-1">
                          <span>🎄</span>
                          <span>
                            {diasParaNatal > 0
                              ? `${diasParaNatal} dias antes`
                              : diasParaNatal === 0
                              ? 'NATAL!'
                              : `${Math.abs(diasParaNatal)} dias depois`}
                          </span>
                        </div>
                        <div className="text-xs opacity-90 mt-0.5 md:mt-1 font-medium">
                          {new Date(item.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>

                    {item.type === 'purchase' && images.length > 0 && (
                      <ImageCarousel images={images} description={item.description} />
                    )}

                    <div className="p-4 md:p-6">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-lg ${
                              item.type === 'payment'
                                ? 'bg-gradient-to-br from-green-100 to-green-200'
                                : 'bg-gradient-to-br from-red-100 to-red-200'
                            }`}
                          >
                            {item.type === 'payment' ? '💰' : '🎁'}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              item.type === 'payment'
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            {item.type === 'payment' ? 'Pagamento' : 'Compra'}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg md:text-xl font-black text-gray-900 mb-2 md:mb-3 leading-tight">
                        {item.description}
                      </h3>

                      <div
                        className={`inline-flex items-baseline gap-1 px-4 py-2 rounded-xl font-black mb-3 md:mb-4 ${
                          item.type === 'payment'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <span className="text-xl md:text-2xl">
                          {item.type === 'payment' ? '+' : '-'}
                        </span>
                        <span className="text-2xl md:text-3xl">R$</span>
                        <span className="text-2xl md:text-3xl">{formatCurrency(item.value)}</span>
                      </div>

                      {item.type === 'purchase' && (
                        <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                          {item.category && (
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <span className="text-sm md:text-base">📦</span>
                              <span className="text-gray-700">{item.category}</span>
                            </div>
                          )}
                          {item.brand && (
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <span className="text-sm md:text-base">🏷️</span>
                              <span className="text-gray-700">{item.brand}</span>
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-2 md:mt-3 p-2 md:p-3 bg-yellow-50 rounded-lg border-l-2 md:border-l-4 border-yellow-400">
                              <p className="text-xs font-bold text-yellow-800 mb-0.5 md:mb-1">📝 Obs:</p>
                              <p className="text-xs md:text-sm text-gray-700">{item.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-24 mb-8 relative z-10">
          <div className="flex justify-center items-end gap-4 mb-6">
            <div className="text-7xl animate-bounce" style={{ animationDelay: '0s', animationDuration: '2s' }}>
              🎁
            </div>
            <div className="text-9xl animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2.2s' }}>
              🎁
            </div>
            <div className="text-7xl animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '2.4s' }}>
              🎁
            </div>
          </div>
          <div className="inline-block bg-white/10 backdrop-blur-lg rounded-3xl px-12 py-6 border-4 border-yellow-400 shadow-2xl">
            <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2">Feliz Natal! 🎄</h2>
            <p className="text-xl text-yellow-300 font-bold">Que esta árvore traga muitas alegrias! ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
}
