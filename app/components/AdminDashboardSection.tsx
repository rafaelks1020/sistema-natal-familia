import React from 'react';
import { DollarSign, Check, ShoppingCart } from 'lucide-react';

interface AdminDashboardSectionProps {
  totalExpected: number;
  totalReceived: number;
  totalSpent: number;
  balance: number;
  formatCurrency: (value: any) => string;
}

export function AdminDashboardSection({
  totalExpected,
  totalReceived,
  totalSpent,
  balance,
  formatCurrency,
}: AdminDashboardSectionProps) {
  return (
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
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                balance >= 0 ? 'bg-purple-100' : 'bg-red-100'
              }`}
            >
              <DollarSign className={balance >= 0 ? 'text-purple-600' : 'text-red-600'} size={24} />
            </div>
          </div>
          <div className="text-sm text-gray-600 mb-1">Saldo</div>
          <div
            className={`text-3xl font-bold ${
              balance >= 0 ? 'text-purple-600' : 'text-red-600'
            }`}
          >
            R$ {formatCurrency(balance)}
          </div>
        </div>
      </div>
    </div>
  );
}
