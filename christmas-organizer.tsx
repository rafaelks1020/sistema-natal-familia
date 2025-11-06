import React, { useState, useEffect } from 'react';
import { DollarSign, Users, ShoppingCart, Clock, Plus, X, Check, AlertCircle } from 'lucide-react';

export default function ChristmasOrganizer() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [participants, setParticipants] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [newParticipant, setNewParticipant] = useState('');
  const [newPurchase, setNewPurchase] = useState({
    description: '',
    value: '',
    category: 'Decoração',
    color: '',
    size: '',
    brand: '',
    quantity: 1,
    notes: ''
  });

  const CONTRIBUTION = 50;

  const addParticipant = () => {
    if (newParticipant.trim()) {
      setParticipants([...participants, {
        id: Date.now(),
        name: newParticipant,
        paid: false,
        date: null
      }]);
      setNewParticipant('');
      setShowAddParticipant(false);
    }
  };

  const togglePayment = (id) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, paid: !p.paid, date: !p.paid ? new Date().toISOString() : null } : p
    ));
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const addPurchase = () => {
    if (newPurchase.description && newPurchase.value) {
      setPurchases([...purchases, {
        id: Date.now(),
        ...newPurchase,
        value: parseFloat(newPurchase.value),
        date: new Date().toISOString()
      }]);
      setNewPurchase({
        description: '',
        value: '',
        category: 'Decoração',
        color: '',
        size: '',
        brand: '',
        quantity: 1,
        notes: ''
      });
      setShowAddPurchase(false);
    }
  };

  const removePurchase = (id) => {
    setPurchases(purchases.filter(p => p.id !== id));
  };

  const totalExpected = participants.length * CONTRIBUTION;
  const totalReceived = participants.filter(p => p.paid).length * CONTRIBUTION;
  const totalSpent = purchases.reduce((sum, p) => sum + p.value, 0);
  const balance = totalReceived - totalSpent;

  const timeline = [
    ...participants.filter(p => p.paid).map(p => ({
      type: 'payment',
      date: p.date,
      description: `${p.name} pagou sua contribuição`,
      value: CONTRIBUTION,
      participant: p
    })),
    ...purchases.map(p => ({
      type: 'purchase',
      date: p.date,
      description: p.description,
      value: -p.value,
      purchase: p
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-green-600 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">🎄 Organizador de Natal 2025</h1>
          <p className="text-red-100">Gerencie contribuições e compras do natal em família</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex gap-1 p-2">
          {[
            { id: 'dashboard', label: 'Painel', icon: DollarSign },
            { id: 'participants', label: 'Participantes', icon: Users },
            { id: 'purchases', label: 'Compras', icon: ShoppingCart },
            { id: 'timeline', label: 'Auditoria', icon: Clock }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                <div className="text-gray-600 text-sm font-medium">Esperado</div>
                <div className="text-2xl font-bold text-blue-600">R$ {totalExpected.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">{participants.length} participantes</div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-500">
                <div className="text-gray-600 text-sm font-medium">Arrecadado</div>
                <div className="text-2xl font-bold text-green-600">R$ {totalReceived.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">{participants.filter(p => p.paid).length} pagaram</div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-orange-500">
                <div className="text-gray-600 text-sm font-medium">Gasto</div>
                <div className="text-2xl font-bold text-orange-600">R$ {totalSpent.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">{purchases.length} compras</div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-purple-500">
                <div className="text-gray-600 text-sm font-medium">Saldo</div>
                <div className={`text-2xl font-bold ${balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  R$ {balance.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {balance >= 0 ? 'Disponível' : 'Déficit'}
                </div>
              </div>
            </div>

            {/* Pending Payments */}
            {participants.filter(p => !p.paid).length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-yellow-600" size={20} />
                  <h3 className="font-bold text-yellow-800">Pagamentos Pendentes</h3>
                </div>
                <div className="text-sm text-yellow-700">
                  {participants.filter(p => !p.paid).map(p => p.name).join(', ')} ainda não pagaram
                </div>
              </div>
            )}

            {/* Recent Purchases */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Últimas Compras</h3>
              {purchases.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma compra registrada ainda</p>
              ) : (
                <div className="space-y-3">
                  {purchases.slice(-5).reverse().map(purchase => (
                    <div key={purchase.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-800">{purchase.description}</div>
                        <div className="text-xs text-gray-500">{purchase.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">R$ {purchase.value.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(purchase.date).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        {activeTab === 'participants' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Participantes</h2>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Adicionar
              </button>
            </div>

            {showAddParticipant && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-bold text-gray-800 mb-4">Novo Participante</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
                    placeholder="Nome do participante"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button
                    onClick={addParticipant}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => setShowAddParticipant(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map(participant => (
                <div
                  key={participant.id}
                  className={`bg-white p-6 rounded-xl shadow-md border-l-4 ${
                    participant.paid ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{participant.name}</h3>
                      <p className="text-sm text-gray-600">Contribuição: R$ {CONTRIBUTION.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => togglePayment(participant.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        participant.paid
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {participant.paid ? <Check size={18} /> : <X size={18} />}
                      {participant.paid ? 'Pago' : 'Pendente'}
                    </button>
                    {participant.paid && (
                      <span className="text-xs text-gray-500">
                        {new Date(participant.date).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {participants.length === 0 && (
              <div className="bg-white p-12 rounded-xl shadow-md text-center">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhum participante cadastrado ainda</p>
              </div>
            )}
          </div>
        )}

        {/* Purchases */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Compras Realizadas</h2>
              <button
                onClick={() => setShowAddPurchase(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Nova Compra
              </button>
            </div>

            {showAddPurchase && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-bold text-gray-800 mb-4">Registrar Nova Compra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newPurchase.description}
                    onChange={(e) => setNewPurchase({...newPurchase, description: e.target.value})}
                    placeholder="Descrição do item *"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newPurchase.value}
                    onChange={(e) => setNewPurchase({...newPurchase, value: e.target.value})}
                    placeholder="Valor (R$) *"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newPurchase.category}
                    onChange={(e) => setNewPurchase({...newPurchase, category: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newPurchase.color}
                    onChange={(e) => setNewPurchase({...newPurchase, color: e.target.value})}
                    placeholder="Cor"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newPurchase.size}
                    onChange={(e) => setNewPurchase({...newPurchase, size: e.target.value})}
                    placeholder="Tamanho"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={newPurchase.quantity}
                    onChange={(e) => setNewPurchase({...newPurchase, quantity: e.target.value})}
                    placeholder="Quantidade"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase({...newPurchase, notes: e.target.value})}
                    placeholder="Observações adicionais"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 md:col-span-2"
                    rows="2"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={addPurchase}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Registrar Compra
                  </button>
                  <button
                    onClick={() => setShowAddPurchase(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {purchases.map(purchase => (
                <div key={purchase.id} className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{purchase.description}</h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {purchase.category}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {purchase.brand && (
                          <div>
                            <span className="text-gray-500">Marca:</span>
                            <span className="ml-2 font-medium">{purchase.brand}</span>
                          </div>
                        )}
                        {purchase.color && (
                          <div>
                            <span className="text-gray-500">Cor:</span>
                            <span className="ml-2 font-medium">{purchase.color}</span>
                          </div>
                        )}
                        {purchase.size && (
                          <div>
                            <span className="text-gray-500">Tamanho:</span>
                            <span className="ml-2 font-medium">{purchase.size}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Qtd:</span>
                          <span className="ml-2 font-medium">{purchase.quantity}</span>
                        </div>
                      </div>
                      {purchase.notes && (
                        <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          {purchase.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-red-600 mb-2">
                        R$ {purchase.value.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {new Date(purchase.date).toLocaleDateString('pt-BR')}
                      </div>
                      <button
                        onClick={() => removePurchase(purchase.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {purchases.length === 0 && (
              <div className="bg-white p-12 rounded-xl shadow-md text-center">
                <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhuma compra registrada ainda</p>
              </div>
            )}
          </div>
        )}

        {/* Timeline/Audit */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Linha do Tempo - Auditoria Completa</h2>
            
            {timeline.length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow-md text-center">
                <Clock size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhuma movimentação registrada ainda</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                
                {timeline.map((item, index) => (
                  <div key={index} className="relative pl-20 pb-8">
                    <div className={`absolute left-6 w-5 h-5 rounded-full border-4 ${
                      item.type === 'payment' ? 'bg-green-500 border-green-200' : 'bg-red-500 border-red-200'
                    }`}></div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-800">{item.description}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(item.date).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className={`text-2xl font-bold ${
                          item.type === 'payment' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.type === 'payment' ? '+' : '-'} R$ {Math.abs(item.value).toFixed(2)}
                        </div>
                      </div>
                      
                      {item.type === 'purchase' && item.purchase && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Categoria:</span>
                              <span className="ml-2 font-medium">{item.purchase.category}</span>
                            </div>
                            {item.purchase.brand && (
                              <div>
                                <span className="text-gray-500">Marca:</span>
                                <span className="ml-2 font-medium">{item.purchase.brand}</span>
                              </div>
                            )}
                            {item.purchase.color && (
                              <div>
                                <span className="text-gray-500">Cor:</span>
                                <span className="ml-2 font-medium">{item.purchase.color}</span>
                              </div>
                            )}
                            {item.purchase.size && (
                              <div>
                                <span className="text-gray-500">Tamanho:</span>
                                <span className="ml-2 font-medium">{item.purchase.size}</span>
                              </div>
                            )}
                          </div>
                          {item.purchase.notes && (
                            <p className="mt-3 text-sm text-gray-600">
                              <span className="font-medium">Obs:</span> {item.purchase.notes}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Saldo após movimentação:</span>
                          <span className={`font-bold ${
                            timeline.slice(index).reduce((sum, t) => sum + t.value, 0) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            R$ {timeline.slice(index).reduce((sum, t) => sum + t.value, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}