import React from 'react';
import { Plus, X, Check } from 'lucide-react';

interface AdminParticipant {
  id: number;
  name: string;
  paid: boolean;
}

interface AdminParticipantsSectionProps {
  participants: AdminParticipant[];
  contribution: number;
  formatCurrency: (value: any) => string;
  showAddParticipant: boolean;
  newParticipant: string;
  isSubmitting: boolean;
  onOpenAddParticipant: () => void;
  onCloseAddParticipant: () => void;
  onChangeNewParticipant: (value: string) => void;
  onSubmitNewParticipant: () => void;
  onTogglePayment: (id: number, paid: boolean) => void;
  onRemoveParticipant: (id: number) => void;
}

export function AdminParticipantsSection({
  participants,
  contribution,
  formatCurrency,
  showAddParticipant,
  newParticipant,
  isSubmitting,
  onOpenAddParticipant,
  onCloseAddParticipant,
  onChangeNewParticipant,
  onSubmitNewParticipant,
  onTogglePayment,
  onRemoveParticipant,
}: AdminParticipantsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Participantes</h2>
        <button
          onClick={onOpenAddParticipant}
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
              onChange={(e) => onChangeNewParticipant(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onSubmitNewParticipant()}
              placeholder="Nome do participante"
              className="flex-1 px-4 py-3 text-lg font-semibold text-gray-900 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all placeholder:text-gray-600 placeholder:font-medium"
            />
            <button
              onClick={onSubmitNewParticipant}
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
            <button
              onClick={onCloseAddParticipant}
              className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 px-6 py-3 rounded-lg hover:from-gray-400 hover:to-gray-500 font-semibold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {participants.map((p) => (
          <div
            key={p.id}
            className={`bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border-l-4 hover:shadow-xl transition-all ${
              p.paid ? 'border-green-600' : 'border-red-600'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
                <p className="text-sm text-gray-600">R$ {formatCurrency(contribution)}</p>
              </div>
              <button onClick={() => onRemoveParticipant(p.id)} className="text-red-500">
                <X size={20} />
              </button>
            </div>
            <button
              onClick={() => onTogglePayment(p.id, p.paid)}
              className={`mt-4 px-4 py-2.5 rounded-lg font-semibold w-full transition-all ${
                p.paid ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              {p.paid ? <Check className="inline" size={18} /> : <X className="inline" size={18} />}
              {' '}
              {p.paid ? 'Pago' : 'Pendente'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
