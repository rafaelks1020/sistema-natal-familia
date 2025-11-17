import React, { Dispatch, SetStateAction } from 'react';
import { Plus, X } from 'lucide-react';

interface AdminPurchase {
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
}

interface NewPurchaseState {
  description: string;
  value: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  quantity: number;
  notes: string;
  image_url: string;
}

interface AdminPurchasesSectionProps {
  isAdmin: boolean;
  purchases: AdminPurchase[];
  formatCurrency: (value: any) => string;
  showAddPurchase: boolean;
  setShowAddPurchase: Dispatch<SetStateAction<boolean>>;
  newPurchase: NewPurchaseState;
  setNewPurchase: Dispatch<SetStateAction<NewPurchaseState>>;
  imagePreviews: string[];
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  uploadingImage: boolean;
  isSubmitting: boolean;
  addPurchaseWithImage: () => void;
  removePurchase: (id: number) => void;
}

export function AdminPurchasesSection({
  isAdmin,
  purchases,
  formatCurrency,
  showAddPurchase,
  setShowAddPurchase,
  newPurchase,
  setNewPurchase,
  imagePreviews,
  handleImageSelect,
  removeImage,
  uploadingImage,
  isSubmitting,
  addPurchaseWithImage,
  removePurchase,
}: AdminPurchasesSectionProps) {
  return (
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
              onChange={(e) => setNewPurchase({ ...newPurchase, description: e.target.value })}
              placeholder="Descrição *"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <input
              type="number"
              step="0.01"
              value={newPurchase.value}
              onChange={(e) => setNewPurchase({ ...newPurchase, value: e.target.value })}
              placeholder="Valor *"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <select
              value={newPurchase.category}
              onChange={(e) => setNewPurchase({ ...newPurchase, category: e.target.value })}
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
              onChange={(e) => setNewPurchase({ ...newPurchase, brand: e.target.value })}
              placeholder="Marca"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <input
              type="text"
              value={newPurchase.color}
              onChange={(e) => setNewPurchase({ ...newPurchase, color: e.target.value })}
              placeholder="Cor"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <input
              type="text"
              value={newPurchase.size}
              onChange={(e) => setNewPurchase({ ...newPurchase, size: e.target.value })}
              placeholder="Tamanho"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <input
              type="number"
              value={newPurchase.quantity}
              onChange={(e) => setNewPurchase({ ...newPurchase, quantity: parseInt(e.target.value) || 0 })}
              placeholder="Quantidade"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <textarea
              value={newPurchase.notes}
              onChange={(e) => setNewPurchase({ ...newPurchase, notes: e.target.value })}
              placeholder="Observações"
              className="px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all col-span-2 resize-none placeholder:text-gray-600 placeholder:font-medium"
              rows={3}
            />

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
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-blue-200 shadow-md"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        type="button"
                      >
                        ×
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                          Principal
                        </div>
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
            <button
              onClick={() => setShowAddPurchase(false)}
              className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 px-6 py-3 rounded-lg hover:from-gray-400 hover:to-gray-500 font-semibold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {purchases.map((p) => (
          <div
            key={p.id}
            className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all border-l-4 border-red-500"
          >
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
                <span className="inline-block mt-2 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold rounded-full shadow-md">
                  {p.category}
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  {p.brand && (
                    <div className="bg-white px-3 py-2 rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-700">Marca:</span>{' '}
                      <span className="text-gray-900">{p.brand}</span>
                    </div>
                  )}
                  {p.color && (
                    <div className="bg-white px-3 py-2 rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-700">Cor:</span>{' '}
                      <span className="text-gray-900">{p.color}</span>
                    </div>
                  )}
                  {p.size && (
                    <div className="bg-white px-3 py-2 rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-700">Tamanho:</span>{' '}
                      <span className="text-gray-900">{p.size}</span>
                    </div>
                  )}
                  <div className="bg-white px-3 py-2 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-700">Qtd:</span>{' '}
                    <span className="text-gray-900">{p.quantity}</span>
                  </div>
                </div>
                {p.notes && (
                  <p className="mt-4 text-sm text-gray-800 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400 font-medium">
                    <span className="font-bold text-yellow-700">📝 Obs:</span> {p.notes}
                  </p>
                )}
              </div>
              <div className="text-right ml-4">
                <div className="text-4xl font-black text-red-600 bg-red-50 px-4 py-2 rounded-lg border-2 border-red-200">
                  R$ {formatCurrency(p.value)}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => removePurchase(p.id)}
                    className="text-red-500 hover:text-red-700 mt-2 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
