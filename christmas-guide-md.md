# 🎄 Sistema Organizador de Natal - Guia Completo DIRETO NO PONTO

## 📋 Visão Geral

Sistema de gerenciamento de contribuições e compras de Natal:
- **Stack:** Next.js 14 + React + Tailwind CSS + PostgreSQL (Neon)
- **Deploy:** Vercel
- **Estrutura:** MINIMALISTA - tudo em um lugar só

---

## 🚀 COMEÇANDO - SETUP RÁPIDO


---

## 🔐 2. Configurar Banco (Neon já tá pronto!)

### 2.1 - Criar `.env.local` na raiz

```env
DATABASE_URL=postgresql://neondb_owner:npg_19yXGeVvioYs@ep-royal-glitter-a4p2od6s-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

POSTGRES_URL=postgresql://neondb_owner:npg_19yXGeVvioYs@ep-royal-glitter-a4p2od6s-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 2.2 - Criar as tabelas no Neon

Acesse: https://console.neon.tech/ → SQL Editor → Cole e roda:

```sql
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  brand VARCHAR(255),
  color VARCHAR(100),
  size VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_paid ON participants(paid);
CREATE INDEX idx_purchases_created ON purchases(created_at DESC);
```

---

## 💻 3. CÓDIGO - TUDO DIRETO SEM FIRULA

### Estrutura Final (SÓ 3 ARQUIVOS!)

```
christmas-organizer/
├── app/
│   ├── api/
│   │   └── [...slug]/
│   │       └── route.ts          # TODAS as APIs aqui
│   ├── page.tsx                  # FRONTEND COMPLETO
│   └── layout.tsx                # (já vem criado)
├── .env.local                    # Suas credenciais
└── package.json
```

---

## 📁 ARQUIVO 1: API UNIFICADA

### Criar: `app/api/[...slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const CONTRIBUTION = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [resource] = params.slug;

  try {
    if (resource === 'participants') {
      const { rows } = await sql`SELECT * FROM participants ORDER BY name`;
      return NextResponse.json(rows);
    }

    if (resource === 'purchases') {
      const { rows } = await sql`SELECT * FROM purchases ORDER BY created_at DESC`;
      return NextResponse.json(rows);
    }

    if (resource === 'timeline') {
      const { rows: payments } = await sql`
        SELECT 
          id, 'payment' as type, name || ' pagou' as description,
          ${CONTRIBUTION} as value, paid_date as date, name
        FROM participants WHERE paid = true
      `;
      const { rows: purchases } = await sql`
        SELECT 
          id, 'purchase' as type, description,
          value, created_at as date, category, brand, color, size, quantity, notes
        FROM purchases
      `;
      const timeline = [...payments, ...purchases]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return NextResponse.json(timeline);
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro GET:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [resource] = params.slug;

  try {
    const data = await request.json();

    if (resource === 'participants') {
      const { rows } = await sql`
        INSERT INTO participants (name) VALUES (${data.name}) RETURNING *
      `;
      return NextResponse.json(rows[0], { status: 201 });
    }

    if (resource === 'purchases') {
      const { rows } = await sql`
        INSERT INTO purchases (
          description, value, category, brand, color, size, quantity, notes
        ) VALUES (
          ${data.description}, ${parseFloat(data.value)}, ${data.category},
          ${data.brand || null}, ${data.color || null}, ${data.size || null},
          ${data.quantity || 1}, ${data.notes || null}
        ) RETURNING *
      `;
      return NextResponse.json(rows[0], { status: 201 });
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro POST:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [resource, id] = params.slug;

  try {
    const data = await request.json();

    if (resource === 'participants') {
      const { rows } = await sql`
        UPDATE participants 
        SET paid = ${data.paid}, paid_date = ${data.paid ? new Date().toISOString() : null}
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro PUT:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [resource, id] = params.slug;

  try {
    if (resource === 'participants') {
      await sql`DELETE FROM participants WHERE id = ${parseInt(id)}`;
      return NextResponse.json({ success: true });
    }

    if (resource === 'purchases') {
      await sql`DELETE FROM purchases WHERE id = ${parseInt(id)}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro DELETE:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
```

---

## 📁 ARQUIVO 2: FRONTEND COMPLETO

### Substituir TODO conteúdo de `app/page.tsx`:

```typescript
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
  created_at: string;
}

export default function ChristmasOrganizer() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
    notes: ''
  });

  const CONTRIBUTION = 50;

  // Carregar dados
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'participants' || activeTab === 'dashboard') {
        const res = await fetch('/api/participants');
        const data = await res.json();
        setParticipants(data);
      }
      if (activeTab === 'purchases' || activeTab === 'dashboard') {
        const res = await fetch('/api/purchases');
        const data = await res.json();
        setPurchases(data);
      }
      if (activeTab === 'timeline') {
        const res = await fetch('/api/timeline');
        const data = await res.json();
        setTimeline(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

  // Adicionar compra
  const addPurchase = async () => {
    if (!newPurchase.description || !newPurchase.value) return;
    
    await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPurchase)
    });
    
    setNewPurchase({
      description: '',
      value: '',
      category: 'Decoração',
      brand: '',
      color: '',
      size: '',
      quantity: 1,
      notes: ''
    });
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
  const totalSpent = purchases.reduce((sum, p) => sum + p.value, 0);
  const balance = totalReceived - totalSpent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-green-600 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">🎄 Organizador de Natal 2025</h1>
          <p className="text-red-100">Gerencie contribuições e compras do natal</p>
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
        {loading && <div className="text-center py-8">Carregando...</div>}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                <div className="text-gray-600 text-sm font-medium">Esperado</div>
                <div className="text-2xl font-bold text-blue-600">R$ {totalExpected.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-500">
                <div className="text-gray-600 text-sm font-medium">Arrecadado</div>
                <div className="text-2xl font-bold text-green-600">R$ {totalReceived.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-orange-500">
                <div className="text-gray-600 text-sm font-medium">Gasto</div>
                <div className="text-2xl font-bold text-orange-600">R$ {totalSpent.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-purple-500">
                <div className="text-gray-600 text-sm font-medium">Saldo</div>
                <div className={`text-2xl font-bold ${balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  R$ {balance.toFixed(2)}
                </div>
              </div>
            </div>

            {participants.filter(p => !p.paid).length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
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

        {/* PARTICIPANTES */}
        {activeTab === 'participants' && !loading && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Participantes</h2>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus size={20} /> Adicionar
              </button>
            </div>

            {showAddParticipant && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
                    placeholder="Nome"
                    className="flex-1 px-4 py-2 border rounded-lg"
                  />
                  <button onClick={addParticipant} className="bg-green-600 text-white px-6 py-2 rounded-lg">
                    Salvar
                  </button>
                  <button onClick={() => setShowAddParticipant(false)} className="bg-gray-300 px-4 py-2 rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map(p => (
                <div key={p.id} className={`bg-white p-6 rounded-xl shadow-md border-l-4 ${p.paid ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold">{p.name}</h3>
                      <p className="text-sm text-gray-600">R$ {CONTRIBUTION.toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeParticipant(p.id)} className="text-red-500">
                      <X size={20} />
                    </button>
                  </div>
                  <button
                    onClick={() => togglePayment(p.id, p.paid)}
                    className={`mt-4 px-4 py-2 rounded-lg font-medium w-full ${
                      p.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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

        {/* COMPRAS */}
        {activeTab === 'purchases' && !loading && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Compras</h2>
              <button
                onClick={() => setShowAddPurchase(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} /> Nova Compra
              </button>
            </div>

            {showAddPurchase && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newPurchase.description}
                    onChange={(e) => setNewPurchase({...newPurchase, description: e.target.value})}
                    placeholder="Descrição *"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newPurchase.value}
                    onChange={(e) => setNewPurchase({...newPurchase, value: e.target.value})}
                    placeholder="Valor *"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <select
                    value={newPurchase.category}
                    onChange={(e) => setNewPurchase({...newPurchase, category: e.target.value})}
                    className="px-4 py-2 border rounded-lg"
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
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    value={newPurchase.color}
                    onChange={(e) => setNewPurchase({...newPurchase, color: e.target.value})}
                    placeholder="Cor"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    value={newPurchase.size}
                    onChange={(e) => setNewPurchase({...newPurchase, size: e.target.value})}
                    placeholder="Tamanho"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    value={newPurchase.quantity}
                    onChange={(e) => setNewPurchase({...newPurchase, quantity: parseInt(e.target.value)})}
                    placeholder="Quantidade"
                    className="px-4 py-2 border rounded-lg"
                  />
                  <textarea
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase({...newPurchase, notes: e.target.value})}
                    placeholder="Observações"
                    className="px-4 py-2 border rounded-lg col-span-2"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={addPurchase} className="bg-blue-600 text-white px-6 py-2 rounded-lg">
                    Salvar
                  </button>
                  <button onClick={() => setShowAddPurchase(false)} className="bg-gray-300 px-4 py-2 rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {purchases.map(p => (
                <div key={p.id} className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{p.description}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{p.category}</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                        {p.brand && <div><span className="text-gray-500">Marca:</span> {p.brand}</div>}
                        {p.color && <div><span className="text-gray-500">Cor:</span> {p.color}</div>}
                        {p.size && <div><span className="text-gray-500">Tamanho:</span> {p.size}</div>}
                        <div><span className="text-gray-500">Qtd:</span> {p.quantity}</div>
                      </div>
                      {p.notes && <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">{p.notes}</p>}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-red-600">R$ {p.value.toFixed(2)}</div>
                      <button onClick={() => removePurchase(p.id)} className="text-red-500 mt-2">
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && !loading && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Linha do Tempo - Auditoria</h2>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              {timeline.map((item, i) => (
                <div key={i} className="relative pl-20 pb-8">
                  <div className={`absolute left-6 w-5 h-5 rounded-full border-4 ${
                    item.type === 'payment' ? 'bg-green-500 border-green-200' : 'bg-red-500 border-red-200'
                  }`}></div>
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold">{item.description}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(item.date).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className={`text-2xl font-bold ${
                        item.type === 'payment' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.type === 'payment' ? '+' : '-'} R$ {item.value.toFixed(2)}
                      </div>
                    </div>
                    {item.type === 'purchase' && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-gray-500">Categoria:</span> {item.category}</div>
                          {item.brand && <div><span className="text-gray-500">Marca:</span> {item.brand}</div>}
                          {item.color && <div><span className="text-gray-500">Cor:</span> {item.color}</div>}
                          {item.size && <div><span className="text-gray-500">Tamanho:</span> {item.size}</div>}
                        </div>
                        {item.notes && <p className="mt-2"><strong>Obs:</strong> {item.notes}</p>}
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
```

---

## 🚀 4. TESTAR LOCAL

```bash
npm run dev
```

Abra: http://localhost:3000

---

## 🌐 5. DEPLOY NA VERCEL

### Opção A: Via GitHub (RECOMENDADO)

```bash
# Inicializar git
git init
git add .
git commit -m "Sistema de Natal"

# Criar repo no GitHub e push
git remote add origin https://github.com/SEU-USER/christmas-organizer.git
git branch -M main
git push -u origin main

# Na Vercel:
# 1. Acesse vercel.com
# 2. New Project
# 3. Import do GitHub
# 4. Em Environment Variables adicione:
#    DATABASE_URL = sua_url_do_neon
#    POSTGRES_URL = sua_url_do_neon
# 5. Deploy
```

### Opção B: Via CLI

```bash
npm i -g vercel
vercel login
vercel

# Adicionar env variables quando pedir
```

---

## ✅ PRONTO!

Seu sistema vai estar rodando em: `https://seu-projeto.vercel.app`

### Recursos:
- ✅ CRUD completo de participantes
- ✅ CRUD completo de compras
- ✅ Dashboard com totalizadores
- ✅ Timeline/Auditoria completa
- ✅ Banco PostgreSQL (Neon) persistente
- ✅ Deploy automático na Vercel

### Estrutura MÍNIMA:
- **2 arquivos de código** (route.ts + page.tsx)
- **1 arquivo config** (.env.local)
- **ZERO pastas extras** - tudo direto no necessário!

---

## 🔥 PRÓXIMOS PASSOS (se quiser)

1. **Upload de fotos:** Adicionar `@vercel/blob`
2. **Autenticação:** Adicionar login com Clerk ou Stack Auth
3. **PWA:** Transformar em app instalável
4. **WhatsApp:** Integrar notificações

Mas tá PRONTO pra usar assim mesmo! 🎄✨