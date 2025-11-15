# 🔧 Como Integrar o Amigo Oculto na Interface

## 📝 Passo a Passo

### 1. Executar SQL no Banco

Acesse o Neon Dashboard e execute o SQL em `AMIGO-OCULTO.sql`

---

### 2. Adicionar Interfaces TypeScript no `page.tsx`

```typescript
// Adicionar após as interfaces existentes

interface SecretSantaConfig {
  id: number;
  year: number;
  is_active: boolean;
  draw_date: string;
  reveal_date?: string;
  min_gift_value?: number;
  max_gift_value?: number;
  rules?: DrawRule[];
}

interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}

interface SecretSantaDraw {
  id: number;
  receiver_id: number;
  receiver_name: string;
  revealed: boolean;
  revealed_at?: string;
}

interface WishListItem {
  id: number;
  participant_id: number;
  item_name: string;
  item_description?: string;
  item_url?: string;
  priority: number;
  purchased: boolean;
}
```

---

### 3. Adicionar Estados no Componente Principal

```typescript
// Adicionar após os estados existentes

const [secretSantaConfig, setSecretSantaConfig] = useState<SecretSantaConfig | null>(null);
const [myDraw, setMyDraw] = useState<SecretSantaDraw | null>(null);
const [allDraws, setAllDraws] = useState<any[]>([]);
const [wishList, setWishList] = useState<WishListItem[]>([]);
const [drawRules, setDrawRules] = useState<DrawRule[]>([]);
const [minGiftValue, setMinGiftValue] = useState<number>(50);
const [maxGiftValue, setMaxGiftValue] = useState<number>(150);
const [newWishItem, setNewWishItem] = useState({
  item_name: '',
  item_description: '',
  item_url: '',
  priority: 2
});
const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
```

---

### 4. Adicionar Funções de Fetch

```typescript
// Buscar configuração do amigo oculto
const fetchSecretSantaConfig = async () => {
  const res = await fetch('/api/secret-santa?action=config');
  const data = await res.json();
  setSecretSantaConfig(data);
};

// Buscar meu sorteio (para participantes)
const fetchMyDraw = async (participantId: number) => {
  const res = await fetch(`/api/secret-santa?action=my-draw&participant_id=${participantId}`);
  const data = await res.json();
  setMyDraw(data);
};

// Buscar todos os sorteios (admin)
const fetchAllDraws = async () => {
  const res = await fetch('/api/secret-santa?action=all-draws');
  const data = await res.json();
  setAllDraws(data);
};

// Buscar lista de desejos
const fetchWishList = async (participantId?: number) => {
  const url = participantId 
    ? `/api/wishlist?participant_id=${participantId}`
    : '/api/wishlist';
  const res = await fetch(url);
  const data = await res.json();
  setWishList(data);
};

// Fazer sorteio (admin)
const performDraw = async () => {
  if (!confirm('Tem certeza que deseja fazer o sorteio? Esta ação não pode ser desfeita.')) {
    return;
  }
  
  try {
    const res = await fetch('/api/secret-santa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'draw',
        rules: drawRules,
        min_gift_value: minGiftValue,
        max_gift_value: maxGiftValue
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(`Sorteio realizado com sucesso! ${data.total_participants} participantes.`);
      await fetchSecretSantaConfig();
      await fetchAllDraws();
    } else {
      alert(`Erro: ${data.error}`);
    }
  } catch (error) {
    alert('Erro ao fazer sorteio');
  }
};

// Revelar meu amigo oculto
const revealMyDraw = async (participantId: number) => {
  try {
    await fetch('/api/secret-santa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reveal',
        participant_id: participantId
      })
    });
    
    await fetchMyDraw(participantId);
  } catch (error) {
    alert('Erro ao revelar');
  }
};

// Adicionar item à lista de desejos
const addWishItem = async (participantId: number) => {
  if (!newWishItem.item_name) {
    alert('Nome do item é obrigatório');
    return;
  }
  
  try {
    await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        ...newWishItem
      })
    });
    
    setNewWishItem({
      item_name: '',
      item_description: '',
      item_url: '',
      priority: 2
    });
    
    await fetchWishList(participantId);
  } catch (error) {
    alert('Erro ao adicionar item');
  }
};

// Deletar item da lista
const deleteWishItem = async (id: number, participantId: number) => {
  if (!confirm('Deletar este item?')) return;
  
  try {
    await fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' });
    await fetchWishList(participantId);
  } catch (error) {
    alert('Erro ao deletar item');
  }
};

// Adicionar regra de sorteio
const addDrawRule = (p1: number, p2: number) => {
  setDrawRules([...drawRules, {
    type: 'cannot_draw',
    participant1_id: p1,
    participant2_id: p2
  }]);
};

// Remover regra
const removeDrawRule = (index: number) => {
  setDrawRules(drawRules.filter((_, i) => i !== index));
};
```

---

### 5. Adicionar useEffect para Carregar Dados

```typescript
useEffect(() => {
  if (isAdmin) {
    fetchSecretSantaConfig();
    fetchAllDraws();
  }
}, [isAdmin]);
```

---

### 6. Adicionar Nova Tab no Header

```typescript
// No array de tabs, adicionar:
{isAdmin && (
  <button
    onClick={() => setActiveTab('secret-santa')}
    className={`px-4 py-2 rounded-lg transition-colors ${
      activeTab === 'secret-santa'
        ? 'bg-red-500 text-white'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`}
  >
    🎁 Amigo Oculto
  </button>
)}
```

---

### 7. Adicionar Conteúdo da Tab (Admin)

```tsx
{activeTab === 'secret-santa' && isAdmin && (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold text-white mb-6">🎁 Amigo Oculto</h2>
    
    {/* Status do Sorteio */}
    {secretSantaConfig ? (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold text-green-600 mb-4">✅ Sorteio Ativo</h3>
        <p className="text-gray-700">Data do sorteio: {new Date(secretSantaConfig.draw_date).toLocaleDateString()}</p>
        {secretSantaConfig.min_gift_value && (
          <p className="text-gray-700">Valor: R$ {secretSantaConfig.min_gift_value} - R$ {secretSantaConfig.max_gift_value}</p>
        )}
        <button
          onClick={async () => {
            if (confirm('Cancelar sorteio atual?')) {
              await fetch('/api/secret-santa', { method: 'DELETE' });
              await fetchSecretSantaConfig();
              setSecretSantaConfig(null);
            }
          }}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Cancelar Sorteio
        </button>
      </div>
    ) : (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-4">Configurar Sorteio</h3>
        
        {/* Valor do Presente */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Valor Mínimo (R$)</label>
            <input
              type="number"
              value={minGiftValue}
              onChange={(e) => setMinGiftValue(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Valor Máximo (R$)</label>
            <input
              type="number"
              value={maxGiftValue}
              onChange={(e) => setMaxGiftValue(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        
        {/* Regras */}
        <div className="mb-4">
          <h4 className="font-bold mb-2">Regras (quem NÃO pode tirar quem)</h4>
          <div className="space-y-2">
            {drawRules.map((rule, idx) => {
              const p1 = participants.find(p => p.id === rule.participant1_id);
              const p2 = participants.find(p => p.id === rule.participant2_id);
              return (
                <div key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                  <span>{p1?.name} ↔ {p2?.name}</span>
                  <button
                    onClick={() => removeDrawRule(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Adicionar Regra */}
          <div className="mt-2 flex gap-2">
            <select
              onChange={(e) => {
                const p1 = Number(e.target.value);
                if (p1) {
                  const p2Select = document.getElementById('p2-select') as HTMLSelectElement;
                  const p2 = Number(p2Select.value);
                  if (p2 && p1 !== p2) {
                    addDrawRule(p1, p2);
                    e.target.value = '';
                    p2Select.value = '';
                  }
                }
              }}
              className="flex-1 px-3 py-2 border rounded-lg"
            >
              <option value="">Pessoa 1</option>
              {participants.filter(p => p.paid).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              id="p2-select"
              className="flex-1 px-3 py-2 border rounded-lg"
            >
              <option value="">Pessoa 2</option>
              {participants.filter(p => p.paid).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={performDraw}
          className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold"
        >
          🎲 Fazer Sorteio
        </button>
        
        <p className="text-sm text-gray-600 mt-2">
          Apenas participantes que pagaram entrarão no sorteio ({participants.filter(p => p.paid).length} pessoas)
        </p>
      </div>
    )}
    
    {/* Resultado do Sorteio */}
    {allDraws.length > 0 && (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-4">Resultado do Sorteio</h3>
        <div className="space-y-2">
          {allDraws.map((draw, idx) => (
            <div key={idx} className="flex items-center justify-between bg-gray-100 p-3 rounded">
              <span className="font-medium">{draw.giver_name}</span>
              <span className="text-gray-500">→</span>
              <span className="font-medium">{draw.receiver_name}</span>
              {draw.revealed && <span className="text-green-500 text-sm">✓ Revelado</span>}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

---

### 8. Adicionar Tab para Participantes (Exemplo Simplificado)

```tsx
{/* Adicionar botão no header público */}
<button
  onClick={() => {
    const id = prompt('Digite seu ID de participante:');
    if (id) {
      setSelectedParticipantId(Number(id));
      setActiveTab('my-secret-santa');
      fetchMyDraw(Number(id));
      fetchWishList(Number(id));
    }
  }}
  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
>
  🎁 Meu Amigo Oculto
</button>

{/* Conteúdo da tab */}
{activeTab === 'my-secret-santa' && selectedParticipantId && (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold text-white mb-6">🎁 Meu Amigo Oculto</h2>
    
    {/* Revelar */}
    {myDraw && !myDraw.revealed && (
      <button
        onClick={() => revealMyDraw(selectedParticipantId)}
        className="w-full px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold text-xl"
      >
        🎁 Revelar Meu Amigo Oculto
      </button>
    )}
    
    {myDraw && myDraw.revealed && (
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-2xl font-bold text-green-600 mb-2">Você tirou:</h3>
        <p className="text-3xl font-bold">{myDraw.receiver_name}</p>
      </div>
    )}
    
    {/* Lista de Desejos */}
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-xl font-bold mb-4">Minha Lista de Desejos</h3>
      {/* Formulário e lista aqui */}
    </div>
  </div>
)}
```

---

## 🎯 Próximos Passos

1. Copiar e colar os códigos acima no `page.tsx`
2. Ajustar estilos conforme necessário
3. Testar fluxo completo
4. Adicionar autenticação individual (opcional)

---

**Pronto para usar! 🎁✨**
