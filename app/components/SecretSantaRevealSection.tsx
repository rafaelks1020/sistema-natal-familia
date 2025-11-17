import React from 'react';

interface WishListItem {
  id: number;
  item_name: string;
  item_description?: string;
  item_url?: string;
  priority: number;
  purchased: boolean;
}

interface SecretSantaConfig {
  min_gift_value?: number;
  max_gift_value?: number;
}

interface RevealedDraw {
  giver_name: string;
  receiver_name: string;
  receiver_id: number;
}

interface SecretSantaRevealSectionProps {
  isAdmin: boolean;
  showRevealSection: boolean;
  revealedDraw: RevealedDraw | null;
  revealToken: string;
  setRevealToken: (value: string) => void;
  isSubmitting: boolean;
  revealByToken: () => void;
  secretSantaConfig: SecretSantaConfig | null;
  receiverWishList: WishListItem[];
  togglePurchased: (itemId: number, purchased: boolean, participantId: number) => void;
  onResetReveal: () => void;
  onCloseReveal: () => void;
}

export function SecretSantaRevealSection({
  isAdmin,
  showRevealSection,
  revealedDraw,
  revealToken,
  setRevealToken,
  isSubmitting,
  revealByToken,
  secretSantaConfig,
  receiverWishList,
  togglePurchased,
  onResetReveal,
  onCloseReveal,
}: SecretSantaRevealSectionProps) {
  if (isAdmin || !showRevealSection) return null;

  return (
    <div className="mb-8">
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border-4 border-purple-300">
        <h2 className="text-3xl font-bold text-purple-600 mb-4 text-center">
          🎁 Revelar Meu Amigo Oculto
        </h2>

        {!revealedDraw ? (
          <div className="space-y-4">
            <p className="text-gray-700 text-center">
              Você recebeu um <span className="font-semibold">token</span> (código) do organizador do sorteio.
              Ele parece algo como <span className="font-mono font-bold">ABC12345</span>.
            </p>
            <p className="text-gray-600 text-center text-sm">
              Digite esse código abaixo para descobrir quem você tirou e ver sugestões de presente da pessoa.
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
              <p className="text-lg text-gray-700 mb-2">
                Olá,
                {' '}
                <span className="font-bold text-purple-600">{revealedDraw.giver_name}</span>!
              </p>
              <p className="text-2xl font-bold text-gray-800 mb-4">Você tirou:</p>
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-8 rounded-2xl border-4 border-purple-400 shadow-xl">
                <p className="text-5xl font-black text-purple-600 mb-2">{revealedDraw.receiver_name}</p>
                <p className="text-xl text-gray-700">🎁 Seu amigo oculto!</p>
              </div>
            </div>

            {secretSantaConfig && secretSantaConfig.min_gift_value && (
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-blue-800">
                  <span className="font-bold">💰 Valor sugerido do presente:</span>
                  {' '}
                  R$ {secretSantaConfig.min_gift_value} - R$ {secretSantaConfig.max_gift_value}
                </p>
              </div>
            )}

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300">
              <h3 className="text-xl font-bold text-green-700 mb-1 flex items-center gap-2">
                🎁 Sugestões de Presente de {revealedDraw.receiver_name}
              </h3>
              <p className="text-xs md:text-sm text-green-700 mb-3">
                Use essa lista como guia. Você pode marcar um item como <span className="font-semibold">comprado</span>
                para evitar presentes repetidos.
              </p>
              {receiverWishList.length > 0 ? (
                <div className="space-y-3">
                  {receiverWishList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-lg border border-green-200 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800">{item.item_name}</h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-bold ${
                                item.priority === 3
                                  ? 'bg-red-100 text-red-700'
                                  : item.priority === 2
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {item.priority === 3
                                ? '⭐⭐⭐ Alta'
                                : item.priority === 2
                                ? '⭐⭐ Média'
                                : '⭐ Baixa'}
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
                onClick={onResetReveal}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all"
              >
                Revelar Outro Token
              </button>
              <button
                onClick={onCloseReveal}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
