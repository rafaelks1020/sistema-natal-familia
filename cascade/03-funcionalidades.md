# ⚙️ 03 - Funcionalidades

## 🎯 Features Implementadas

### 1. 🏠 Timeline Pública

#### Descrição
Timeline acessível a todos (sem login) que mostra todos os eventos do Natal em ordem cronológica reversa.

#### Tipos de Eventos
1. **Pagamentos de Participantes**
   - Ícone: ✅ Check verde
   - Mostra: Nome do participante + "contribuiu com R$ 50,00"
   - Data: Data do pagamento

2. **Compras Realizadas**
   - Ícone: 🛒 ShoppingCart
   - Mostra: Descrição da compra + valor
   - Detalhes: Categoria, marca, cor, tamanho, quantidade, observações
   - Foto: Imagem em aspect-ratio 16:9 (se disponível)
   - Hover: Zoom suave na foto
   - Data: Data da criação

#### Fluxo de Dados
```
Frontend → GET /api/timeline
Backend → SQL UNION de participants + purchases
PostgreSQL → Retorna dados ordenados por data DESC
Frontend → Renderiza timeline com cards
```

#### SQL da Timeline
```sql
SELECT 
  id, 'participant' as type, name as description,
  NULL as value, paid_date as date, paid,
  NULL as category, NULL as brand, NULL as color,
  NULL as size, NULL as quantity, NULL as notes, NULL as image_url
FROM participants
WHERE paid = true

UNION ALL

SELECT 
  id, 'purchase' as type, description,
  value, created_at as date, NULL as paid,
  category, brand, color, size, quantity, notes, image_url
FROM purchases

ORDER BY date DESC
```

---

### 2. 📊 Dashboard Administrativo

#### Acesso
- Requer login com senha
- Senha configurada em `ADMIN_PASSWORD` (env)
- Token salvo no localStorage

#### Métricas Exibidas

**Card 1: Total Arrecadado** 💰
```typescript
const totalContributed = participants.filter(p => p.paid).length * 50;
```
- Cor: Verde
- Formato: R$ X.XXX,XX

**Card 2: Participantes** 👥
```typescript
const totalParticipants = participants.length;
```
- Cor: Azul
- Formato: XX participantes

**Card 3: Total Gasto** 🛒
```typescript
const totalSpent = purchases.reduce((sum, p) => sum + Number(p.value), 0);
```
- Cor: Roxo
- Formato: R$ X.XXX,XX

**Card 4: Saldo** 💵
```typescript
const balance = totalContributed - totalSpent;
```
- Cor: Verde (positivo) / Vermelho (negativo)
- Formato: R$ X.XXX,XX
- Ícone: AlertCircle se negativo

#### Layout
- Grid responsivo (1 coluna mobile, 4 colunas desktop)
- Cards com backdrop-blur e sombra
- Animações de hover
- Atualização em tempo real

---

### 3. 👥 Gerenciamento de Participantes

#### Funcionalidades

**Listar Participantes**
- Tabela com nome, status de pagamento e ações
- Ordenação alfabética
- Status visual: Badge verde (pago) / cinza (pendente)

**Adicionar Participante**
```typescript
const addParticipant = async () => {
  await fetch('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ name: newParticipant })
  });
};
```
- Modal com input de nome
- Validação: nome não pode estar vazio
- Feedback visual após adicionar

**Marcar como Pago/Pendente**
```typescript
const togglePaid = async (id: number, currentPaid: boolean) => {
  await fetch(`/api/participants/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ 
      paid: !currentPaid,
      paid_date: !currentPaid ? new Date().toISOString() : null
    })
  });
};
```
- Checkbox interativo
- Registra data do pagamento
- Atualiza métricas do dashboard

**Deletar Participante**
```typescript
const deleteParticipant = async (id: number) => {
  if (confirm('Tem certeza?')) {
    await fetch(`/api/participants/${id}`, { method: 'DELETE' });
  }
};
```
- Confirmação antes de deletar
- Remove do banco de dados
- Atualiza lista automaticamente

#### UI
- Tabela responsiva
- Botões com ícones (Lucide React)
- Estados de loading
- Feedback visual (hover, active)

---

### 4. 🛒 Gerenciamento de Compras

#### Funcionalidades

**Listar Compras**
- Grid de cards com informações completas
- Ordenação por data (mais recente primeiro)
- Preview de foto (se disponível)

**Adicionar Compra**
```typescript
const addPurchase = async () => {
  // 1. Upload da imagem (se selecionada)
  let imageUrl = '';
  if (selectedImage) {
    const formData = new FormData();
    formData.append('file', selectedImage);
    
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    imageUrl = data.url;
  }
  
  // 2. Salvar compra com URL da imagem
  await fetch('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({
      description: newPurchase.description,
      value: newPurchase.value,
      category: newPurchase.category,
      brand: newPurchase.brand,
      color: newPurchase.color,
      size: newPurchase.size,
      quantity: newPurchase.quantity,
      notes: newPurchase.notes,
      image_url: imageUrl
    })
  });
};
```

**Campos do Formulário**
- **Descrição*** (obrigatório): Texto livre
- **Valor*** (obrigatório): Número decimal (R$)
- **Categoria**: Select (Decoração, Presentes, Comida, Bebida, Outros)
- **Marca**: Texto livre (opcional)
- **Cor**: Texto livre (opcional)
- **Tamanho**: Texto livre (opcional)
- **Quantidade**: Número inteiro (padrão: 1)
- **Observações**: Textarea (opcional)
- **Foto**: Input file (opcional)

**Preview de Foto**
```typescript
const handleImageSelect = (e) => {
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
```
- Preview local antes do upload
- Aspect-ratio 16:9
- Botão para remover foto

**Deletar Compra**
```typescript
const deletePurchase = async (id: number) => {
  if (confirm('Tem certeza?')) {
    await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
  }
};
```
- Confirmação antes de deletar
- Remove do banco (não remove foto do Blob)
- Atualiza lista e timeline

#### UI
- Modal grande para adicionar compra
- Grid responsivo de cards
- Cards com foto, descrição e detalhes
- Botão de deletar no canto superior direito

---

### 5. 📸 Upload de Fotos

#### Fluxo Completo

**1. Seleção de Arquivo**
```typescript
<input 
  type="file" 
  accept="image/*" 
  onChange={handleImageSelect}
/>
```

**2. Preview Local**
```typescript
const reader = new FileReader();
reader.onloadend = () => {
  setImagePreview(reader.result as string);
};
reader.readAsDataURL(file);
```

**3. Upload para Vercel Blob**
```typescript
// Frontend
const formData = new FormData();
formData.append('file', selectedImage);

const res = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

// Backend (api/upload/route.ts)
import { put } from '@vercel/blob';

const blob = await put(file.name, file, {
  access: 'public',
  token: process.env.BLOB_READ_WRITE_TOKEN,
});

return NextResponse.json({ url: blob.url });
```

**4. Salvar URL no Banco**
```typescript
await sql`
  INSERT INTO purchases (..., image_url)
  VALUES (..., ${imageUrl})
`;
```

**5. Exibir na Timeline**
```tsx
{item.image_url && (
  <div className="relative aspect-video bg-gray-100 overflow-hidden rounded-lg">
    <img 
      src={item.image_url}
      alt={item.description}
      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
    />
  </div>
)}
```

#### Características
- **Formato**: Qualquer imagem (jpg, png, gif, etc)
- **Tamanho**: Sem limite (Vercel Blob)
- **Armazenamento**: Vercel Blob Storage (CDN global)
- **Acesso**: Público (URLs diretas)
- **Preview**: Aspect-ratio 16:9
- **Interação**: Zoom no hover

---

### 6. 🔐 Autenticação

#### Sistema Simples

**Login**
```typescript
const handleLogin = async () => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  
  if (res.ok) {
    localStorage.setItem('adminToken', 'admin-authenticated');
    setIsAdmin(true);
    setActiveTab('dashboard');
  } else {
    setLoginError('Senha incorreta');
  }
};
```

**Logout**
```typescript
const handleLogout = () => {
  localStorage.removeItem('adminToken');
  setIsAdmin(false);
  setActiveTab('timeline');
};
```

**Verificação ao Carregar**
```typescript
useEffect(() => {
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken === 'admin-authenticated') {
    setIsAdmin(true);
    setActiveTab('dashboard');
  }
}, []);
```

#### Backend
```typescript
// api/auth/route.ts
export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'natal2025';
  
  if (password === ADMIN_PASSWORD) {
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json(
    { error: 'Senha incorreta' },
    { status: 401 }
  );
}
```

#### Segurança
- ⚠️ **Básica**: Apenas senha, sem JWT ou sessões
- ✅ **Suficiente**: Para uso familiar privado
- ⚠️ **Não usar**: Em produção pública
- ✅ **Melhorias**: Considerar NextAuth.js para produção

---

### 7. 🎨 Tema Natalino 3D

#### Elementos Visuais

**Fundo**
- Gradiente roxo/índigo escuro (céu noturno)
- SVG de montanhas nevadas
- Lua cheia no topo direito

**Animações**

1. **Flocos de Neve** ❄️
   - Quantidade: 20 flocos
   - Animação: Queda suave com rotação
   - Duração: 10-30s (aleatório)
   - Opacity: 0.6
   - z-index: 1 (atrás do conteúdo)

2. **Trenó Voador** 🛷
   - Elementos: 🦌🦌🛷
   - Animação: Voa da esquerda para direita
   - Movimento: Arco (sobe no meio)
   - Duração: 30s
   - Loop: Infinito

3. **Estrelas Piscantes** ✨
   - Quantidade: 30 estrelas
   - Animação: Fade in/out + scale
   - Duração: 2-5s (aleatório)
   - Delays: Aleatórios
   - Opacity: 0.3

4. **Árvores de Natal** 🎄
   - Quantidade: 2 árvores grandes
   - Animação: Pulse (TailwindCSS)
   - Duração: 3-4s
   - Opacity: 0.25

5. **Casas com Neve** 🏠
   - Elementos: 🏠❄️ e 🏘️
   - Posição: Cantos inferiores
   - Opacity: 0.2

#### Hierarquia Z-Index
```
z-index: 50   → Header sticky
z-index: 10   → Conteúdo (cards, timeline)
z-index: 1    → Flocos de neve
z-index: 0    → Elementos de fundo
```

#### Performance
- **Otimizações**:
  - Apenas 20 flocos (vs 50 inicial)
  - Animações CSS (GPU-aceleradas)
  - SVG para montanhas (leve)
  - Emojis para elementos (sem imagens)
  - z-index correto (sem sobreposição)

---

### 8. 📱 Responsividade

#### Breakpoints (TailwindCSS)
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

#### Adaptações

**Header**
- Mobile: Logo + botão Admin (stack vertical)
- Desktop: Logo + navegação + botão Admin (horizontal)

**Dashboard**
- Mobile: 1 coluna (cards empilhados)
- Desktop: 4 colunas (grid)

**Timeline**
- Mobile: Cards full-width
- Desktop: Cards com max-width

**Tabelas**
- Mobile: Scroll horizontal
- Desktop: Tabela completa

**Modais**
- Mobile: Full-screen
- Desktop: Centralizado com max-width

---

### 9. 🎯 UX/UI

#### Princípios de Design

**Minimalismo**
- Sem elementos desnecessários
- Foco no conteúdo
- Espaçamento generoso

**Feedback Visual**
- Hover states em todos os botões
- Loading states durante operações
- Confirmações antes de deletar
- Mensagens de erro claras

**Animações Suaves**
- Transições de 200-300ms
- Easing natural (ease-in-out)
- Sem animações bruscas

**Cores Natalinas**
- Vermelho: Alertas e destaques
- Verde: Sucesso e confirmações
- Roxo/Índigo: Fundo e cards
- Branco: Texto e elementos

**Tipografia**
- Font: Inter (system font fallback)
- Tamanhos: text-sm a text-4xl
- Pesos: font-normal a font-bold

---

### 10. ⚡ Performance

#### Otimizações Implementadas

**Frontend**
- React 19 (Concurrent Features)
- Next.js 16 (App Router otimizado)
- TailwindCSS 4 (JIT compiler)
- Lazy loading de imagens

**Backend**
- Serverless functions (Vercel)
- PostgreSQL com índices
- Queries otimizadas
- CDN global (Vercel Edge)

**Imagens**
- Vercel Blob (CDN global)
- Aspect-ratio CSS (sem layout shift)
- Object-fit: cover (sem distorção)

**Animações**
- CSS animations (GPU-aceleradas)
- transform e opacity (performáticas)
- will-change quando necessário

---

## 🔄 Fluxos de Uso

### Fluxo 1: Visitante Ver Timeline
```
1. Acessa URL pública
2. Vê timeline automaticamente (tab padrão)
3. Scroll pela timeline
4. Hover nas fotos para zoom
5. Vê detalhes das compras
```

### Fluxo 2: Admin Adicionar Participante
```
1. Clica em "Admin"
2. Modal de login aparece
3. Digita senha
4. Entra no dashboard
5. Clica em "Participantes" (tab)
6. Clica em "Adicionar Participante"
7. Digita nome
8. Clica em "Adicionar"
9. Participante aparece na lista
```

### Fluxo 3: Admin Marcar Pagamento
```
1. Está na tab "Participantes"
2. Vê lista de participantes
3. Clica no checkbox do participante
4. Status muda para "Pago" (badge verde)
5. Data de pagamento é registrada
6. Métricas do dashboard atualizam
7. Evento aparece na timeline
```

### Fluxo 4: Admin Adicionar Compra com Foto
```
1. Está na tab "Compras"
2. Clica em "Adicionar Compra"
3. Modal grande aparece
4. Preenche descrição e valor (obrigatórios)
5. Seleciona categoria
6. Preenche detalhes opcionais (marca, cor, etc)
7. Clica em "Escolher arquivo"
8. Seleciona imagem do computador
9. Vê preview da foto
10. Clica em "Adicionar"
11. Loading aparece durante upload
12. Foto é enviada para Vercel Blob
13. URL é salva no banco
14. Compra aparece na lista
15. Compra aparece na timeline com foto
```

### Fluxo 5: Admin Deletar Compra
```
1. Está na tab "Compras"
2. Vê card da compra
3. Clica no botão X (canto superior direito)
4. Confirmação aparece
5. Confirma
6. Compra é removida do banco
7. Lista atualiza
8. Timeline atualiza
```

---

**Próximo**: [04 - Próximos Passos](./04-proximos-passos.md)
