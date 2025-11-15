'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Users, ShoppingCart, Clock, Plus, X, Check, AlertCircle } from 'lucide-react';

interface Participant {
  id: number;
  name: string;
  paid: boolean;
  paid_date: string | null;
}

interface Purchase {
  id: number;
  description: string;
  value: number;
  category: string;
  brand?: string;
  color?: string;
  size?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  image_urls?: string[]; // Array de URLs para múltiplas imagens
  created_at: string;
}

// 🎁 Interfaces do Amigo Oculto
interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}

interface SecretSantaConfig {
  id: number;
  year: number;
  is_active: boolean;
  draw_date: string;
  reveal_date?: string;
  min_gift_value?: number;
  max_gift_value?: number;
  rules?: DrawRule[];
}

interface SecretSantaDraw {
  id: number;
  receiver_id: number;
  receiver_name: string;
  revealed: boolean;
  revealed_at?: string;
}

interface WishListItem {
  id: number;
  participant_id: number;
  participant_name?: string;
  item_name: string;
  item_description?: string;
  item_url?: string;
  priority: number;
  purchased: boolean;
}

interface FamilyUser {
  id: number;
  name: string;
  username: string;
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

interface FamilyComment {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
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

// Componente Carousel de Imagens
function ImageCarousel({ images, description }: { images: string[], description: string }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const hasMultipleImages = images.length > 1;
  
  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
    if (isRightSwipe) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };
  
  return (
    <div 
      className="relative h-32 md:h-48 bg-gray-100 overflow-hidden group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Container de Imagens com Transição */}
      <div className="relative w-full h-full">
        {images.map((img, idx) => (
          <img 
            key={idx}
            src={img} 
            alt={`${description} - ${idx + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              idx === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          />
        ))}
      </div>
      
      {/* Indicadores e Controles (apenas se houver múltiplas imagens) */}
      {hasMultipleImages && (
        <>
          {/* Botões de Navegação - Sempre visíveis em mobile, hover em desktop */}
          <button
            onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 text-xl font-bold"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 text-xl font-bold"
          >
            ›
          </button>
          
          {/* Contador de Imagens */}
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">
            {currentImageIndex + 1}/{images.length}
          </div>
          
          {/* Indicadores de Pontos */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentImageIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Componente de Toast/Notificação
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-slideIn flex items-center gap-3 max-w-md`}>
      <span className="text-2xl">{icon}</span>
      <p className="font-semibold">{message}</p>
      <button onClick={onClose} className="ml-4 text-white/80 hover:text-white text-xl font-bold">×</button>
    </div>
  );
}

export default function ChristmasOrganizer() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState('timeline');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para toasts
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);

  const [newParticipant, setNewParticipant] = useState('');
  const [newPurchase, setNewPurchase] = useState({
    description: '',
    value: '',
    category: 'Decoração',
    brand: '',
    color: '',
    size: '',
    quantity: 1,
    notes: '',
    image_url: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  // Snowflakes - só renderiza no cliente
  const [snowflakes, setSnowflakes] = useState<Array<{left: string, duration: string, delay: string, size: string}>>([]);
  
  // Estrelas da timeline - só renderiza no cliente
  const [stars, setStars] = useState<Array<{left: string, top: string, size: string}>>([]);

  // 🎁 Estados do Amigo Oculto
  const [secretSantaConfig, setSecretSantaConfig] = useState<SecretSantaConfig | null>(null);
  const [allDraws, setAllDraws] = useState<any[]>([]);
  const [drawRules, setDrawRules] = useState<DrawRule[]>([]);
  const [minGiftValue, setMinGiftValue] = useState<number>(50);
  const [maxGiftValue, setMaxGiftValue] = useState<number>(150);
  const [selectedP1, setSelectedP1] = useState<number>(0);
  const [selectedP2, setSelectedP2] = useState<number>(0);
  const [revealToken, setRevealToken] = useState<string>('');
  const [revealedDraw, setRevealedDraw] = useState<any>(null);
  const [showRevealSection, setShowRevealSection] = useState(false);
  const [receiverWishList, setReceiverWishList] = useState<WishListItem[]>([]);
  const [myWishList, setMyWishList] = useState<WishListItem[]>([]);
  const [showMyWishList, setShowMyWishList] = useState(false);
  const [newWishItem, setNewWishItem] = useState({
    item_name: '',
    item_description: '',
    item_url: '',
    priority: 2
  });
  const [selectedParticipantForWishList, setSelectedParticipantForWishList] = useState<number>(0);
  const [adminWishList, setAdminWishList] = useState<WishListItem[]>([]);

  // 👨‍👩‍👧‍👦 Rede social de Natal (mural da família)
  const [familyUser, setFamilyUser] = useState<FamilyUser | null>(null);
  const [familyPosts, setFamilyPosts] = useState<FamilyPost[]>([]);
  const [familyPolls, setFamilyPolls] = useState<FamilyPoll[]>([]);
  const [familyAttendance, setFamilyAttendance] = useState<FamilyAttendance[]>([]);
  const [familyAuthMode, setFamilyAuthMode] = useState<'login' | 'register'>('login');
  const [familyUsername, setFamilyUsername] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyPassword, setFamilyPassword] = useState('');
  const [familyPostContent, setFamilyPostContent] = useState('');
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyPosting, setFamilyPosting] = useState(false);
  const [familyAuthError, setFamilyAuthError] = useState('');
  const [familyCommentDrafts, setFamilyCommentDrafts] = useState<Record<number, string>>({});
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptionsText, setNewPollOptionsText] = useState('');
  const [familyImageFile, setFamilyImageFile] = useState<File | null>(null);
  const [familyImagePreview, setFamilyImagePreview] = useState<string | null>(null);
  const [familyUploadingImage, setFamilyUploadingImage] = useState(false);
  const reactionOptions = ['🎄', '🎅', '🎁', '❤️', '😂'];

  const CONTRIBUTION = 50;

  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  const tourSteps = [
    {
      id: 1,
      title: 'Onde você está',
      body: 'Esta é a Timeline, a tela principal do Natal em Família. É aqui que todo mundo entra para ver o que está acontecendo.'
    },
    {
      id: 2,
      title: 'Entrar no mural',
      body: 'Mais embaixo tem o Mural da Família. Lá você cria um usuário simples (nome, usuário e senha) e faz login para poder participar.'
    },
    {
      id: 3,
      title: 'Escrever recados e fotos',
      body: 'Depois de logado no mural, você pode escrever mensagens para a família e, se quiser, anexar uma foto. Essas fotos vão para o Álbum da Família.'
    },
    {
      id: 4,
      title: 'Confirmar presença',
      body: 'No card de Presença no Natal você marca se vai, talvez vá ou não vai. Isso é o que usamos para contar quantas pessoas vão à ceia.'
    },
    {
      id: 5,
      title: 'Votar nas enquetes',
      body: 'Nas Enquetes da Família você ajuda a decidir coisas rápidas do Natal (horário, comida, brincadeiras) só clicando nas opções.'
    },
  ];

  // Verificar se está logado ao carregar
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken === 'admin-authenticated') {
      setIsAdmin(true);
      setActiveTab('dashboard');
    }

    // Carregar usuário da família salvo (mural)
    const storedFamilyUser = localStorage.getItem('familyUser');
    if (storedFamilyUser) {
      try {
        const parsed = JSON.parse(storedFamilyUser);
        if (parsed && parsed.id && parsed.username) {
          setFamilyUser(parsed);
        }
      } catch {
        localStorage.removeItem('familyUser');
      }
    }
    
    // Gerar flocos de neve sutis apenas no cliente
    const flakes = Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      duration: `${10 + Math.random() * 20}s`,
      delay: `${Math.random() * 10}s`,
      size: `${0.8 + Math.random() * 1}em`
    }));
    setSnowflakes(flakes);
    
    // Gerar estrelas da timeline apenas no cliente
    const starsList = Array.from({ length: 30 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 10 + 5}px`
    }));
    setStars(starsList);
  }, []);

  // Login do admin
  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        setIsAdmin(true);
        setShowLogin(false);
        setPassword('');
        setActiveTab('dashboard');
      } else {
        setLoginError('Senha incorreta!');
      }
    } catch (error) {
      setLoginError('Erro ao fazer login');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
    setActiveTab('timeline');
  };

  // Autenticação da família (mural)
  const handleFamilyAuth = async () => {
    if (!familyUsername.trim() || !familyPassword.trim() || (familyAuthMode === 'register' && !familyName.trim())) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    setFamilyLoading(true);
    setFamilyAuthError('');
    try {
      const res = await fetch('/api/family-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: familyAuthMode,
          username: familyUsername,
          name: familyName,
          password: familyPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFamilyAuthError(data.message || 'Erro ao autenticar');
        return;
      }

      const user: FamilyUser = data.user;
      setFamilyUser(user);
      localStorage.setItem('familyUser', JSON.stringify(user));
      setFamilyUsername('');
      setFamilyName('');
      setFamilyPassword('');
      setFamilyAuthError('');
      setToast({
        message: familyAuthMode === 'register' ? 'Cadastro realizado com sucesso!' : 'Login realizado com sucesso!',
        type: 'success',
      });
    } catch (error) {
      setFamilyAuthError('Erro ao autenticar. Tente novamente.');
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleFamilyLogout = () => {
    setFamilyUser(null);
    localStorage.removeItem('familyUser');
  };

  const handleFamilyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFamilyImageFile(file || null);
    setFamilyImagePreview(null);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFamilyImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFamilyImage = async (): Promise<string | null> => {
    if (!familyImageFile) return null;

    setFamilyUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', familyImageFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        console.error('Erro no upload da imagem do mural:', data);
        setToast({ message: data.error || 'Erro ao enviar imagem', type: 'error' });
        return null;
      }

      return data.url as string;
    } catch (error) {
      console.error('Erro ao enviar imagem do mural:', error);
      setToast({ message: 'Erro ao enviar imagem', type: 'error' });
      return null;
    } finally {
      setFamilyUploadingImage(false);
    }
  };

  const handleCreateFamilyPost = async () => {
    if (!familyUser) {
      setToast({ message: 'Faça login para postar no mural', type: 'error' });
      return;
    }
    if (!familyPostContent.trim() && !familyImageFile) {
      setToast({ message: 'Escreva uma mensagem ou adicione uma foto para postar', type: 'error' });
      return;
    }

    setFamilyPosting(true);
    try {
      let imageUrl: string | null = null;
      if (familyImageFile) {
        setToast({ message: 'Enviando foto...', type: 'info' });
        imageUrl = await uploadFamilyImage();
        if (familyImageFile && !imageUrl) {
          // Falha no upload; não prossegue com o post
          return;
        }
      }

      const res = await fetch('/api/family-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: familyUser.id,
          content: familyPostContent,
          image_url: imageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ message: data.message || 'Erro ao criar post', type: 'error' });
        return;
      }

      setFamilyPosts(prev => [data as FamilyPost, ...prev]);
      setFamilyPostContent('');
      setFamilyImageFile(null);
      setFamilyImagePreview(null);
      setToast({ message: 'Mensagem enviada para o mural! 🎄', type: 'success' });
    } catch (error) {
      setToast({ message: 'Erro ao criar post', type: 'error' });
    } finally {
      setFamilyPosting(false);
    }
  };

  const handleCreateComment = async (postId: number) => {
    if (!familyUser) {
      setToast({ message: 'Faça login para comentar no mural', type: 'error' });
      return;
    }

    const content = (familyCommentDrafts[postId] || '').trim();
    if (!content) {
      setToast({ message: 'Digite um comentário antes de enviar', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/family-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          user_id: familyUser.id,
          content,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToast({ message: data.message || 'Erro ao comentar', type: 'error' });
        return;
      }

      setFamilyCommentDrafts(prev => ({ ...prev, [postId]: '' }));
      await loadFamilyPosts();
    } catch (error) {
      setToast({ message: 'Erro ao comentar', type: 'error' });
    }
  };

  const handleToggleReaction = async (postId: number, reaction: string) => {
    if (!familyUser) {
      setToast({ message: 'Faça login para reagir aos posts', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/family-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          user_id: familyUser.id,
          reaction_type: reaction,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.message || 'Erro ao reagir', type: 'error' });
        return;
      }

      // Recarrega o mural para atualizar contadores
      await loadFamilyPosts();
    } catch (error) {
      setToast({ message: 'Erro ao reagir', type: 'error' });
    }
  };

  const handleCreatePoll = async () => {
    if (!familyUser) {
      setToast({ message: 'Faça login para criar enquetes', type: 'error' });
      return;
    }

    const question = newPollQuestion.trim();
    const options = newPollOptionsText
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (!question || options.length < 2) {
      setToast({ message: 'Digite a pergunta e pelo menos 2 opções (uma por linha)', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/family-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          question,
          options,
          user_id: familyUser.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToast({ message: data.message || 'Erro ao criar enquete', type: 'error' });
        return;
      }

      setNewPollQuestion('');
      setNewPollOptionsText('');
      await loadFamilyPolls();
      setToast({ message: 'Enquete criada com sucesso!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Erro ao criar enquete', type: 'error' });
    }
  };

  const handleVotePoll = async (pollId: number, optionIndex: number) => {
    if (!familyUser) {
      setToast({ message: 'Faça login para votar na enquete', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/family-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          poll_id: pollId,
          option_index: optionIndex,
          user_id: familyUser.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToast({ message: data.message || 'Erro ao votar', type: 'error' });
        return;
      }

      await loadFamilyPolls();
    } catch (error) {
      setToast({ message: 'Erro ao votar', type: 'error' });
    }
  };

  const handleSetAttendance = async (status: 'yes' | 'maybe' | 'no') => {
    if (!familyUser) {
      setToast({ message: 'Faça login no mural para marcar presença', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/family-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: familyUser.id,
          status,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToast({ message: data.message || 'Erro ao atualizar presença', type: 'error' });
        return;
      }

      await loadFamilyAttendance();
      setToast({ message: 'Presença atualizada com sucesso!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Erro ao atualizar presença', type: 'error' });
    }
  };

  // Função helper para formatar valores de forma segura - ATUALIZADO
  const formatCurrency = (value: any): string => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const loadFamilyPosts = async () => {
    try {
      const res = await fetch('/api/family-posts');
      if (res.ok) {
        const data = await res.json();
        setFamilyPosts(Array.isArray(data) ? data : []);
      } else {
        console.error('Erro ao carregar mural:', res.status);
        setFamilyPosts([]);
      }
    } catch (error) {
      console.error('Erro ao carregar mural:', error);
      setFamilyPosts([]);
    }
  };

  const loadFamilyPolls = async () => {
    try {
      const res = await fetch('/api/family-polls');
      if (res.ok) {
        const data = await res.json();
        setFamilyPolls(Array.isArray(data) ? data : []);
      } else {
        console.error('Erro ao carregar enquetes:', res.status);
        setFamilyPolls([]);
      }
    } catch (error) {
      console.error('Erro ao carregar enquetes:', error);
      setFamilyPolls([]);
    }
  };

  const loadFamilyAttendance = async () => {
    try {
      const res = await fetch('/api/family-attendance');
      if (res.ok) {
        const data = await res.json();
        const normalized: FamilyAttendance[] = Array.isArray(data)
          ? data.map((row: any) => ({
              participant_id: Number(row.participant_id),
              name: String(row.name),
              status: row.status === 'yes' || row.status === 'maybe' || row.status === 'no' ? row.status : null,
            }))
          : [];
        setFamilyAttendance(normalized);
      } else {
        console.error('Erro ao carregar presença:', res.status);
        setFamilyAttendance([]);
      }
    } catch (error) {
      console.error('Erro ao carregar presença:', error);
      setFamilyAttendance([]);
    }
  };

  // Carregar dados
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'participants' || activeTab === 'dashboard') {
        const res = await fetch('/api/participants');
        if (res.ok) {
          const data = await res.json();
          setParticipants(Array.isArray(data) ? data : []);
        } else {
          console.error('Erro ao carregar participantes:', res.status);
          setParticipants([]);
        }
      }
      if (activeTab === 'purchases' || activeTab === 'dashboard') {
        const res = await fetch('/api/purchases');
        if (res.ok) {
          const data = await res.json();
          setPurchases(Array.isArray(data) ? data : []);
        } else {
          console.error('Erro ao carregar compras:', res.status);
          setPurchases([]);
        }
      }
      if (activeTab === 'timeline') {
        const res = await fetch('/api/timeline');
        if (res.ok) {
          const data = await res.json();
          setTimeline(Array.isArray(data) ? data : []);
        } else {
          console.error('Erro ao carregar timeline:', res.status);
          setTimeline([]);
        }

        await loadFamilyPosts();
        await loadFamilyPolls();
        await loadFamilyAttendance();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setParticipants([]);
      setPurchases([]);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar participante
  const addParticipant = async () => {
    if (!newParticipant.trim()) {
      setToast({ message: 'Por favor, digite um nome!', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newParticipant })
      });
      
      if (response.ok) {
        setToast({ message: `🎅 ${newParticipant} adicionado com sucesso!`, type: 'success' });
        setNewParticipant('');
        setShowAddParticipant(false);
        loadData();
      } else {
        throw new Error('Erro ao adicionar participante');
      }
    } catch (error) {
      setToast({ message: 'Erro ao adicionar participante. Tente novamente.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle pagamento
  const togglePayment = async (id: number, paid: boolean) => {
    try {
      const response = await fetch(`/api/participants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !paid })
      });
      
      if (response.ok) {
        setToast({ message: paid ? '💰 Pagamento removido!' : '✅ Pagamento confirmado!', type: 'success' });
        loadData();
      } else {
        throw new Error('Erro ao atualizar pagamento');
      }
    } catch (error) {
      setToast({ message: 'Erro ao atualizar pagamento. Tente novamente.', type: 'error' });
    }
  };

  // Remover participante
  const removeParticipant = async (id: number) => {
    await fetch(`/api/participants/${id}`, { method: 'DELETE' });
    loadData();
  };

  // Upload de múltiplas imagens
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedImages(prev => [...prev, ...files]);
      
      // Gerar previews
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return [];
    
    setUploadingImage(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const image of selectedImages) {
        console.log('📤 Enviando arquivo:', image.name, image.size, 'bytes');
        
        const formData = new FormData();
        formData.append('file', image);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          console.error('❌ Erro na resposta:', data);
          alert(`Erro no upload de ${image.name}: ${data.error}\n${data.details || ''}`);
          continue;
        }
        
        console.log('✅ Upload bem-sucedido! URL:', data.url);
        uploadedUrls.push(data.url);
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('❌ Erro ao fazer upload:', error);
      alert('Erro ao fazer upload das imagens. Verifique o console.');
      return uploadedUrls;
    } finally {
      setUploadingImage(false);
    }
  };

  const addPurchaseWithImage = async () => {
    if (!newPurchase.description || !newPurchase.value) {
      setToast({ message: 'Preencha descrição e valor!', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Upload das imagens se houver
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        setToast({ message: `📸 Enviando ${selectedImages.length} foto(s)...`, type: 'info' });
        imageUrls = await uploadImages();
        if (imageUrls.length === 0) {
          throw new Error('Falha no upload das imagens');
        }
      }
      
      // Usar a primeira imagem como principal (compatibilidade) e salvar todas
      const imageUrl = imageUrls.length > 0 ? imageUrls[0] : '';
      
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...newPurchase, 
          image_url: imageUrl,
          image_urls: JSON.stringify(imageUrls) // Salvar array como JSON string
        })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar compra');
      }
      
      setToast({ message: `🎁 ${newPurchase.description} adicionado com sucesso!`, type: 'success' });
      
      setNewPurchase({
        description: '',
        value: '',
        category: 'Decoração',
        brand: '',
        color: '',
        size: '',
        quantity: 1,
        notes: '',
        image_url: ''
      });
      setSelectedImages([]);
      setImagePreviews([]);
      setShowAddPurchase(false);
      loadData();
    } catch (error) {
      setToast({ message: 'Erro ao adicionar compra. Tente novamente.', type: 'error' });
      console.error('Erro:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remover compra
  const removePurchase = async (id: number) => {
    await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    loadData();
  };

  // 🎁 Funções do Amigo Oculto
  const fetchSecretSantaConfig = async () => {
    try {
      const res = await fetch('/api/secret-santa?action=config');
      const data = await res.json();
      setSecretSantaConfig(data);
    } catch (error) {
      console.error('Erro ao buscar config:', error);
    }
  };

  const fetchAllDraws = async () => {
    try {
      const res = await fetch('/api/secret-santa?action=all-draws');
      const data = await res.json();
      setAllDraws(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao buscar sorteios:', error);
      setAllDraws([]);
    }
  };

  const performDraw = async () => {
    if (!confirm('Tem certeza que deseja fazer o sorteio? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/secret-santa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draw',
          rules: drawRules,
          min_gift_value: minGiftValue,
          max_gift_value: maxGiftValue
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setToast({ message: `🎁 Sorteio realizado! ${data.total_participants} participantes`, type: 'success' });
        await fetchSecretSantaConfig();
        await fetchAllDraws();
      } else {
        setToast({ message: `Erro: ${data.error}`, type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Erro ao fazer sorteio', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addDrawRule = () => {
    if (selectedP1 && selectedP2 && selectedP1 !== selectedP2) {
      setDrawRules([...drawRules, {
        type: 'cannot_draw',
        participant1_id: selectedP1,
        participant2_id: selectedP2
      }]);
      setSelectedP1(0);
      setSelectedP2(0);
    }
  };

  const removeDrawRule = (index: number) => {
    setDrawRules(drawRules.filter((_, i) => i !== index));
  };

  const cancelDraw = async () => {
    if (!confirm('Cancelar sorteio atual?')) return;
    
    try {
      await fetch('/api/secret-santa', { method: 'DELETE' });
      setSecretSantaConfig(null);
      setAllDraws([]);
      setToast({ message: 'Sorteio cancelado', type: 'info' });
    } catch (error) {
      setToast({ message: 'Erro ao cancelar sorteio', type: 'error' });
    }
  };

  // Revelar amigo oculto por token (público)
  const revealByToken = async () => {
    if (!revealToken.trim()) {
      setToast({ message: 'Digite um token válido', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/secret-santa?action=reveal-by-token&token=${revealToken.trim()}`);
      const data = await res.json();
      
      if (res.ok) {
        setRevealedDraw(data);
        
        // Marcar como revelado
        await fetch('/api/secret-santa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reveal',
            token: revealToken.trim()
          })
        });
        
        // Buscar lista de desejos da pessoa que você tirou
        await fetchReceiverWishList(data.receiver_id);
        
        setToast({ message: '🎁 Amigo oculto revelado!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Token inválido', type: 'error' });
        setRevealedDraw(null);
      }
    } catch (error) {
      setToast({ message: 'Erro ao revelar', type: 'error' });
      setRevealedDraw(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buscar lista de desejos da pessoa que você tirou
  const fetchReceiverWishList = async (participantId: number) => {
    try {
      const res = await fetch(`/api/wishlist?participant_id=${participantId}`);
      const data = await res.json();
      setReceiverWishList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao buscar wishlist:', error);
      setReceiverWishList([]);
    }
  };

  // Buscar minha lista de desejos
  const fetchMyWishList = async (participantId: number) => {
    try {
      const res = await fetch(`/api/wishlist?participant_id=${participantId}`);
      const data = await res.json();
      setMyWishList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao buscar minha wishlist:', error);
      setMyWishList([]);
    }
  };

  // Adicionar item à minha lista de desejos
  const addWishItem = async (giverName: string) => {
    if (!newWishItem.item_name.trim()) {
      setToast({ message: 'Digite o nome do item', type: 'error' });
      return;
    }

    // Encontrar meu ID pelo nome
    const me = participants.find(p => p.name === giverName);
    if (!me) {
      setToast({ message: 'Erro ao identificar participante', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: me.id,
          ...newWishItem
        })
      });

      if (res.ok) {
        setToast({ message: '✅ Item adicionado à sua lista!', type: 'success' });
        setNewWishItem({
          item_name: '',
          item_description: '',
          item_url: '',
          priority: 2
        });
        await fetchMyWishList(me.id);
      } else {
        throw new Error('Erro ao adicionar item');
      }
    } catch (error) {
      setToast({ message: 'Erro ao adicionar item', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deletar item da minha lista
  const deleteWishItem = async (itemId: number, participantId: number) => {
    try {
      await fetch(`/api/wishlist/${itemId}`, { method: 'DELETE' });
      setToast({ message: 'Item removido', type: 'info' });
      await fetchMyWishList(participantId);
    } catch (error) {
      setToast({ message: 'Erro ao remover item', type: 'error' });
    }
  };

  // Marcar item como comprado
  const togglePurchased = async (itemId: number, purchased: boolean, participantId: number) => {
    try {
      await fetch(`/api/wishlist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchased: !purchased })
      });
      await fetchReceiverWishList(participantId);
    } catch (error) {
      setToast({ message: 'Erro ao atualizar item', type: 'error' });
    }
  };

  // Admin: Buscar lista de desejos de um participante
  const fetchAdminWishList = async (participantId: number) => {
    try {
      const res = await fetch(`/api/wishlist?participant_id=${participantId}`);
      const data = await res.json();
      setAdminWishList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao buscar wishlist:', error);
      setAdminWishList([]);
    }
  };

  // Admin: Adicionar item à lista de um participante
  const addAdminWishItem = async () => {
    if (!selectedParticipantForWishList) {
      setToast({ message: 'Selecione um participante', type: 'error' });
      return;
    }
    if (!newWishItem.item_name.trim()) {
      setToast({ message: 'Digite o nome do item', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: selectedParticipantForWishList,
          ...newWishItem
        })
      });

      if (res.ok) {
        setToast({ message: '✅ Item adicionado!', type: 'success' });
        setNewWishItem({
          item_name: '',
          item_description: '',
          item_url: '',
          priority: 2
        });
        await fetchAdminWishList(selectedParticipantForWishList);
      } else {
        throw new Error('Erro ao adicionar item');
      }
    } catch (error) {
      setToast({ message: 'Erro ao adicionar item', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin: Deletar item da lista
  const deleteAdminWishItem = async (itemId: number) => {
    try {
      await fetch(`/api/wishlist/${itemId}`, { method: 'DELETE' });
      setToast({ message: 'Item removido', type: 'info' });
      if (selectedParticipantForWishList) {
        await fetchAdminWishList(selectedParticipantForWishList);
      }
    } catch (error) {
      setToast({ message: 'Erro ao remover item', type: 'error' });
    }
  };

  // Carregar dados do amigo oculto quando admin
  useEffect(() => {
    if (isAdmin && activeTab === 'secret-santa') {
      fetchSecretSantaConfig();
      fetchAllDraws();
    }
  }, [isAdmin, activeTab]);

  // Carregar participantes e config quando abrir seção de revelação
  useEffect(() => {
    if (showRevealSection && participants.length === 0) {
      loadData();
    }
    if (showRevealSection) {
      fetchSecretSantaConfig();
    }
  }, [showRevealSection]);

  // Cálculos
  const totalExpected = participants.length * CONTRIBUTION;
  const totalReceived = participants.filter(p => p.paid).length * CONTRIBUTION;
  const totalSpent = purchases.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  const balance = totalReceived - totalSpent;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/95 relative">
      {/* Toast de Notificação */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      {/* Flocos de Neve - Renderizado apenas no cliente */}
      {snowflakes.map((flake, i) => (
        <div
          key={i}
          className="snowflake"
          style={{
            left: flake.left,
            animationDuration: flake.duration,
            animationDelay: flake.delay,
            fontSize: flake.size
          }}
        >
          ❄️
        </div>
      ))}
      
      {/* Header NATALINO (refinado) */}
      <header className="bg-black/40 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl relative shadow-lg">
        {/* Luzes de Natal mais sutis */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-70"
          style={{ animation: 'christmasLights 3s linear infinite' }}
        />

        {/* Neve suave no Header */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1 left-2 text-white/15 text-4xl">❄️</div>
          <div className="absolute top-1 right-3 text-white/15 text-4xl">❄️</div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-5 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 bg-white/95 rounded-2xl flex items-center justify-center shadow-xl relative animate-pulse" style={{ animationDuration: '2.2s' }}>
                <span className="text-3xl md:text-5xl">🎅</span>
                <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 text-lg md:text-xl animate-bounce">⭐</div>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-white flex items-center gap-2 md:gap-3 drop-shadow">
                  <span className="animate-bounce" style={{animationDelay: '0s'}}>🎄</span>
                  <span className="hidden sm:inline">Natal em Família 2025</span>
                  <span className="sm:hidden">Natal 2025</span>
                  <span className="animate-bounce" style={{animationDelay: '0.2s'}}>🎁</span>
                </h1>
                <p className="text-xs md:text-sm text-yellow-200 font-semibold mt-1">
                  {isAdmin ? '👑 Painel do Papai Noel' : '✨ Timeline Mágica do Natal'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isAdmin && (
                <button
                  onClick={() => setShowRevealSection(!showRevealSection)}
                  className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-105 border-2 border-purple-400"
                >
                  🎁 <span className="hidden sm:inline">Meu Amigo Oculto</span><span className="sm:hidden">Amigo</span>
                </button>
              )}
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold text-red-700 bg-white hover:bg-yellow-100 rounded-xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-105 border-2 border-yellow-400"
                >
                  🚪 Sair
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold text-white bg-yellow-500 hover:bg-yellow-400 rounded-xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-105 border-2 border-yellow-300 animate-pulse"
                  style={{animationDuration: '2s'}}
                >
                  🎅 <span className="hidden sm:inline">Login do Papai Noel</span><span className="sm:hidden">Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation NATALINA */}
      {isAdmin && (
        <nav className="bg-black/30 border-b border-white/10 shadow-sm overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex gap-1.5 md:gap-2 min-w-max md:min-w-0">
              {[
                { id: 'dashboard', label: '🎁 Visão Geral', shortLabel: '🎁 Visão', icon: DollarSign },
                { id: 'participants', label: '👨‍👩‍👧‍👦 Família', shortLabel: '👨‍👩‍👧‍👦', icon: Users },
                { id: 'purchases', label: '🛒 Compras', shortLabel: '🛒', icon: ShoppingCart },
                { id: 'secret-santa', label: '🎅 Amigo Oculto', shortLabel: '🎅', icon: Users },
                { id: 'timeline', label: '🎄 Timeline', shortLabel: '🎄', icon: Clock }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2.5 md:py-3.5 text-xs md:text-sm font-semibold transition-all relative rounded-t-xl whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-white bg-gradient-to-r from-red-600 to-green-600 shadow-md transform scale-[1.02]'
                      : 'text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-400"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Modal de Login Profissional */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{animation: 'scaleIn 0.3s ease-out'}}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
              <h2 className="text-2xl font-bold text-white">Acesso Administrativo</h2>
              <p className="text-blue-100 text-sm mt-1">Digite sua senha para continuar</p>
            </div>
            <div className="p-6">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Senha"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all mb-4"
              />
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {loginError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleLogin}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all"
                >
                  Entrar
                </button>
                <button
                  onClick={() => {
                    setShowLogin(false);
                    setPassword('');
                    setLoginError('');
                  }}
                  className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && <div className="text-center py-8">Carregando...</div>}

        {/* 🎁 SEÇÃO DE REVELAÇÃO POR TOKEN (Público) */}
        {!isAdmin && showRevealSection && (
          <div className="mb-8">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border-4 border-purple-300">
              <h2 className="text-3xl font-bold text-purple-600 mb-4 text-center">🎁 Revelar Meu Amigo Oculto</h2>
              
              {!revealedDraw ? (
                <div className="space-y-4">
                  <p className="text-gray-700 text-center">
                    Digite o token que você recebeu para descobrir quem é seu amigo oculto!
                  </p>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      value={revealToken}
                      onChange={(e) => setRevealToken(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && revealByToken()}
                      placeholder="Digite seu token (ex: ABC12345)"
                      className="flex-1 px-4 py-3 text-center text-2xl font-mono font-bold border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none uppercase tracking-wider"
                      maxLength={8}
                    />
                    <button
                      onClick={revealByToken}
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Revelando...
                        </>
                      ) : (
                        <>🎁 Revelar</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-lg text-gray-700 mb-2">Olá, <span className="font-bold text-purple-600">{revealedDraw.giver_name}</span>!</p>
                    <p className="text-2xl font-bold text-gray-800 mb-4">Você tirou:</p>
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-8 rounded-2xl border-4 border-purple-400 shadow-xl">
                      <p className="text-5xl font-black text-purple-600 mb-2">{revealedDraw.receiver_name}</p>
                      <p className="text-xl text-gray-700">🎁 Seu amigo oculto!</p>
                    </div>
                  </div>
                  
                  {secretSantaConfig && secretSantaConfig.min_gift_value && (
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <p className="text-sm text-blue-800">
                        <span className="font-bold">💰 Valor sugerido do presente:</span> R$ {secretSantaConfig.min_gift_value} - R$ {secretSantaConfig.max_gift_value}
                      </p>
                    </div>
                  )}

                  {/* Lista de Desejos da Pessoa que Você Tirou */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300">
                    <h3 className="text-xl font-bold text-green-700 mb-3 flex items-center gap-2">
                      🎁 Sugestões de Presente de {revealedDraw.receiver_name}
                    </h3>
                    {receiverWishList.length > 0 ? (
                      <div className="space-y-3">
                        {receiverWishList.map((item) => (
                          <div key={item.id} className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-gray-800">{item.item_name}</h4>
                                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                    item.priority === 3 ? 'bg-red-100 text-red-700' :
                                    item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.priority === 3 ? '⭐⭐⭐ Alta' : item.priority === 2 ? '⭐⭐ Média' : '⭐ Baixa'}
                                  </span>
                                </div>
                                {item.item_description && (
                                  <p className="text-sm text-gray-600 mb-2">{item.item_description}</p>
                                )}
                                {item.item_url && (
                                  <a 
                                    href={item.item_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                                  >
                                    🔗 Ver produto
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => togglePurchased(item.id, item.purchased, revealedDraw.receiver_id)}
                                className={`ml-3 px-3 py-1 rounded-lg font-bold text-sm transition-all ${
                                  item.purchased 
                                    ? 'bg-green-500 text-white hover:bg-green-600' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {item.purchased ? '✓ Comprado' : 'Marcar'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-center py-4">
                        {revealedDraw.receiver_name} ainda não adicionou sugestões de presente.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setRevealedDraw(null);
                        setRevealToken('');
                        setReceiverWishList([]);
                        setMyWishList([]);
                        setShowMyWishList(false);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all"
                    >
                      Revelar Outro Token
                    </button>
                    <button
                      onClick={() => setShowRevealSection(false)}
                      className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DASHBOARD NATALINO */}
        {isAdmin && activeTab === 'dashboard' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 p-6 card-hover relative overflow-hidden shadow-xl">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎁</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Esperado</div>
                <div className="text-3xl font-bold text-gray-900">R$ {formatCurrency(totalExpected)}</div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 p-6 card-hover relative overflow-hidden shadow-xl">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎄</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="text-green-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Arrecadado</div>
                <div className="text-3xl font-bold text-green-600">R$ {formatCurrency(totalReceived)}</div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 p-6 card-hover relative overflow-hidden shadow-xl">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎅</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="text-orange-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Gasto</div>
                <div className="text-3xl font-bold text-orange-600">R$ {formatCurrency(totalSpent)}</div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 p-6 card-hover relative overflow-hidden shadow-xl">
                <div className="absolute top-2 right-2 text-2xl opacity-20">⭐</div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    balance >= 0 ? 'bg-purple-100' : 'bg-red-100'
                  }`}>
                    <DollarSign className={balance >= 0 ? 'text-purple-600' : 'text-red-600'} size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Saldo</div>
                <div className={`text-3xl font-bold ${balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  R$ {formatCurrency(balance)}
                </div>
              </div>

              {/* 📸 Álbum da Família */}
            <div className="mb-12 -mx-4 md:-mx-8">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                        <span className="text-sm">📸</span>
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Álbum da família</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-gray-900">
                        Fotos do Natal em Família
                      </h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        Todas as fotos postadas no mural aparecem aqui, em uma grade especial do Natal.
                      </p>
                    </div>
                  </div>

                  {familyPosts.some(p => p.image_url) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {familyPosts
                        .filter(p => p.image_url)
                        .map((post) => (
                          <div
                            key={post.id}
                            className="relative group rounded-xl overflow-hidden border border-white shadow-sm bg-gray-900/5"
                          >
                            <img
                              src={post.image_url as string}
                              alt={post.content || `Foto de ${post.user_name}`}
                              className="w-full h-28 md:h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-1 left-1 right-1 px-2 py-1 flex justify-between items-end text-[10px] text-white">
                              <span className="font-semibold truncate max-w-[70%]">
                                {post.user_name}
                              </span>
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

              {/* ✅ Presença no Natal (RSVP) */}
            <div className="mb-12 -mx-6 md:-mx-12">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100/70">
                  {(() => {
                    const yesCount = familyAttendance.filter(a => a.status === 'yes').length;
                    const maybeCount = familyAttendance.filter(a => a.status === 'maybe').length;
                    const noCount = familyAttendance.filter(a => a.status === 'no').length;
                    const totalResponded = yesCount + maybeCount + noCount;
                    const myStatus = familyUser
                      ? familyAttendance.find(a => a.name === familyUser.name)?.status || null
                      : null;

                    return (
                      <>
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                              <span className="text-sm">✅</span>
                              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Presença no Natal</span>
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-900">
                              Quem vai estar na ceia?
                            </h2>
                            <p className="text-xs md:text-sm text-gray-600 mt-1">
                              Marque se você vai, talvez vá ou não vai. Isso ajuda a organizar comida, bebida e presentes.
                            </p>
                          </div>
                          {totalResponded > 0 && (
                            <div className="hidden md:flex flex-col items-end text-xs text-gray-600">
                              <span className="font-semibold text-emerald-700">{yesCount} confirmad{yesCount === 1 ? 'o' : 'os'}</span>
                              {maybeCount > 0 && (
                                <span className="text-amber-600">{maybeCount} talvez</span>
                              )}
                              {noCount > 0 && (
                                <span className="text-gray-500">{noCount} não vão</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botões do meu RSVP */}
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

                        {/* Resumo de presença */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs md:text-sm">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col">
                            <span className="text-[11px] font-semibold text-emerald-700 uppercase mb-1">Confirmados ✅</span>
                            {yesCount === 0 ? (
                              <span className="text-gray-500">Ninguém confirmou ainda.</span>
                            ) : (
                              <span className="text-gray-800">
                                {familyAttendance
                                  .filter(a => a.status === 'yes')
                                  .map(a => a.name)
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
                                  .filter(a => a.status === 'maybe')
                                  .map(a => a.name)
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
                                  .filter(a => a.status === 'no')
                                  .map(a => a.name)
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

              {/* 📊 Enquetes da Família */}
              <div className="mb-12 -mx-4 md:-mx-8">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-2">
                        <span className="text-sm">📊</span>
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Enquetes da família</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-gray-900">
                        Combinações rápidas pro Natal
                      </h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        Decidam juntos horário da ceia, sobremesas, brincadeiras e outros detalhes.
                      </p>
                    </div>
                  </div>

                  {/* Criar enquete - apenas usuário logado no mural */}
                  {familyUser ? (
                    <div className="mb-5 space-y-3">
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pergunta da enquete
                          </label>
                          <input
                            type="text"
                            value={newPollQuestion}
                            onChange={(e) => setNewPollQuestion(e.target.value)}
                            placeholder="Ex: Que horas começamos a ceia?"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Opções (uma por linha)
                          </label>
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

                  {/* Lista de enquetes */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {familyPolls.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Ainda não há enquetes. Crie a primeira para combinar os detalhes do Natal! ✨
                      </p>
                    ) : (
                      familyPolls.map((poll) => {
                        const totalVotes = Object.values(poll.votes || {}).reduce((sum, v) => sum + Number(v || 0), 0);
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
                                        {count} voto{Number(count) === 1 ? '' : 's'}{totalVotes > 0 ? ` • ${percent}%` : ''}
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                        style={{ width: `${percent}%` }}
                                      ></div>
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
            </div>

            {participants.filter(p => !p.paid).length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-yellow-600" size={20} />
                  <span className="font-bold text-yellow-800">Pendentes: </span>
                  <span className="text-yellow-700">
                    {participants.filter(p => !p.paid).map(p => p.name).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTES - Só admin */}
        {isAdmin && activeTab === 'participants' && !loading && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Participantes</h2>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-lg hover:from-green-700 hover:to-green-800 flex items-center gap-2 shadow-md hover:shadow-lg transition-all text-sm md:text-base"
              >
                <Plus size={18} /> Adicionar
              </button>
            </div>

            {showAddParticipant && (
              <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-green-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
                    placeholder="Nome do participante"
                    className="flex-1 px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <button 
                    onClick={addParticipant} 
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </button>
                  <button onClick={() => setShowAddParticipant(false)} className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 px-6 py-3 rounded-lg hover:from-gray-400 hover:to-gray-500 font-semibold transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map(p => (
                <div key={p.id} className={`bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-l-4 hover:shadow-xl transition-all ${p.paid ? 'border-green-600' : 'border-red-600'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
                      <p className="text-sm text-gray-600">R$ {formatCurrency(CONTRIBUTION)}</p>
                    </div>
                    <button onClick={() => removeParticipant(p.id)} className="text-red-500">
                      <X size={20} />
                    </button>
                  </div>
                  <button
                    onClick={() => togglePayment(p.id, p.paid)}
                    className={`mt-4 px-4 py-2.5 rounded-lg font-semibold w-full transition-all ${
                      p.paid ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {p.paid ? <Check className="inline" size={18} /> : <X className="inline" size={18} />}
                    {' '}{p.paid ? 'Pago' : 'Pendente'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMPRAS - Só admin */}
        {isAdmin && activeTab === 'purchases' && !loading && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Compras</h2>
              <button
                onClick={() => setShowAddPurchase(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 shadow-md hover:shadow-lg transition-all text-sm md:text-base"
              >
                <Plus size={18} /> Nova Compra
              </button>
            </div>

            {showAddPurchase && (
              <div className="bg-white/90 backdrop-blur-lg p-4 md:p-6 rounded-xl shadow-lg border-2 border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <input
                    type="text"
                    value={newPurchase.description}
                    onChange={(e) => setNewPurchase({...newPurchase, description: e.target.value})}
                    placeholder="Descrição *"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newPurchase.value}
                    onChange={(e) => setNewPurchase({...newPurchase, value: e.target.value})}
                    placeholder="Valor *"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <select
                    value={newPurchase.category}
                    onChange={(e) => setNewPurchase({...newPurchase, category: e.target.value})}
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
                  >
                    <option>Decoração</option>
                    <option>Alimentos</option>
                    <option>Bebidas</option>
                    <option>Presentes</option>
                    <option>Outros</option>
                  </select>
                  <input
                    type="text"
                    value={newPurchase.brand}
                    onChange={(e) => setNewPurchase({...newPurchase, brand: e.target.value})}
                    placeholder="Marca"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <input
                    type="text"
                    value={newPurchase.color}
                    onChange={(e) => setNewPurchase({...newPurchase, color: e.target.value})}
                    placeholder="Cor"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <input
                    type="text"
                    value={newPurchase.size}
                    onChange={(e) => setNewPurchase({...newPurchase, size: e.target.value})}
                    placeholder="Tamanho"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <input
                    type="number"
                    value={newPurchase.quantity}
                    onChange={(e) => setNewPurchase({...newPurchase, quantity: parseInt(e.target.value)})}
                    placeholder="Quantidade"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
                  />
                  <textarea
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase({...newPurchase, notes: e.target.value})}
                    placeholder="Observações"
                    className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all col-span-2 resize-none placeholder:text-gray-600 placeholder:font-medium"
                    rows={3}
                  />
                  
                  {/* Upload de Múltiplas Fotos */}
                  <div className="col-span-2">
                    <label className="block text-lg font-bold text-gray-800 mb-2">📸 Fotos do Produto (Opcional - Múltiplas)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="w-full px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {imagePreviews.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg border-2 border-blue-200 shadow-md" />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              type="button"
                            >
                              ×
                            </button>
                            {index === 0 && (
                              <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">Principal</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={addPurchaseWithImage} 
                    disabled={uploadingImage || isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting || uploadingImage ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {uploadingImage ? 'Enviando fotos...' : 'Salvando...'}
                      </>
                    ) : (
                      'Salvar Compra'
                    )}
                  </button>
                  <button onClick={() => setShowAddPurchase(false)} className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 px-6 py-3 rounded-lg hover:from-gray-400 hover:to-gray-500 font-semibold transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {purchases.map(p => (
                <div key={p.id} className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all border-l-4 border-red-500">
                  {/* Foto do Produto */}
                  {p.image_url && (
                    <div className="mb-4">
                      <img 
                        src={p.image_url} 
                        alt={p.description} 
                        className="w-full h-64 object-cover rounded-lg border-4 border-red-200 shadow-lg"
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900">{p.description}</h3>
                      <span className="inline-block mt-2 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold rounded-full shadow-md">{p.category}</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                        {p.brand && <div className="bg-white px-3 py-2 rounded-lg border border-gray-200"><span className="font-bold text-gray-700">Marca:</span> <span className="text-gray-900">{p.brand}</span></div>}
                        {p.color && <div className="bg-white px-3 py-2 rounded-lg border border-gray-200"><span className="font-bold text-gray-700">Cor:</span> <span className="text-gray-900">{p.color}</span></div>}
                        {p.size && <div className="bg-white px-3 py-2 rounded-lg border border-gray-200"><span className="font-bold text-gray-700">Tamanho:</span> <span className="text-gray-900">{p.size}</span></div>}
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-200"><span className="font-bold text-gray-700">Qtd:</span> <span className="text-gray-900">{p.quantity}</span></div>
                      </div>
                      {p.notes && <p className="mt-4 text-sm text-gray-800 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400 font-medium"><span className="font-bold text-yellow-700">📝 Obs:</span> {p.notes}</p>}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-4xl font-black text-red-600 bg-red-50 px-4 py-2 rounded-lg border-2 border-red-200">R$ {formatCurrency(p.value)}</div>
                      {isAdmin && (
                        <button onClick={() => removePurchase(p.id)} className="text-red-500 hover:text-red-700 mt-2 transition-colors">
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🎅 AMIGO OCULTO - Só admin */}
        {isAdmin && activeTab === 'secret-santa' && !loading && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">🎅 Amigo Oculto</h2>
            
            {/* Status do Sorteio */}
            {secretSantaConfig ? (
              <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-green-300">
                <h3 className="text-2xl font-bold text-green-600 mb-4 flex items-center gap-2">
                  ✅ Sorteio Ativo
                </h3>
                <div className="space-y-2 text-gray-700">
                  <p><span className="font-bold">Data do sorteio:</span> {new Date(secretSantaConfig.draw_date).toLocaleDateString('pt-BR')}</p>
                  {secretSantaConfig.min_gift_value && (
                    <p><span className="font-bold">Valor do presente:</span> R$ {secretSantaConfig.min_gift_value} - R$ {secretSantaConfig.max_gift_value}</p>
                  )}
                </div>
                <button
                  onClick={cancelDraw}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                >
                  Cancelar Sorteio
                </button>
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-blue-200">
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Configurar Sorteio</h3>
                
                {/* Valor do Presente */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">Valor Mínimo (R$)</label>
                    <input
                      type="number"
                      value={minGiftValue}
                      onChange={(e) => setMinGiftValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">Valor Máximo (R$)</label>
                    <input
                      type="number"
                      value={maxGiftValue}
                      onChange={(e) => setMaxGiftValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                
                {/* Regras */}
                <div className="mb-4">
                  <h4 className="font-bold mb-2 text-gray-800">Regras (quem NÃO pode tirar quem)</h4>
                  <p className="text-sm text-gray-600 mb-3">Ex: casais, irmãos, pessoas que moram juntas</p>
                  
                  {drawRules.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {drawRules.map((rule, idx) => {
                        const p1 = participants.find(p => p.id === rule.participant1_id);
                        const p2 = participants.find(p => p.id === rule.participant2_id);
                        return (
                          <div key={idx} className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
                            <span className="font-medium text-gray-800">{p1?.name} ↔ {p2?.name}</span>
                            <button
                              onClick={() => removeDrawRule(idx)}
                              className="text-red-500 hover:text-red-700 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Adicionar Regra */}
                  <div className="flex gap-2">
                    <select
                      value={selectedP1}
                      onChange={(e) => setSelectedP1(Number(e.target.value))}
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    >
                      <option value={0}>Pessoa 1</option>
                      {participants.filter(p => p.paid).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedP2}
                      onChange={(e) => setSelectedP2(Number(e.target.value))}
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    >
                      <option value={0}>Pessoa 2</option>
                      {participants.filter(p => p.paid).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={addDrawRule}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-bold"
                    >
                      + Regra
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={performDraw}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sorteando...
                    </>
                  ) : (
                    <>🎲 Fazer Sorteio</>
                  )}
                </button>
                
                <p className="text-sm text-gray-600 mt-3 text-center">
                  Apenas participantes que pagaram entrarão no sorteio ({participants.filter(p => p.paid).length} pessoas)
                </p>
              </div>
            )}
            
            {/* Tokens para Distribuir */}
            {allDraws.length > 0 && (
              <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-purple-200">
                <h3 className="text-2xl font-bold mb-4 text-gray-800">🎫 Tokens para Distribuir</h3>
                <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg mb-4 border-l-4 border-blue-400">
                  💡 <span className="font-bold">Como funciona:</span> Entregue cada token para a pessoa correspondente. Elas usarão o token para revelar seu amigo oculto na aba pública.
                </p>
                <div className="space-y-3">
                  {allDraws.map((draw, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800 text-lg">{draw.giver_name}</span>
                        {draw.revealed && <span className="text-green-500 text-sm font-bold bg-green-100 px-2 py-1 rounded">✓ Revelado</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white p-3 rounded-lg border-2 border-purple-300 font-mono text-2xl font-bold text-purple-600 text-center tracking-wider">
                          {draw.token}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(draw.token);
                            setToast({ message: `Token ${draw.token} copiado!`, type: 'success' });
                          }}
                          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all font-bold"
                        >
                          📋 Copiar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gerenciar Listas de Desejos */}
            <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-pink-200">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">📝 Gerenciar Listas de Desejos</h3>
              <p className="text-sm text-pink-700 bg-pink-50 p-3 rounded-lg mb-4 border-l-4 border-pink-400">
                💡 <span className="font-bold">Cadastre as sugestões de presente</span> para cada participante. Quando alguém revelar o token, verá automaticamente a lista da pessoa que tirou!
              </p>

              {/* Selecionar Participante */}
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2 text-gray-700">Selecione o Participante:</label>
                <select
                  value={selectedParticipantForWishList}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedParticipantForWishList(id);
                    if (id > 0) fetchAdminWishList(id);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none text-lg font-semibold"
                >
                  <option value={0}>-- Escolha um participante --</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Formulário de Adicionar Item */}
              {selectedParticipantForWishList > 0 && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-lg border-2 border-pink-300">
                    <h4 className="font-bold text-gray-800 mb-3">Adicionar Sugestão de Presente</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newWishItem.item_name}
                        onChange={(e) => setNewWishItem({...newWishItem, item_name: e.target.value})}
                        placeholder="Nome do item *"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none text-lg font-semibold"
                      />
                      <textarea
                        value={newWishItem.item_description}
                        onChange={(e) => setNewWishItem({...newWishItem, item_description: e.target.value})}
                        placeholder="Descrição (opcional)"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none resize-none"
                        rows={2}
                      />
                      <input
                        type="url"
                        value={newWishItem.item_url}
                        onChange={(e) => setNewWishItem({...newWishItem, item_url: e.target.value})}
                        placeholder="Link do produto (opcional)"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none"
                      />
                      <select
                        value={newWishItem.priority}
                        onChange={(e) => setNewWishItem({...newWishItem, priority: Number(e.target.value)})}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none text-lg font-semibold"
                      >
                        <option value={1}>⭐ Prioridade Baixa</option>
                        <option value={2}>⭐⭐ Prioridade Média</option>
                        <option value={3}>⭐⭐⭐ Prioridade Alta</option>
                      </select>
                      <button
                        onClick={addAdminWishItem}
                        disabled={isSubmitting}
                        className="w-full px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Adicionando...' : '+ Adicionar Item'}
                      </button>
                    </div>
                  </div>

                  {/* Lista de Itens do Participante */}
                  {adminWishList.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border-2 border-pink-200">
                      <h4 className="font-bold text-gray-800 mb-3">
                        Lista de {participants.find(p => p.id === selectedParticipantForWishList)?.name}:
                      </h4>
                      <div className="space-y-2">
                        {adminWishList.map((item) => (
                          <div key={item.id} className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-lg border border-pink-200 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-bold text-gray-800">{item.item_name}</h5>
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                  item.priority === 3 ? 'bg-red-100 text-red-700' :
                                  item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.priority === 3 ? '⭐⭐⭐' : item.priority === 2 ? '⭐⭐' : '⭐'}
                                </span>
                              </div>
                              {item.item_description && (
                                <p className="text-sm text-gray-600 mb-1">{item.item_description}</p>
                              )}
                              {item.item_url && (
                                <a 
                                  href={item.item_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                  🔗 Ver produto
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => deleteAdminWishItem(item.id)}
                              className="ml-3 text-red-500 hover:text-red-700 font-bold text-xl"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TIMELINE NATALINA ÉPICA */}
        {(activeTab === 'timeline' || !isAdmin) && !loading && (
          <div className="relative py-12 overflow-hidden">
            
            {/* Montanhas Nevadas no Fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-64 opacity-20">
              <svg viewBox="0 0 1200 300" className="w-full h-full">
                <path d="M0,300 L0,200 L200,100 L400,180 L600,80 L800,160 L1000,100 L1200,180 L1200,300 Z" fill="white" opacity="0.3"/>
                <path d="M0,300 L0,240 L150,180 L350,220 L550,150 L750,200 L950,160 L1200,220 L1200,300 Z" fill="white" opacity="0.2"/>
              </svg>
            </div>
            
            {/* Trenó do Papai Noel Voando */}
            <div className="absolute top-20 left-0 w-full pointer-events-none z-0">
              <div className="relative" style={{animation: 'sleighFly 30s linear infinite'}}>
                <div className="text-8xl">🛷</div>
                <div className="absolute -left-20 top-2 text-6xl">🦌</div>
                <div className="absolute -left-32 top-4 text-5xl">🦌</div>
              </div>
            </div>
            
            {/* Estrelas de Fundo */}
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
                    animationDelay: `${Math.random() * 2}s`
                  }}
                >
                  ✨
                </div>
              ))}
            </div>
            
            {/* Lua Cheia */}
            <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-100 rounded-full opacity-40 shadow-2xl z-0">
              <div className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-200 to-transparent"></div>
            </div>
            
            {/* Casas com Neve no Fundo */}
            <div className="absolute bottom-0 left-10 z-0 opacity-20">
              <div className="text-6xl">🏠</div>
              <div className="absolute -top-2 left-0 text-4xl">❄️</div>
            </div>
            <div className="absolute bottom-0 right-20 z-0 opacity-20">
              <div className="text-7xl">🏘️</div>
            </div>
            
            {/* Árvores de Natal Decoradas */}
            <div className="absolute bottom-20 left-1/4 z-0 opacity-25 text-8xl animate-pulse" style={{animationDuration: '3s'}}>
              🎄
            </div>
            <div className="absolute bottom-32 right-1/3 z-0 opacity-25 text-7xl animate-pulse" style={{animationDuration: '4s'}}>
              🎄
            </div>
            
            <div className="max-w-6xl mx-auto px-6 relative z-10">

              {showTour && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6 border border-yellow-200">
                    {(() => {
                      const step = tourSteps.find(s => s.id === tourStep) || tourSteps[0];
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
                          <p className="text-xs md:text-sm text-gray-700 mb-4">
                            {step.body}
                          </p>
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
              {/* Header - Natal 2025 */}
              <div className="text-center mb-10 md:mb-12">
                <div className="inline-block bg-black/40 backdrop-blur-xl rounded-3xl px-6 md:px-10 py-5 md:py-7 border border-yellow-300/70 shadow-xl">
                  <h1 className="text-3xl md:text-4xl font-black text-white mb-2 md:mb-3 drop-shadow">
                    🎄 Natal em Família 2025
                  </h1>
                  <div className="text-base md:text-lg font-semibold text-yellow-200 mb-1">
                    25 de dezembro de 2025
                  </div>
                  <div className="text-sm md:text-base text-white/85">
                    {(() => {
                      const natal = new Date('2025-12-25');
                      const hoje = new Date();
                      const diff = Math.ceil((natal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
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
                    {/* Em Caixa */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border-2 border-green-300 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-2xl">
                          💵
                        </div>
                        <div>
                          <p className="text-sm font-bold text-green-700 uppercase">Em Caixa</p>
                          <p className="text-xs text-green-600">Arrecadado</p>
                        </div>
                      </div>
                      <div className="text-4xl font-black text-green-700">
                        R$ {formatCurrency(totalReceived)}
                      </div>
                    </div>
                    
                    {/* Já Gasto */}
                    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border-2 border-red-300 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-2xl">
                          🛒
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-700 uppercase">Já Gasto</p>
                          <p className="text-xs text-red-600">Em compras</p>
                        </div>
                      </div>
                      <div className="text-4xl font-black text-red-700">
                        R$ {formatCurrency(totalSpent)}
                      </div>
                    </div>
                    
                    {/* Saldo Disponível */}
                    <div className={`bg-gradient-to-br rounded-2xl p-6 border-2 shadow-lg ${
                      balance >= 0 
                        ? 'from-blue-50 to-blue-100 border-blue-300' 
                        : 'from-orange-50 to-orange-100 border-orange-300'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                          balance >= 0 ? 'bg-blue-500' : 'bg-orange-500'
                        }`}>
                          {balance >= 0 ? '✨' : '⚠️'}
                        </div>
                        <div>
                          <p className={`text-sm font-bold uppercase ${
                            balance >= 0 ? 'text-blue-700' : 'text-orange-700'
                          }`}>
                            {balance >= 0 ? 'Disponível' : 'Faltando'}
                          </p>
                          <p className={`text-xs ${
                            balance >= 0 ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {balance >= 0 ? 'Para gastar' : 'No orçamento'}
                          </p>
                        </div>
                      </div>
                      <div className={`text-4xl font-black ${
                        balance >= 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}>
                        R$ {formatCurrency(Math.abs(balance))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Barra de Progresso */}
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
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 📸 Álbum da Família (Timeline) */}
              <div className="mb-12 -mx-4 md:-mx-8">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                        <span className="text-sm">📸</span>
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Álbum da família</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-gray-900">
                        Fotos do Natal em Família
                      </h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        Todas as fotos postadas no mural aparecem aqui, em uma grade especial do Natal.
                      </p>
                    </div>
                  </div>

                  {familyPosts.some(p => p.image_url) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {familyPosts
                        .filter(p => p.image_url)
                        .map((post) => (
                          <div
                            key={post.id}
                            className="relative group rounded-xl overflow-hidden border border-white shadow-sm bg-gray-900/5"
                          >
                            <img
                              src={post.image_url as string}
                              alt={post.content || `Foto de ${post.user_name}`}
                              className="w-full h-28 md:h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-1 left-1 right-1 px-2 py-1 flex justify-between items-end text-[10px] text-white">
                              <span className="font-semibold truncate max-w-[70%]">
                                {post.user_name}
                              </span>
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

              {/* ✅ Presença no Natal (Timeline) */}
              <div className="mb-12 -mx-4 md:-mx-8">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-emerald-100/70">
                  {(() => {
                    const yesCount = familyAttendance.filter(a => a.status === 'yes').length;
                    const maybeCount = familyAttendance.filter(a => a.status === 'maybe').length;
                    const noCount = familyAttendance.filter(a => a.status === 'no').length;
                    const totalResponded = yesCount + maybeCount + noCount;
                    const myStatus = familyUser
                      ? familyAttendance.find(a => a.name === familyUser.name)?.status || null
                      : null;

                    return (
                      <>
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-2">
                              <span className="text-sm">✅</span>
                              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Presença no Natal</span>
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-900">
                              Quem vai estar na ceia?
                            </h2>
                            <p className="text-xs md:text-sm text-gray-600 mt-1">
                              Marque se você vai, talvez vá ou não vai. Isso ajuda a organizar comida, bebida e presentes.
                            </p>
                          </div>
                          {totalResponded > 0 && (
                            <div className="hidden md:flex flex-col items-end text-xs text-gray-600">
                              <span className="font-semibold text-emerald-700">{yesCount} confirmad{yesCount === 1 ? 'o' : 'os'}</span>
                              {maybeCount > 0 && (
                                <span className="text-amber-600">{maybeCount} talvez</span>
                              )}
                              {noCount > 0 && (
                                <span className="text-gray-500">{noCount} não vão</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botões do meu RSVP */}
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

                        {/* Resumo de presença */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs md:text-sm">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col">
                            <span className="text-[11px] font-semibold text-emerald-700 uppercase mb-1">Confirmados ✅</span>
                            {yesCount === 0 ? (
                              <span className="text-gray-500">Ninguém confirmou ainda.</span>
                            ) : (
                              <span className="text-gray-800">
                                {familyAttendance
                                  .filter(a => a.status === 'yes')
                                  .map(a => a.name)
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
                                  .filter(a => a.status === 'maybe')
                                  .map(a => a.name)
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
                                  .filter(a => a.status === 'no')
                                  .map(a => a.name)
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

              {/* 📊 Enquetes da Família (Timeline) */}
              <div className="mb-12 -mx-4 md:-mx-8">
                <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-5 md:p-7 shadow-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-2">
                        <span className="text-sm">📊</span>
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Enquetes da família</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-gray-900">
                        Combinações rápidas pro Natal
                      </h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        Decidam juntos horário da ceia, sobremesas, brincadeiras e outros detalhes.
                      </p>
                    </div>
                  </div>

                  {/* Criar enquete - apenas usuário logado no mural */}
                  {familyUser ? (
                    <div className="mb-5 space-y-3">
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Pergunta da enquete
                          </label>
                          <input
                            type="text"
                            value={newPollQuestion}
                            onChange={(e) => setNewPollQuestion(e.target.value)}
                            placeholder="Ex: Que horas começamos a ceia?"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Opções (uma por linha)
                          </label>
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

                  {/* Lista de enquetes */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {familyPolls.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Ainda não há enquetes. Crie a primeira para combinar os detalhes do Natal! ✨
                      </p>
                    ) : (
                      familyPolls.map((poll) => {
                        const totalVotes = Object.values(poll.votes || {}).reduce((sum, v) => sum + Number(v || 0), 0);
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
                                        {count} voto{Number(count) === 1 ? '' : 's'}{totalVotes > 0 ? ` • ${percent}%` : ''}
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                        style={{ width: `${percent}%` }}
                                      ></div>
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

              {/* 👨‍👩‍👧‍👦 Mural da Família */}
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

                  {/* Autenticação / Cadastro */}
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

                  {/* Área de postagens */}
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

                      {/* Upload opcional de foto */}
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

                  {/* Lista de posts */}
                  <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {familyPosts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Ainda não há mensagens no mural. Seja o primeiro a escrever! 🎅
                      </p>
                    ) : (
                      familyPosts.map((post) => (
                        <div
                          key={post.id}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex gap-3"
                        >
                          <div className="mt-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                              {post.user_name?.charAt(0)?.toUpperCase() || 'F'}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {post.user_name}
                                </p>
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
                              <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full">
                                Mural de Natal
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">
                              {post.content}
                            </p>

                            {/* Reações */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {reactionOptions.map((emoji) => {
                                const count = post.reactions?.[emoji] || 0;
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(post.id, emoji)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold transition-all hover:bg-green-50 hover:border-green-300 ${
                                      count > 0 ? 'border-green-400 text-green-700' : 'border-gray-200 text-gray-500'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{count}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Comentários */}
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
                                        <p className="text-[11px] text-gray-700 whitespace-pre-line">{comment.content}</p>
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
                                    setFamilyCommentDrafts(prev => ({
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
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline em Árvore de Natal */}
              <div className="relative">
                {/* ⭐ Estrela no topo da árvore (refinada) */}
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

                {/* 🎄 FORMATO DE PINHEIRO (Camadas Triangulares) */}
                <div className="absolute left-1/2 -translate-x-1/2 top-20 md:top-32 pointer-events-none hidden md:block">
                  {/* Camada 1 - Topo (menor) */}
                  <div className="relative mb-[-30px]">
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: '80px solid transparent',
                      borderRight: '80px solid transparent',
                      borderBottom: '100px solid rgba(34, 197, 94, 0.3)',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                    }}></div>
                  </div>
                  
                  {/* Camada 2 */}
                  <div className="relative mb-[-30px]">
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: '120px solid transparent',
                      borderRight: '120px solid transparent',
                      borderBottom: '120px solid rgba(34, 197, 94, 0.35)',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                    }}></div>
                  </div>
                  
                  {/* Camada 3 */}
                  <div className="relative mb-[-30px]">
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: '160px solid transparent',
                      borderRight: '160px solid transparent',
                      borderBottom: '140px solid rgba(34, 197, 94, 0.4)',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                    }}></div>
                  </div>
                  
                  {/* Camada 4 */}
                  <div className="relative mb-[-30px]">
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: '200px solid transparent',
                      borderRight: '200px solid transparent',
                      borderBottom: '160px solid rgba(34, 197, 94, 0.45)',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                    }}></div>
                  </div>
                  
                  {/* Camada 5 - Base (maior) */}
                  <div className="relative">
                    <div className="w-0 h-0 mx-auto" style={{
                      borderLeft: '240px solid transparent',
                      borderRight: '240px solid transparent',
                      borderBottom: '180px solid rgba(34, 197, 94, 0.5)',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                    }}></div>
                  </div>
                </div>

                {/* TRONCO DA ÁRVORE (Linha Central Marrom) - Oculto em mobile */}
                <div className="hidden md:block absolute left-1/2 top-32 bottom-20 w-4 bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 -translate-x-1/2 shadow-2xl z-10" style={{borderRadius: '4px'}}></div>
                
                {/* BASE DO TRONCO (mais larga) - Oculto em mobile */}
                <div className="hidden md:block absolute left-1/2 bottom-12 w-16 h-8 bg-amber-950 -translate-x-1/2 shadow-2xl rounded-b-lg z-10"></div>
              
                {timeline.map((item, i) => {
                  const isLeft = i % 2 === 0;
                  const natal = new Date('2025-12-25');
                  const itemDate = new Date(item.date);
                  const diasParaNatal = Math.ceil((natal.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                <div 
                  key={i} 
                  className={`relative mb-8 md:mb-16 ${isLeft ? 'md:pr-1/2' : 'md:pl-1/2'}`}
                  style={{
                    animation: 'fadeIn 0.6s ease-out forwards',
                    animationDelay: `${i * 0.1}s`,
                    opacity: 0
                  }}
                >
                  {/* 📱 MOBILE: Linha vertical do tempo */}
                  <div className="md:hidden absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 via-red-500 to-green-500 rounded-full shadow-lg"></div>
                  
                  {/* 📱 MOBILE: Ícone circular na linha do tempo */}
                  <div className={`md:hidden absolute left-0 top-4 w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-xl z-10 animate-pulse ${
                    item.type === 'payment' 
                      ? 'bg-gradient-to-br from-green-400 to-green-600' 
                      : 'bg-gradient-to-br from-red-400 to-red-600'
                  }`} style={{animationDuration: '3s'}}>
                    {item.type === 'payment' ? '💰' : '🎁'}
                  </div>
                  
                  {/* 📱 MOBILE: Linha conectora do ícone ao card */}
                  <div className={`md:hidden absolute left-10 top-8 w-4 h-0.5 ${
                    item.type === 'payment' ? 'bg-green-400' : 'bg-red-400'
                  } opacity-50`}></div>
                  {/* 🎄 ENFEITE NA ÁRVORE (Bolinha de Natal) - Oculto em mobile */}
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
                      boxShadow: '0 0 20px rgba(255, 215, 0, 0.6), inset 0 2px 10px rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    {/* Brilho no enfeite */}
                    <div className="absolute top-1 left-2 w-3 h-3 bg-white/80 rounded-full blur-sm"></div>
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{animationDuration: '3s'}}></div>
                  </div>
                  
                  {/* Linha Conectando (Galho/Fio do Enfeite) - Oculto em mobile */}
                  <div 
                    className={`hidden md:block absolute top-10 h-1 bg-gradient-to-r ${
                      isLeft 
                        ? 'from-amber-700 to-transparent right-1/2' 
                        : 'from-transparent to-amber-700 left-1/2'
                    }`}
                    style={{
                      width: 'calc(50% - 80px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  ></div>
                  
                  {/* Card do Evento */}
                  <div className={`${isLeft ? 'md:mr-auto md:pr-12' : 'md:ml-auto md:pl-12'} ml-14 md:ml-0 mr-4 md:mr-0 max-w-[calc(100%-4rem)] md:max-w-md relative z-20`}>
                    <div className="bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border-2 border-white/60 transform transition-all duration-300 hover:scale-[1.02] md:hover:scale-105 hover:shadow-3xl w-full">
                      
                      {/* Badge de Dias para o Natal */}
                      <div className="bg-gradient-to-r from-red-600 via-red-500 to-green-600 px-3 md:px-6 py-2.5 md:py-3 text-white text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                        <div className="relative z-10">
                          <div className="text-xs md:text-sm font-bold flex items-center justify-center gap-1">
                            <span>🎄</span>
                            <span>{diasParaNatal > 0 ? `${diasParaNatal} dias antes` : diasParaNatal === 0 ? 'NATAL!' : `${Math.abs(diasParaNatal)} dias depois`}</span>
                          </div>
                          <div className="text-xs opacity-90 mt-0.5 md:mt-1 font-medium">
                            {new Date(item.date).toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Carousel de Imagens do Produto */}
                      {item.type === 'purchase' && (item.image_url || item.image_urls) && (
                        <ImageCarousel 
                          images={
                            item.image_urls 
                              ? (typeof item.image_urls === 'string' ? JSON.parse(item.image_urls) : item.image_urls)
                              : [item.image_url]
                          }
                          description={item.description}
                        />
                      )}
                      
                      {/* Conteúdo */}
                      <div className="p-4 md:p-6">
                        <div className="flex items-center justify-between mb-3 md:mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-lg ${
                              item.type === 'payment'
                                ? 'bg-gradient-to-br from-green-100 to-green-200'
                                : 'bg-gradient-to-br from-red-100 to-red-200'
                            }`}>
                              {item.type === 'payment' ? '💰' : '🎁'}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              item.type === 'payment'
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}>
                              {item.type === 'payment' ? 'Pagamento' : 'Compra'}
                            </span>
                          </div>
                        </div>
                        
                        <h3 className="text-lg md:text-xl font-black text-gray-900 mb-2 md:mb-3 leading-tight">
                          {item.description}
                        </h3>
                        
                        <div className={`inline-flex items-baseline gap-1 px-4 py-2 rounded-xl font-black mb-3 md:mb-4 ${
                          item.type === 'payment' 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          <span className="text-xl md:text-2xl">{item.type === 'payment' ? '+' : '-'}</span>
                          <span className="text-2xl md:text-3xl">R$</span>
                          <span className="text-2xl md:text-3xl">{formatCurrency(item.value)}</span>
                        </div>
                        
                        {/* Detalhes */}
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
              
              {/* 🎁 PRESENTES EMBAIXO DA ÁRVORE */}
              <div className="text-center mt-24 mb-8 relative z-10">
                <div className="flex justify-center items-end gap-4 mb-6">
                  <div className="text-7xl animate-bounce" style={{animationDelay: '0s', animationDuration: '2s'}}>🎁</div>
                  <div className="text-9xl animate-bounce" style={{animationDelay: '0.2s', animationDuration: '2.2s'}}>🎁</div>
                  <div className="text-7xl animate-bounce" style={{animationDelay: '0.4s', animationDuration: '2.4s'}}>🎁</div>
                </div>
                <div className="inline-block bg-white/10 backdrop-blur-lg rounded-3xl px-12 py-6 border-4 border-yellow-400 shadow-2xl">
                  <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2">
                    Feliz Natal! 🎄
                  </h2>
                  <p className="text-xl text-yellow-300 font-bold">
                    Que esta árvore traga muitas alegrias! ✨
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
