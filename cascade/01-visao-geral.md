# 📖 01 - Visão Geral do Sistema

## 🎯 Propósito

Sistema web para organizar o Natal da família, permitindo:
- Controlar contribuições financeiras dos participantes (R$ 50 por pessoa)
- Gerenciar compras de presentes e decorações
- Exibir timeline pública com fotos das compras
- Dashboard administrativo para controle total

---

## 👥 Personas

### Visitante (Família)
- **Acesso**: Público, sem login
- **Pode ver**:
  - Timeline completa de eventos
  - Fotos das compras
  - Progresso das contribuições
  - Detalhes das compras (marca, cor, tamanho)

### Administrador
- **Acesso**: Requer senha (configurada em `.env.local`)
- **Pode fazer**:
  - Ver dashboard com métricas
  - Adicionar/remover participantes
  - Marcar pagamentos
  - Adicionar compras com upload de fotos
  - Deletar compras
  - Ver tudo que o visitante vê

---

## 🛠️ Stack Tecnológica

### Frontend
- **Next.js 16.0.1** - Framework React com App Router
- **React 19.2.0** - Biblioteca UI
- **TypeScript 5** - Tipagem estática
- **TailwindCSS 4** - Estilização utility-first
- **Lucide React 0.552.0** - Ícones modernos

### Backend
- **Next.js API Routes** - Serverless functions
- **@vercel/postgres 0.10.0** - Cliente PostgreSQL
- **Neon PostgreSQL** - Banco de dados serverless

### Storage
- **@vercel/blob 2.0.0** - Upload e armazenamento de imagens

### Utilitários
- **date-fns 4.1.0** - Manipulação de datas

---

## 🗄️ Modelo de Dados

### Tabela: `participants`
```sql
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_date TIMESTAMP
);
```

**Campos**:
- `id`: Identificador único
- `name`: Nome do participante
- `paid`: Status de pagamento (true/false)
- `paid_date`: Data do pagamento (quando marcado como pago)

### Tabela: `purchases`
```sql
CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  category TEXT,
  brand TEXT,
  color TEXT,
  size TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Campos**:
- `id`: Identificador único
- `description`: Descrição da compra
- `value`: Valor em reais
- `category`: Categoria (Decoração, Presentes, Comida, Bebida, Outros)
- `brand`: Marca do produto (opcional)
- `color`: Cor do produto (opcional)
- `size`: Tamanho do produto (opcional)
- `quantity`: Quantidade comprada
- `notes`: Observações adicionais (opcional)
- `image_url`: URL da foto no Vercel Blob (opcional)
- `created_at`: Data/hora da criação

---

## 🎨 Características Visuais

### Tema Natalino 3D
O sistema possui um visual imersivo com:
- **Fundo**: Gradiente roxo/índigo escuro (céu noturno)
- **Flocos de neve**: 20 flocos animados caindo suavemente (z-index: 1)
- **Trenó voador**: Papai Noel com renas atravessando a tela (30s loop)
- **Montanhas**: SVG de montanhas nevadas no fundo
- **Lua cheia**: Posicionada no topo direito
- **Estrelas**: 30 estrelas piscantes com delays aleatórios
- **Árvores de Natal**: 2 árvores grandes com animação pulse
- **Casas com neve**: Elementos decorativos no rodapé

### Hierarquia Visual (z-index)
```
z-index: 50   - Header sticky
z-index: 10   - Conteúdo (cards, timeline)
z-index: 1    - Flocos de neve
z-index: 0    - Elementos de fundo (trenó, montanhas, etc)
```

### Responsividade
- Mobile-first design
- Cards adaptáveis
- Timeline responsiva
- Imagens em aspect-ratio 16:9

---

## 🔐 Autenticação

### Sistema Simples
- **Método**: Senha única para admin
- **Storage**: localStorage (token: `admin-authenticated`)
- **Variável**: `ADMIN_PASSWORD` em `.env.local`
- **Padrão**: `natal2025` (deve ser alterado em produção)

### Fluxo de Login
1. Usuário clica em "Admin"
2. Modal de login aparece
3. Digita senha
4. Frontend envia POST para `/api/auth`
5. Backend valida com `process.env.ADMIN_PASSWORD`
6. Se correto: retorna `{ success: true }`
7. Frontend salva token no localStorage
8. Redireciona para dashboard

---

## 📊 Métricas do Dashboard

### Cards Principais
1. **Total Arrecadado**
   - Soma: `participantes pagos × R$ 50`
   - Ícone: 💰 DollarSign

2. **Participantes**
   - Total de participantes cadastrados
   - Ícone: 👥 Users

3. **Total Gasto**
   - Soma de todos os valores de compras
   - Ícone: 🛒 ShoppingCart

4. **Saldo**
   - Cálculo: `Total Arrecadado - Total Gasto`
   - Cor: Verde (positivo) / Vermelho (negativo)
   - Ícone: 💵 DollarSign

---

## 🌐 Deploy

### Plataforma: Vercel
- Deploy automático via Git
- Serverless functions para APIs
- Edge Network global
- SSL automático

### Variáveis de Ambiente Necessárias
```env
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
ADMIN_PASSWORD=sua_senha_aqui
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### Configuração do Banco (Neon)
1. Criar conta no Neon (https://neon.tech)
2. Criar novo projeto
3. Copiar connection string
4. Executar SQL do schema (veja README.md)
5. Adicionar URLs nas variáveis da Vercel

---

## 🎯 Casos de Uso Principais

### UC1: Visitante Ver Timeline
1. Acessa URL pública
2. Vê timeline com todas as compras
3. Visualiza fotos em 16:9
4. Hover nas fotos para zoom

### UC2: Admin Adicionar Participante
1. Login como admin
2. Vai em "Participantes"
3. Clica em "Adicionar Participante"
4. Digita nome
5. Salva
6. Participante aparece na lista

### UC3: Admin Adicionar Compra com Foto
1. Login como admin
2. Vai em "Compras"
3. Clica em "Adicionar Compra"
4. Preenche dados (descrição, valor, categoria, etc)
5. Clica em "Escolher arquivo"
6. Seleciona imagem
7. Vê preview
8. Salva
9. Foto é enviada para Vercel Blob
10. URL é salva no banco
11. Compra aparece na timeline com foto

### UC4: Admin Marcar Pagamento
1. Login como admin
2. Vai em "Participantes"
3. Clica no checkbox do participante
4. Status muda para "pago"
5. Data de pagamento é registrada
6. Métricas do dashboard atualizam

---

## 📈 Fluxo de Dados

### Timeline Pública
```
Frontend (page.tsx)
  ↓ GET /api/timeline
Backend (api/[...slug]/route.ts)
  ↓ SQL Query (JOIN participants + purchases)
PostgreSQL (Neon)
  ↓ Retorna dados ordenados por data
Frontend
  ↓ Renderiza timeline com fotos
Usuário visualiza
```

### Upload de Foto
```
Frontend (page.tsx)
  ↓ Usuário seleciona arquivo
  ↓ Preview local (FileReader)
  ↓ POST /api/upload (FormData)
Backend (api/upload/route.ts)
  ↓ put() para Vercel Blob
Vercel Blob Storage
  ↓ Retorna URL pública
Backend
  ↓ { url: "https://..." }
Frontend
  ↓ Salva URL em newPurchase.image_url
  ↓ POST /api/purchases
Backend (api/[...slug]/route.ts)
  ↓ INSERT com image_url
PostgreSQL (Neon)
  ↓ Compra salva com foto
Timeline atualiza
```

---

## 🎄 Filosofia de Design

### Princípios
1. **Simplicidade**: Interface intuitiva, sem complexidade desnecessária
2. **Visual Imersivo**: Tema natalino completo sem comprometer usabilidade
3. **Performance**: Animações GPU-aceleradas, otimização de imagens
4. **Acessibilidade**: Contraste adequado, textos legíveis
5. **Mobile-First**: Funciona perfeitamente em smartphones

### Inspirações
- **Linear**: Timeline limpa e elegante
- **Notion**: Cards organizados e minimalistas
- **Stripe**: Dashboard com métricas claras
- **Vercel**: Animações suaves e modernas

---

**Próximo**: [02 - Estrutura do Código](./02-estrutura-codigo.md)
