import React, { Dispatch, SetStateAction } from 'react';

interface Participant {
  id: number;
  name: string;
  paid: boolean;
}

interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}

interface SecretSantaConfig {
  draw_date: string;
  min_gift_value?: number;
  max_gift_value?: number;
}

interface WishListItem {
  id: number;
  item_name: string;
  item_description?: string;
  item_url?: string;
  priority: number;
}

interface NewWishItemState {
  item_name: string;
  item_description: string;
  item_url: string;
  priority: number;
}

interface SecretSantaAdminSectionProps {
  secretSantaConfig: SecretSantaConfig | null;
  minGiftValue: number;
  maxGiftValue: number;
  setMinGiftValue: (value: number) => void;
  setMaxGiftValue: (value: number) => void;
  drawRules: DrawRule[];
  selectedP1: number;
  selectedP2: number;
  setSelectedP1: (value: number) => void;
  setSelectedP2: (value: number) => void;
  participants: Participant[];
  isSubmitting: boolean;
  cancelDraw: () => void | Promise<void>;
  addDrawRule: () => void;
  removeDrawRule: (index: number) => void;
  performDraw: () => void | Promise<void>;
  allDraws: any[];
  onCopyToken: (token: string) => void | Promise<void>;
  selectedParticipantForWishList: number;
  setSelectedParticipantForWishList: (id: number) => void;
  fetchAdminWishList: (participantId: number) => void | Promise<void>;
  newWishItem: NewWishItemState;
  setNewWishItem: Dispatch<SetStateAction<NewWishItemState>>;
  adminWishList: WishListItem[];
  addAdminWishItem: () => void | Promise<void>;
  removeAdminWishItem: (itemId: number) => void | Promise<void>;
}

export function SecretSantaAdminSection({
  secretSantaConfig,
  minGiftValue,
  maxGiftValue,
  setMinGiftValue,
  setMaxGiftValue,
  drawRules,
  selectedP1,
  selectedP2,
  setSelectedP1,
  setSelectedP2,
  participants,
  isSubmitting,
  cancelDraw,
  addDrawRule,
  removeDrawRule,
  performDraw,
  allDraws,
  onCopyToken,
  selectedParticipantForWishList,
  setSelectedParticipantForWishList,
  fetchAdminWishList,
  newWishItem,
  setNewWishItem,
  adminWishList,
  addAdminWishItem,
  removeAdminWishItem,
}: SecretSantaAdminSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white drop-shadow-lg">🎅 Amigo Oculto</h2>
      <p className="text-sm text-white/80 max-w-2xl">
        Aqui você configura o sorteio, define quem participa, cria regras (quem não pode tirar quem), gera os
        tokens para cada pessoa e cadastra as listas de desejos da família.
      </p>

      {/* Status do Sorteio / Configuração */}
      {secretSantaConfig ? (
        <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-green-300">
          <h3 className="text-2xl font-bold text-green-600 mb-4 flex items-center gap-2">
            ✅ Sorteio Ativo
          </h3>
          <div className="space-y-2 text-gray-700">
            <p>
              <span className="font-bold">Data do sorteio:</span>{' '}
              {new Date(secretSantaConfig.draw_date).toLocaleDateString('pt-BR')}
            </p>
            {secretSantaConfig.min_gift_value && (
              <p>
                <span className="font-bold">Valor do presente:</span>{' '}
                R$ {secretSantaConfig.min_gift_value} - R$ {secretSantaConfig.max_gift_value}
              </p>
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
          <h3 className="text-2xl font-bold mb-2 text-gray-800">Configurar Sorteio (Passo 1)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Defina o intervalo de valores dos presentes e as regras básicas. Depois disso, você poderá fazer o sorteio
            e distribuir os tokens para a família.
          </p>

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

          <div className="mb-4">
            <h4 className="font-bold mb-2 text-gray-800">Regras (quem NÃO pode tirar quem)</h4>
            <p className="text-sm text-gray-600 mb-3">Ex: casais, irmãos, pessoas que moram juntas</p>

            {drawRules.length > 0 && (
              <div className="space-y-2 mb-3">
                {drawRules.map((rule, idx) => {
                  const p1 = participants.find((p) => p.id === rule.participant1_id);
                  const p2 = participants.find((p) => p.id === rule.participant2_id);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-100 p-3 rounded-lg"
                    >
                      <span className="font-medium text-gray-800">
                        {p1?.name} ↔ {p2?.name}
                      </span>
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

            <div className="flex gap-2">
              <select
                value={selectedP1}
                onChange={(e) => setSelectedP1(Number(e.target.value))}
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value={0}>Pessoa 1</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedP2}
                onChange={(e) => setSelectedP2(Number(e.target.value))}
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value={0}>Pessoa 2</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
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
            Todos os participantes cadastrados entrarão no sorteio ({' '}
            {participants.length} pessoas)
          </p>
        </div>
      )}

      {allDraws.length > 0 && (
        <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-purple-200">
          <h3 className="text-2xl font-bold mb-4 text-gray-800">🎫 Tokens para Distribuir (Passo 2)</h3>
          <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg mb-4 border-l-4 border-blue-400">
            💡 <span className="font-bold">Como funciona:</span> Entregue cada token para a pessoa correspondente.
            Elas usarão o token para revelar seu amigo oculto na aba pública.
          </p>
          <div className="space-y-3">
            {allDraws.map((draw, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-800 text-lg">{draw.giver_name}</span>
                  {draw.revealed && (
                    <span className="text-green-500 text-sm font-bold bg-green-100 px-2 py-1 rounded">
                      ✓ Revelado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white p-3 rounded-lg border-2 border-purple-300 font-mono text-2xl font-bold text-purple-600 text-center tracking-wider">
                    {draw.token}
                  </div>
                  <button
                    onClick={() => onCopyToken(draw.token)}
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

      <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-2 border-pink-200">
        <h3 className="text-2xl font-bold mb-4 text-gray-800">📝 Gerenciar Listas de Desejos (Passo 3)</h3>
        <p className="text-sm text-pink-700 bg-pink-50 p-3 rounded-lg mb-4 border-l-4 border-pink-400">
          💡 <span className="font-bold">Cadastre as sugestões de presente</span> para cada participante. Quando
          alguém revelar o token, verá automaticamente a lista da pessoa que tirou!
        </p>

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
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedParticipantForWishList > 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-lg border-2 border-pink-300">
              <h4 className="font-bold text-gray-800 mb-3">Adicionar Sugestão de Presente</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newWishItem.item_name}
                  onChange={(e) => setNewWishItem((prev) => ({ ...prev, item_name: e.target.value }))}
                  placeholder="Nome do item *"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none text-lg font-semibold"
                />
                <textarea
                  value={newWishItem.item_description}
                  onChange={(e) => setNewWishItem((prev) => ({ ...prev, item_description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none resize-none"
                  rows={2}
                />
                <input
                  type="url"
                  value={newWishItem.item_url}
                  onChange={(e) => setNewWishItem((prev) => ({ ...prev, item_url: e.target.value }))}
                  placeholder="Link do produto (opcional)"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none"
                />
                <select
                  value={newWishItem.priority}
                  onChange={(e) => setNewWishItem((prev) => ({ ...prev, priority: Number(e.target.value) }))}
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

            {adminWishList.length > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-pink-200">
                <h4 className="font-bold text-gray-800 mb-3">
                  Lista de {participants.find((p) => p.id === selectedParticipantForWishList)?.name}:
                </h4>
                <div className="space-y-2">
                  {adminWishList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-lg border border-pink-200 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-bold text-gray-800">{item.item_name}</h5>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-bold ${
                              item.priority === 3
                                ? 'bg-red-100 text-red-700'
                                : item.priority === 2
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
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
                        onClick={() => removeAdminWishItem(item.id)}
                        className="ml-3 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-bold"
                      >
                        Remover
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
  );
}
