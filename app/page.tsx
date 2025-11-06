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
  created_at: string;
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
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

  // Upload de imagem
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return null;
    
    setUploadingImage(true);
    try {
      console.log('📤 Enviando arquivo:', selectedImage.name, selectedImage.size, 'bytes');
      
      const formData = new FormData();
      formData.append('file', selectedImage);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        console.error('❌ Erro na resposta:', data);
        alert(`Erro no upload: ${data.error}\n${data.details || ''}`);
        return null;
      }
      
      console.log('✅ Upload bem-sucedido! URL:', data.url);
      return data.url;
    } catch (error) {
      console.error('❌ Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da imagem. Verifique o console.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const addPurchaseWithImage = async () => {
    if (!newPurchase.description || !newPurchase.value) return;
    
    // Upload da imagem se houver
    let imageUrl = '';
    if (selectedImage) {
      imageUrl = await uploadImage() || '';
    }
    
    await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPurchase, image_url: imageUrl })
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
    setSelectedImage(null);
    setImagePreview('');
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
    <div className="min-h-screen bg-gray-50 relative">
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
        
        <div className="max-w-7xl mx-auto px-6 py-6 relative z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl relative animate-pulse" style={{animationDuration: '2s'}}>
                <span className="text-5xl">🎅</span>
                <div className="absolute -top-2 -right-2 text-2xl animate-bounce">⭐</div>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3 drop-shadow-lg">
                  <span className="animate-bounce" style={{animationDelay: '0s'}}>🎄</span>
                  Natal em Família 2025
                  <span className="animate-bounce" style={{animationDelay: '0.2s'}}>🎁</span>
                </h1>
                <p className="text-lg text-yellow-200 font-bold mt-1">
                  {isAdmin ? '👑 Painel do Papai Noel' : '✨ Timeline Mágica do Natal'}
                </p>
              </div>
            </div>
            <div>
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 text-base font-bold text-red-700 bg-white hover:bg-yellow-100 rounded-xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-105 border-2 border-yellow-400"
                >
                  🚪 Sair
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-6 py-3 text-base font-bold text-white bg-yellow-500 hover:bg-yellow-400 rounded-xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-105 border-2 border-yellow-300 animate-pulse"
                  style={{animationDuration: '2s'}}
                >
                  🎅 Login do Papai Noel
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation NATALINA */}
      {isAdmin && (
        <nav className="bg-gradient-to-r from-green-50 via-red-50 to-green-50 border-b-2 border-red-300 shadow-md">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-2">
              {[
                { id: 'dashboard', label: '🎁 Visão Geral', icon: DollarSign },
                { id: 'participants', label: '👨‍👩‍👧‍👦 Família', icon: Users },
                { id: 'purchases', label: '🛒 Compras', icon: ShoppingCart },
                { id: 'timeline', label: '🎄 Timeline', icon: Clock }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-base font-bold transition-all relative rounded-t-xl ${
                    activeTab === tab.id
                      ? 'text-white bg-gradient-to-r from-red-600 to-green-600 shadow-lg transform scale-105'
                      : 'text-gray-700 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
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
              <div className="bg-white rounded-xl border border-gray-200 p-6 card-hover relative overflow-hidden">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎁</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Esperado</div>
                <div className="text-3xl font-bold text-gray-900">R$ {formatCurrency(totalExpected)}</div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6 card-hover relative overflow-hidden">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎄</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="text-green-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Arrecadado</div>
                <div className="text-3xl font-bold text-green-600">R$ {formatCurrency(totalReceived)}</div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6 card-hover relative overflow-hidden">
                <div className="absolute top-2 right-2 text-2xl opacity-20">🎅</div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="text-orange-600" size={24} />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-1">Gasto</div>
                <div className="text-3xl font-bold text-orange-600">R$ {formatCurrency(totalSpent)}</div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6 card-hover relative overflow-hidden">
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
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Participantes</h2>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2.5 rounded-lg hover:from-green-700 hover:to-green-800 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Plus size={20} /> Adicionar
              </button>
            </div>

            {showAddParticipant && (
              <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-lg border-2 border-green-200">
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
                <div key={p.id} className={`bg-white p-6 rounded-xl shadow-lg border-l-4 hover:shadow-xl transition-all ${p.paid ? 'border-green-600' : 'border-red-600'}`}>
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
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Compras</h2>
              <button
                onClick={() => setShowAddPurchase(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Plus size={20} /> Nova Compra
              </button>
            </div>

            {showAddPurchase && (
              <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl shadow-lg border-2 border-blue-200">
                <div className="grid grid-cols-2 gap-4">
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
                  
                  {/* Upload de Foto */}
                  <div className="col-span-2">
                    <label className="block text-lg font-bold text-gray-800 mb-2">📸 Foto do Produto (Opcional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="w-full px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {imagePreview && (
                      <div className="mt-4">
                        <img src={imagePreview} alt="Preview" className="max-w-full h-48 object-cover rounded-lg border-2 border-blue-200 shadow-md" />
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
                <div key={p.id} className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all border-l-4 border-red-500">
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
            {/* Fundo Roxo Natalino com Gradiente */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-indigo-900 to-purple-900"></div>
            
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
              
              {/* Timeline em Árvore */}
              <div className="relative">
                {/* Linha Central (Tronco da Árvore) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-3 bg-gradient-to-b from-green-600 via-green-700 to-amber-900 -translate-x-1/2 shadow-2xl rounded-full"></div>
              
                {timeline.map((item, i) => {
                  const isLeft = i % 2 === 0;
                  const natal = new Date('2025-12-25');
                  const itemDate = new Date(item.date);
                  const diasParaNatal = Math.ceil((natal.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                <div 
                  key={i} 
                  className={`relative mb-16 ${isLeft ? 'pr-1/2' : 'pl-1/2'}`}
                  style={{
                    animation: 'fadeIn 0.6s ease-out forwards',
                    animationDelay: `${i * 0.1}s`,
                    opacity: 0
                  }}
                >
                  {/* Bolinha na Árvore */}
                  <div 
                    className={`absolute top-8 w-8 h-8 rounded-full border-4 border-white z-20 shadow-2xl ${
                      item.type === 'payment' 
                        ? 'bg-gradient-to-br from-green-400 to-green-600' 
                        : 'bg-gradient-to-br from-red-500 to-red-700'
                    }`}
                    style={{
                      left: isLeft ? 'calc(50% - 16px)' : 'calc(50% - 16px)',
                      animation: 'dotPulse 2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-white/30 animate-ping"></div>
                  </div>
                  
                  {/* Linha Conectando */}
                  <div 
                    className={`absolute top-10 h-0.5 bg-white/30 ${isLeft ? 'right-1/2 left-0' : 'left-1/2 right-0'}`}
                    style={{
                      width: isLeft ? 'calc(50% - 100px)' : 'calc(50% - 100px)',
                      [isLeft ? 'right' : 'left']: '50%'
                    }}
                  ></div>
                  
                  {/* Card do Evento */}
                  <div className={`${isLeft ? 'mr-auto pr-12' : 'ml-auto pl-12'} max-w-md`}>
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border-4 border-white/50 transform transition-all duration-300 hover:scale-105 hover:shadow-3xl">
                      
                      {/* Badge de Dias para o Natal */}
                      <div className="bg-gradient-to-r from-red-600 to-green-600 px-6 py-3 text-white text-center">
                        <div className="text-sm font-bold">
                          {diasParaNatal > 0 ? `🎄 ${diasParaNatal} dias antes do Natal` : diasParaNatal === 0 ? '🎅 DIA DO NATAL!' : `${Math.abs(diasParaNatal)} dias depois do Natal`}
                        </div>
                        <div className="text-xs opacity-90 mt-1">
                          {new Date(item.date).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      
                      {/* Imagem do Produto */}
                      {item.type === 'purchase' && item.image_url && (
                        <div className="relative h-48 bg-gray-100 overflow-hidden">
                          <img 
                            src={item.image_url} 
                            alt={item.description} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Conteúdo */}
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-3xl ${item.type === 'payment' ? '💰' : '🎁'}`}>
                            {item.type === 'payment' ? '💰' : '🎁'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.type === 'payment'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.type === 'payment' ? 'PAGAMENTO' : 'COMPRA'}
                          </span>
                        </div>
                        
                        <h3 className="text-xl font-black text-gray-900 mb-2">
                          {item.description}
                        </h3>
                        
                        <div className={`text-3xl font-black mb-4 ${
                          item.type === 'payment' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.type === 'payment' ? '+' : '-'} R$ {formatCurrency(item.value)}
                        </div>
                        
                        {/* Detalhes */}
                        {item.type === 'purchase' && (
                          <div className="space-y-2 text-sm">
                            {item.category && (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-purple-600">📦</span>
                                <span className="text-gray-700">{item.category}</span>
                              </div>
                            )}
                            {item.brand && (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600">🏷️</span>
                                <span className="text-gray-700">{item.brand}</span>
                              </div>
                            )}
                            {item.notes && (
                              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                                <p className="text-xs font-bold text-yellow-800 mb-1">📝 Observações:</p>
                                <p className="text-sm text-gray-700">{item.notes}</p>
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
              
              {/* Presentes no Final */}
              <div className="text-center mt-16 mb-8">
                <div className="text-8xl mb-4">🎁🎁🎁</div>
                <h2 className="text-4xl font-black text-white drop-shadow-lg">
                  Feliz Natal! 🎄
                </h2>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
