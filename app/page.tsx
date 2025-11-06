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

  const CONTRIBUTION = 50;

  // Verificar se está logado ao carregar
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken === 'admin-authenticated') {
      setIsAdmin(true);
      setActiveTab('dashboard');
    }
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
      const formData = new FormData();
      formData.append('file', selectedImage);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      return data.url;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
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
    <div className="min-h-screen bg-gradient-to-br from-red-100 via-white to-green-100">
      {/* Header ÉPICO */}
      <div className="gradient-animate text-white p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="max-w-6xl mx-auto flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-4xl font-bold mb-2">🎄 Natal em Família 2025</h1>
            <p className="text-lg text-white/90">{isAdmin ? 'Modo Administrador' : 'Timeline Pública'}</p>
          </div>
          <div>
            {isAdmin ? (
              <button
                onClick={handleLogout}
                className="bg-white text-red-700 px-6 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-all shadow-lg"
              >
                Sair
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-white text-red-700 px-6 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-all shadow-lg"
              >
                Login Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation - Só mostra tabs admin se estiver logado */}
      {isAdmin && (
        <div className="bg-white shadow-md sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex gap-1 p-2">
            {[
              { id: 'dashboard', label: 'Painel', icon: DollarSign },
              { id: 'participants', label: 'Participantes', icon: Users },
              { id: 'purchases', label: 'Compras', icon: ShoppingCart },
              { id: 'timeline', label: 'Timeline', icon: Clock }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                <tab.icon size={18} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Login */}
      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔐 Login Administrador</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium mb-4"
            />
            {loginError && (
              <p className="text-red-600 font-semibold mb-4">{loginError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleLogin}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl font-semibold transition-all"
              >
                Entrar
              </button>
              <button
                onClick={() => {
                  setShowLogin(false);
                  setPassword('');
                  setLoginError('');
                }}
                className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 px-6 py-3 rounded-lg hover:from-gray-400 hover:to-gray-500 font-semibold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        {loading && <div className="text-center py-8">Carregando...</div>}

        {/* DASHBOARD - Só admin */}
        {isAdmin && activeTab === 'dashboard' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-600 hover:shadow-xl transition-shadow">
                <div className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Esperado</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">R$ {formatCurrency(totalExpected)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-600 hover:shadow-xl transition-shadow">
                <div className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Arrecadado</div>
                <div className="text-3xl font-bold text-green-600 mt-2">R$ {formatCurrency(totalReceived)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-orange-600 hover:shadow-xl transition-shadow">
                <div className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Gasto</div>
                <div className="text-3xl font-bold text-orange-600 mt-2">R$ {formatCurrency(totalSpent)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-600 hover:shadow-xl transition-shadow">
                <div className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Saldo</div>
                <div className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
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

        {/* TIMELINE 🔥 - SEMPRE VISÍVEL */}
        {(activeTab === 'timeline' || !isAdmin) && !loading && (
          <div className="space-y-8">
            {/* Título */}
            <div className="mb-8 animate-fadeInUp">
              <h2 className="text-4xl font-black text-gray-900 mb-2">
                Timeline de Eventos
              </h2>
              <p className="text-lg text-gray-600">Histórico completo de pagamentos e compras</p>
            </div>
            
            <div className="relative">
              {/* Linha vertical SUPER estilizada */}
              <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 via-red-500 to-blue-500 rounded-full shadow-lg"></div>
              
              {timeline.map((item, i) => (
                <div key={i} className="relative pl-24 pb-12 animate-slideInLeft" style={{animationDelay: `${i * 0.1}s`}}>
                  {/* Bolinha GIGANTE e animada */}
                  <div className={`absolute left-4 w-10 h-10 rounded-full border-4 shadow-2xl animate-pulse-slow ${
                    item.type === 'payment' 
                      ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-200' 
                      : 'bg-gradient-to-br from-red-400 to-red-600 border-red-200'
                  }`}>
                    <div className="absolute inset-0 rounded-full bg-white/30 animate-ping"></div>
                  </div>
                  
                  {/* Card ULTRA moderno */}
                  <div className="card-3d bg-gradient-to-br from-white via-gray-50 to-white p-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 border-2 border-gray-200 relative overflow-hidden group">
                    {/* Efeito de brilho no hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {/* Foto GIGANTE do Produto */}
                    {item.type === 'purchase' && item.image_url && (
                      <div className="mb-6 relative group/img">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-2xl z-10"></div>
                        <img 
                          src={item.image_url} 
                          alt={item.description} 
                          className="w-full h-80 object-cover rounded-2xl border-4 border-gradient-to-r from-blue-400 to-purple-400 shadow-2xl transform group-hover/img:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute bottom-4 left-4 z-20">
                          <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm">Foto do Produto</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex-1">
                        <div className="mb-2">
                          <h3 className="text-2xl font-bold text-gray-900">{item.description}</h3>
                        </div>
                        <div className="text-gray-600">
                          <p className="text-sm font-medium">
                            {new Date(item.date).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                      <div className={`text-3xl font-bold px-5 py-3 rounded-xl shadow-lg ${
                        item.type === 'payment' 
                          ? 'text-green-700 bg-green-50 border-2 border-green-500' 
                          : 'text-red-700 bg-red-50 border-2 border-red-500'
                      }`}>
                        {item.type === 'payment' ? '+' : '-'} R$ {formatCurrency(item.value)}
                      </div>
                    </div>
                    {item.type === 'purchase' && (
                      <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-blue-300 shadow-lg relative z-10">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-gray-200 pb-2">
                          Detalhes da Compra
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-300">
                            <span className="font-bold text-blue-700 text-xs uppercase block mb-1">Categoria</span>
                            <span className="text-gray-900 font-semibold">{item.category}</span>
                          </div>
                          {item.brand && <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-300">
                            <span className="font-bold text-purple-700 text-xs uppercase block mb-1">Marca</span>
                            <span className="text-gray-900 font-semibold">{item.brand}</span>
                          </div>}
                          {item.color && <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-300">
                            <span className="font-bold text-pink-700 text-xs uppercase block mb-1">Cor</span>
                            <span className="text-gray-900 font-semibold">{item.color}</span>
                          </div>}
                          {item.size && <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-300">
                            <span className="font-bold text-green-700 text-xs uppercase block mb-1">Tamanho</span>
                            <span className="text-gray-900 font-semibold">{item.size}</span>
                          </div>}
                        </div>
                        {item.notes && (
                          <div className="mt-4 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                            <span className="font-bold text-yellow-800 text-xs uppercase block mb-2">
                              Observações
                            </span>
                            <p className="text-gray-800 text-sm leading-relaxed">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
