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

  const CONTRIBUTION = 50;

  // Verificar se está logado ao carregar
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken === 'admin-authenticated') {
      setIsAdmin(true);
      setActiveTab('dashboard');
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

  // Função helper para formatar valores de forma segura - ATUALIZADO
  const formatCurrency = (value: any): string => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
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
    if (!newParticipant.trim()) return;
    
    await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newParticipant })
    });
    
    setNewParticipant('');
    setShowAddParticipant(false);
    loadData();
  };

  // Toggle pagamento
  const togglePayment = async (id: number, paid: boolean) => {
    await fetch(`/api/participants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: !paid })
    });
    loadData();
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
    if (!newPurchase.description || !newPurchase.value) return;
    
    // Upload das imagens se houver
    let imageUrls: string[] = [];
    if (selectedImages.length > 0) {
      imageUrls = await uploadImages();
    }
    
    // Usar a primeira imagem como principal (compatibilidade) e salvar todas
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : '';
    
    await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...newPurchase, 
        image_url: imageUrl,
        image_urls: JSON.stringify(imageUrls) // Salvar array como JSON string
      })
    });
    
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
  };

  // Remover compra
  const removePurchase = async (id: number) => {
    await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    loadData();
  };

  // Cálculos
  const totalExpected = participants.length * CONTRIBUTION;
  const totalReceived = participants.filter(p => p.paid).length * CONTRIBUTION;
  const totalSpent = purchases.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  const balance = totalReceived - totalSpent;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-purple-900 relative">
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
      
      {/* Header NATALINO ÉPICO */}
      <header className="bg-gradient-to-r from-red-700 via-green-700 to-red-700 border-b-4 border-yellow-400 sticky top-0 z-50 backdrop-blur-lg relative shadow-2xl">
        {/* Luzes de Natal Piscando */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-80" style={{animation: 'christmasLights 2s linear infinite'}}></div>
        
        {/* Neve no Header */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 text-white/20 text-6xl">❄️</div>
          <div className="absolute top-0 right-0 text-white/20 text-6xl">❄️</div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl relative animate-pulse" style={{animationDuration: '2s'}}>
                <span className="text-3xl md:text-5xl">🎅</span>
                <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 text-xl md:text-2xl animate-bounce">⭐</div>
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-black text-white flex items-center gap-2 md:gap-3 drop-shadow-lg">
                  <span className="animate-bounce" style={{animationDelay: '0s'}}>🎄</span>
                  <span className="hidden sm:inline">Natal em Família 2025</span>
                  <span className="sm:hidden">Natal 2025</span>
                  <span className="animate-bounce" style={{animationDelay: '0.2s'}}>🎁</span>
                </h1>
                <p className="text-sm md:text-lg text-yellow-200 font-bold mt-1">
                  {isAdmin ? '👑 Painel do Papai Noel' : '✨ Timeline Mágica do Natal'}
                </p>
              </div>
            </div>
            <div>
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
        <nav className="bg-gradient-to-r from-green-50 via-red-50 to-green-50 border-b-2 border-red-300 shadow-md overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex gap-1 md:gap-2 min-w-max md:min-w-0">
              {[
                { id: 'dashboard', label: '🎁 Visão Geral', shortLabel: '🎁 Visão', icon: DollarSign },
                { id: 'participants', label: '👨‍👩‍👧‍👦 Família', shortLabel: '👨‍👩‍👧‍👦', icon: Users },
                { id: 'purchases', label: '🛒 Compras', shortLabel: '🛒', icon: ShoppingCart },
                { id: 'timeline', label: '🎄 Timeline', shortLabel: '🎄', icon: Clock }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 md:gap-2 px-3 md:px-6 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-white bg-gradient-to-r from-red-600 to-green-600 shadow-lg transform scale-105'
                      : 'text-gray-700 hover:bg-white/50'
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
                  <button onClick={addParticipant} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl font-semibold transition-all transform hover:scale-105">
                    Salvar
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
                    disabled={uploadingImage}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                    Salvar Compra
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
              {/* Header - Natal 2025 */}
              <div className="text-center mb-12">
                <div className="inline-block bg-white/10 backdrop-blur-lg rounded-3xl px-12 py-8 border-4 border-yellow-400 shadow-2xl">
                  <h1 className="text-6xl font-black text-white mb-4 drop-shadow-lg">
                    🎄 NATAL 2025 🎄
                  </h1>
                  <div className="text-3xl font-bold text-yellow-300 mb-2">
                    25 de Dezembro de 2025
                  </div>
                  <div className="text-xl text-white/90">
                    {(() => {
                      const natal = new Date('2025-12-25');
                      const hoje = new Date();
                      const diff = Math.ceil((natal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      return diff > 0 ? `🎅 Faltam ${diff} dias para o Natal!` : '🎉 Feliz Natal!';
                    })()}
                  </div>
                </div>
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
              
              {/* Timeline em Árvore de Natal */}
              <div className="relative">
                {/* ⭐ ESTRELA NO TOPO DA ÁRVORE */}
                <div className="flex justify-center mb-8 md:mb-12">
                  <div className="relative">
                    <div className="text-6xl md:text-9xl animate-pulse" style={{animationDuration: '2s', filter: 'drop-shadow(0 0 20px gold)'}}>
                      ⭐
                    </div>
                    <div className="absolute inset-0 text-6xl md:text-9xl animate-ping opacity-50" style={{animationDuration: '3s'}}>
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
