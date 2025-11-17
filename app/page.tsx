'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Users, ShoppingCart, Clock, Plus, X, Check, AlertCircle } from 'lucide-react';
import { AdminDashboardSection } from './components/AdminDashboardSection';
import { AdminParticipantsSection } from './components/AdminParticipantsSection';
import { AdminPurchasesSection } from './components/AdminPurchasesSection';
import { SecretSantaRevealSection } from './components/SecretSantaRevealSection';
import { SecretSantaAdminSection } from './components/SecretSantaAdminSection';
import { TimelineSection } from './components/TimelineSection';
import { Toast } from './components/Toast';
import { useAdminAuth } from './hooks/useAdminAuth';
import type {
  Participant,
  Purchase,
  DrawRule,
  SecretSantaConfig,
  SecretSantaDraw,
  WishListItem,
  FamilyUser,
  FamilyPost,
  FamilyComment,
  FamilyPoll,
  FamilyAttendance,
} from './types';

export default function ChristmasOrganizer() {
  const {
    isAdmin,
    showLogin,
    password,
    loginError,
    activeTab,
    setShowLogin,
    setPassword,
    setLoginError,
    setActiveTab,
    handleLogin,
    handleLogout,
  } = useAdminAuth();
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
      body: 'Depois de logado no mural, você pode escrever mensagens para a família e, se quiser, anexar uma foto. Ex: "Feliz Natal, família!" Essas fotos vão para o Álbum da Família.'
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

  const [pinnedPostId, setPinnedPostId] = useState<number | null>(null);
  const [likedComments, setLikedComments] = useState<Record<number, boolean>>({});

  // Verificar dados salvos no carregamento (mural, post fixado, curtidas, efeitos visuais)
  useEffect(() => {
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

    // Carregar post fixado e curtidas de comentários do localStorage
    try {
      const storedPinned = localStorage.getItem('pinnedPostId');
      if (storedPinned) {
        const id = Number(storedPinned);
        if (!isNaN(id)) {
          setPinnedPostId(id);
        }
      }

      const storedLiked = localStorage.getItem('likedComments');
      if (storedLiked) {
        const parsedLikes = JSON.parse(storedLiked);
        if (parsedLikes && typeof parsedLikes === 'object') {
          setLikedComments(parsedLikes);
        }
      }
    } catch {
      // Se der erro ao ler, simplesmente ignora e segue
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

  const handleTogglePinPost = (postId: number) => {
    if (!isAdmin) return;
    setPinnedPostId(prev => {
      const next = prev === postId ? null : postId;
      try {
        if (typeof window !== 'undefined') {
          if (next) {
            localStorage.setItem('pinnedPostId', String(next));
          } else {
            localStorage.removeItem('pinnedPostId');
          }
        }
      } catch {
        // se não conseguir salvar, segue só em memória
      }
      return next;
    });
  };

  const handleToggleCommentLike = (commentId: number) => {
    if (!familyUser) {
      setToast({ message: 'Faça login para curtir comentários', type: 'error' });
      return;
    }

    // Toggle otimista + persistência em localStorage
    setLikedComments(prev => {
      const next = { ...prev, [commentId]: !prev[commentId] };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('likedComments', JSON.stringify(next));
        }
      } catch {
        // se falhar o localStorage, tudo bem, mantém só na sessão
      }
      return next;
    });

    // Chama API para registrar like e notificação para o dono do comentário
    (async () => {
      try {
        await fetch('/api/family-comment-likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment_id: commentId,
            user_id: familyUser.id,
          }),
        });
      } catch (error) {
        // Em caso de erro, mantemos o estado visual; notificação é best effort
        console.error('Erro ao registrar like de comentário:', error);
      }
    })();
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
      if (activeTab === 'timeline' || activeTab === 'dashboard') {
        if (activeTab === 'timeline') {
          const res = await fetch('/api/timeline');
          if (res.ok) {
            const data = await res.json();
            setTimeline(Array.isArray(data) ? data : []);
          } else {
            console.error('Erro ao carregar timeline:', res.status);
            setTimeline([]);
          }
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
                  onClick={() => setActiveTab(tab.id as any)}
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
        <SecretSantaRevealSection
          isAdmin={isAdmin}
          showRevealSection={showRevealSection}
          revealedDraw={revealedDraw}
          revealToken={revealToken}
          setRevealToken={setRevealToken}
          isSubmitting={isSubmitting}
          revealByToken={revealByToken}
          secretSantaConfig={secretSantaConfig}
          receiverWishList={receiverWishList}
          togglePurchased={togglePurchased}
          onResetReveal={() => {
            setRevealedDraw(null);
            setRevealToken('');
            setReceiverWishList([]);
            setMyWishList([]);
            setShowMyWishList(false);
          }}
          onCloseReveal={() => setShowRevealSection(false)}
        />

        {/* DASHBOARD NATALINO */}
        {isAdmin && activeTab === 'dashboard' && !loading && (
          <AdminDashboardSection
            totalExpected={totalExpected}
            totalReceived={totalReceived}
            totalSpent={totalSpent}
            balance={balance}
            formatCurrency={formatCurrency}
          />
        )}

        {isAdmin && activeTab === 'participants' && !loading && (
          <AdminParticipantsSection
            participants={participants}
            contribution={CONTRIBUTION}
            formatCurrency={formatCurrency}
            showAddParticipant={showAddParticipant}
            newParticipant={newParticipant}
            isSubmitting={isSubmitting}
            onOpenAddParticipant={() => setShowAddParticipant(true)}
            onCloseAddParticipant={() => setShowAddParticipant(false)}
            onChangeNewParticipant={(value) => setNewParticipant(value)}
            onSubmitNewParticipant={addParticipant}
            onTogglePayment={togglePayment}
            onRemoveParticipant={removeParticipant}
          />
        )}

        {/* COMPRAS - Só admin */}
        {isAdmin && activeTab === 'purchases' && !loading && (
          <AdminPurchasesSection
            isAdmin={isAdmin}
            purchases={purchases}
            formatCurrency={formatCurrency}
            showAddPurchase={showAddPurchase}
            setShowAddPurchase={setShowAddPurchase}
            newPurchase={newPurchase}
            setNewPurchase={setNewPurchase}
            imagePreviews={imagePreviews}
            handleImageSelect={handleImageSelect}
            removeImage={removeImage}
            uploadingImage={uploadingImage}
            isSubmitting={isSubmitting}
            addPurchaseWithImage={addPurchaseWithImage}
            removePurchase={removePurchase}
          />
        )}

        {/* 🎅 AMIGO OCULTO - Só admin */}
        {isAdmin && activeTab === 'secret-santa' && !loading && (
          <SecretSantaAdminSection
            secretSantaConfig={secretSantaConfig}
            minGiftValue={minGiftValue}
            maxGiftValue={maxGiftValue}
            setMinGiftValue={setMinGiftValue}
            setMaxGiftValue={setMaxGiftValue}
            drawRules={drawRules}
            selectedP1={selectedP1}
            selectedP2={selectedP2}
            setSelectedP1={setSelectedP1}
            setSelectedP2={setSelectedP2}
            participants={participants}
            isSubmitting={isSubmitting}
            cancelDraw={cancelDraw}
            addDrawRule={addDrawRule}
            removeDrawRule={removeDrawRule}
            performDraw={performDraw}
            allDraws={allDraws}
            onCopyToken={(token) => {
              navigator.clipboard.writeText(token);
              setToast({ message: `Token ${token} copiado!`, type: 'success' });
            }}
            selectedParticipantForWishList={selectedParticipantForWishList}
            setSelectedParticipantForWishList={setSelectedParticipantForWishList}
            fetchAdminWishList={fetchAdminWishList}
            newWishItem={newWishItem}
            setNewWishItem={setNewWishItem}
            adminWishList={adminWishList}
            addAdminWishItem={addAdminWishItem}
            removeAdminWishItem={deleteAdminWishItem}
          />
        )}

        {/* TIMELINE NATALINA ÉPICA */}
        {(activeTab === 'timeline' || !isAdmin) && !loading && (
          <TimelineSection
            stars={stars}
            showTour={showTour}
            setShowTour={setShowTour}
            tourStep={tourStep}
            setTourStep={setTourStep}
            tourSteps={tourSteps}
            totalReceived={totalReceived}
            totalSpent={totalSpent}
            balance={balance}
            formatCurrency={formatCurrency}
            familyPosts={familyPosts}
            familyAttendance={familyAttendance}
            familyUser={familyUser}
            handleSetAttendance={handleSetAttendance}
            newPollQuestion={newPollQuestion}
            setNewPollQuestion={setNewPollQuestion}
            newPollOptionsText={newPollOptionsText}
            setNewPollOptionsText={setNewPollOptionsText}
            familyPolls={familyPolls}
            handleCreatePoll={handleCreatePoll}
            handleVotePoll={handleVotePoll}
            handleFamilyLogout={handleFamilyLogout}
            familyAuthMode={familyAuthMode}
            setFamilyAuthMode={setFamilyAuthMode}
            setFamilyAuthError={setFamilyAuthError}
            familyAuthError={familyAuthError}
            familyName={familyName}
            setFamilyName={setFamilyName}
            familyUsername={familyUsername}
            setFamilyUsername={setFamilyUsername}
            familyPassword={familyPassword}
            setFamilyPassword={setFamilyPassword}
            handleFamilyAuth={handleFamilyAuth}
            familyLoading={familyLoading}
            familyPostContent={familyPostContent}
            setFamilyPostContent={setFamilyPostContent}
            handleFamilyImageSelect={handleFamilyImageSelect}
            familyImageFile={familyImageFile}
            handleCreateFamilyPost={handleCreateFamilyPost}
            familyPosting={familyPosting}
            familyUploadingImage={familyUploadingImage}
            familyImagePreview={familyImagePreview}
            pinnedPostId={pinnedPostId}
            isAdmin={isAdmin}
            handleTogglePinPost={handleTogglePinPost}
            reactionOptions={reactionOptions}
            handleToggleReaction={handleToggleReaction}
            handleToggleCommentLike={handleToggleCommentLike}
            likedComments={likedComments}
            familyCommentDrafts={familyCommentDrafts}
            setFamilyCommentDrafts={setFamilyCommentDrafts}
            handleCreateComment={handleCreateComment}
            timeline={timeline}
          />
        )}
      </div>
    </div>
  );
}
