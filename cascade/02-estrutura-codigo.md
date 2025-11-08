# 🏗️ 02 - Estrutura do Código

## 📁 Arquitetura de Arquivos

```
sistema-natal-familia/
├── app/
│   ├── api/
│   │   ├── [...slug]/
│   │   │   └── route.ts          # API REST principal (CRUD)
│   │   ├── auth/
│   │   │   └── route.ts          # Autenticação admin
│   │   └── upload/
│   │       └── route.ts          # Upload de imagens
│   ├── page.tsx                  # Página principal (SPA)
│   ├── layout.tsx                # Layout raiz
│   ├── globals.css               # Estilos globais + animações
│   └── favicon.ico               # Ícone do site
├── public/                       # Arquivos estáticos (SVGs)
├── cascade/                      # 📚 Documentação Cascade
├── .env.local                    # Variáveis de ambiente (local)
├── .env.example                  # Template de variáveis
├── .gitignore                    # Arquivos ignorados pelo Git
├── package.json                  # Dependências do projeto
├── tsconfig.json                 # Configuração TypeScript
├── next.config.ts                # Configuração Next.js
├── tailwind.config.js            # Configuração TailwindCSS
├── postcss.config.mjs            # Configuração PostCSS
└── README.md                     # Documentação principal
```

---

## 🎯 Componente Principal: `app/page.tsx`

### Estrutura Geral
O arquivo `page.tsx` é um **SPA (Single Page Application)** que contém:
- Toda a lógica de estado (React hooks)
- Todas as views (Dashboard, Participantes, Compras, Timeline)
- Gerenciamento de autenticação
- Chamadas às APIs
- Renderização de elementos visuais (flocos de neve, estrelas, etc)

### Estados Principais

```typescript
// Autenticação
const [isAdmin, setIsAdmin] = useState(false);
const [showLogin, setShowLogin] = useState(false);
const [password, setPassword] = useState('');

// Navegação
const [activeTab, setActiveTab] = useState('timeline');

// Dados
const [participants, setParticipants] = useState<Participant[]>([]);
const [purchases, setPurchases] = useState<Purchase[]>([]);
const [timeline, setTimeline] = useState<any[]>([]);

// UI
const [loading, setLoading] = useState(false);
const [showAddParticipant, setShowAddParticipant] = useState(false);
const [showAddPurchase, setShowAddPurchase] = useState(false);

// Upload de imagem
const [selectedImage, setSelectedImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string>('');
const [uploadingImage, setUploadingImage] = useState(false);

// Elementos visuais (gerados no cliente)
const [snowflakes, setSnowflakes] = useState<Array<...>>([]);
const [stars, setStars] = useState<Array<...>>([]);
```

### Interfaces TypeScript

```typescript
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
  image_url?: string;
  created_at: string;
}
```

### Hooks useEffect

#### 1. Inicialização
```typescript
useEffect(() => {
  // Verifica se está logado (localStorage)
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken === 'admin-authenticated') {
    setIsAdmin(true);
    setActiveTab('dashboard');
  }
  
  // Gera flocos de neve (apenas no cliente)
  const flakes = Array.from({ length: 20 }, () => ({...}));
  setSnowflakes(flakes);
  
  // Gera estrelas (apenas no cliente)
  const starsList = Array.from({ length: 30 }, () => ({...}));
  setStars(starsList);
}, []);
```

#### 2. Carregamento de Dados
```typescript
useEffect(() => {
  if (isAdmin) {
    fetchParticipants();
    fetchPurchases();
  }
  fetchTimeline();
}, [isAdmin, activeTab]);
```

### Funções Principais

#### Autenticação
```typescript
const handleLogin = async () => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
  
  if (res.ok) {
    localStorage.setItem('adminToken', 'admin-authenticated');
    setIsAdmin(true);
    setActiveTab('dashboard');
  }
};

const handleLogout = () => {
  localStorage.removeItem('adminToken');
  setIsAdmin(false);
  setActiveTab('timeline');
};
```

#### CRUD de Participantes
```typescript
const fetchParticipants = async () => {
  const res = await fetch('/api/participants');
  const data = await res.json();
  setParticipants(data);
};

const addParticipant = async () => {
  await fetch('/api/participants', {
    method: 'POST',
    body: JSON.stringify({ name: newParticipant })
  });
  fetchParticipants();
};

const togglePaid = async (id: number, currentPaid: boolean) => {
  await fetch(`/api/participants/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ paid: !currentPaid })
  });
  fetchParticipants();
};

const deleteParticipant = async (id: number) => {
  await fetch(`/api/participants/${id}`, { method: 'DELETE' });
  fetchParticipants();
};
```

#### CRUD de Compras
```typescript
const fetchPurchases = async () => {
  const res = await fetch('/api/purchases');
  const data = await res.json();
  setPurchases(data);
};

const addPurchase = async () => {
  let imageUrl = '';
  
  // Upload de imagem (se selecionada)
  if (selectedImage) {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', selectedImage);
    
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    imageUrl = uploadData.url;
  }
  
  // Salva compra com URL da imagem
  await fetch('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({ ...newPurchase, image_url: imageUrl })
  });
  
  fetchPurchases();
  fetchTimeline();
};

const deletePurchase = async (id: number) => {
  await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
  fetchPurchases();
  fetchTimeline();
};
```

#### Timeline
```typescript
const fetchTimeline = async () => {
  const res = await fetch('/api/timeline');
  const data = await res.json();
  setTimeline(data);
};
```

#### Upload de Imagem
```typescript
const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setSelectedImage(file);
    
    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};
```

### Cálculos de Métricas

```typescript
const totalContributed = participants.filter(p => p.paid).length * CONTRIBUTION;
const totalSpent = purchases.reduce((sum, p) => sum + Number(p.value), 0);
const balance = totalContributed - totalSpent;
```

---

## 🔌 APIs Backend

### 1. `/api/[...slug]/route.ts` - API Principal

Usa **catch-all route** para lidar com múltiplos endpoints:

#### Estrutura
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { slug: string[] } }) {
  const endpoint = params.slug[0]; // Ex: 'participants', 'purchases', 'timeline'
  
  switch (endpoint) {
    case 'participants': // ...
    case 'purchases': // ...
    case 'timeline': // ...
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string[] } }) {
  // Similar ao GET
}

export async function PUT(request: NextRequest, { params }: { params: { slug: string[] } }) {
  // Similar ao GET
}

export async function DELETE(request: NextRequest, { params }: { params: { slug: string[] } }) {
  // Similar ao GET
}
```

#### Endpoints Implementados

**GET /api/participants**
```typescript
const { rows } = await sql`SELECT * FROM participants ORDER BY name`;
return NextResponse.json(rows);
```

**POST /api/participants**
```typescript
const { name } = await request.json();
await sql`INSERT INTO participants (name) VALUES (${name})`;
return NextResponse.json({ success: true });
```

**PUT /api/participants/[id]**
```typescript
const id = params.slug[1];
const { paid } = await request.json();
const paid_date = paid ? new Date().toISOString() : null;

await sql`
  UPDATE participants 
  SET paid = ${paid}, paid_date = ${paid_date}
  WHERE id = ${id}
`;
```

**DELETE /api/participants/[id]**
```typescript
const id = params.slug[1];
await sql`DELETE FROM participants WHERE id = ${id}`;
```

**GET /api/purchases**
```typescript
const { rows } = await sql`
  SELECT * FROM purchases 
  ORDER BY created_at DESC
`;
return NextResponse.json(rows);
```

**POST /api/purchases**
```typescript
const data = await request.json();

await sql`
  INSERT INTO purchases (
    description, value, category, brand, color, size, 
    quantity, notes, image_url
  ) VALUES (
    ${data.description}, ${data.value}, ${data.category},
    ${data.brand}, ${data.color}, ${data.size},
    ${data.quantity}, ${data.notes}, ${data.image_url}
  )
`;
```

**DELETE /api/purchases/[id]**
```typescript
const id = params.slug[1];
await sql`DELETE FROM purchases WHERE id = ${id}`;
```

**GET /api/timeline**
```typescript
const { rows } = await sql`
  SELECT 
    id, 'participant' as type, name as description,
    NULL as value, paid_date as date,
    paid, NULL as category, NULL as brand, NULL as color,
    NULL as size, NULL as quantity, NULL as notes, NULL as image_url
  FROM participants
  WHERE paid = true
  
  UNION ALL
  
  SELECT 
    id, 'purchase' as type, description,
    value, created_at as date,
    NULL as paid, category, brand, color, size, quantity, notes, image_url
  FROM purchases
  
  ORDER BY date DESC
`;
return NextResponse.json(rows);
```

---

### 2. `/api/auth/route.ts` - Autenticação

```typescript
import { NextRequest, NextResponse } from 'next/server';

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

---

### 3. `/api/upload/route.ts` - Upload de Imagens

```typescript
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return NextResponse.json(
      { error: 'Nenhum arquivo enviado' },
      { status: 400 }
    );
  }
  
  const blob = await put(file.name, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  
  return NextResponse.json({ url: blob.url });
}
```

---

## 🎨 Estilos: `app/globals.css`

### Estrutura
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Animações customizadas */
@keyframes snowfall { ... }
@keyframes sleighFly { ... }
@keyframes sparkle { ... }

/* Classes utilitárias */
.animate-snowfall { ... }
.animate-sleighFly { ... }
.animate-sparkle { ... }
```

### Animações Principais

#### 1. Flocos de Neve
```css
@keyframes snowfall {
  0% {
    transform: translateY(-100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}
```

#### 2. Trenó Voador
```css
@keyframes sleighFly {
  0% {
    left: -200px;
    top: 20%;
  }
  50% {
    left: 50%;
    top: calc(20% - 30px);
  }
  100% {
    left: calc(100% + 200px);
    top: 20%;
  }
}
```

#### 3. Estrelas Piscantes
```css
@keyframes sparkle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}
```

---

## 🎄 Elementos Visuais

### Fundo Natalino (em `page.tsx`)

```tsx
{/* Fundo gradiente */}
<div className="fixed inset-0 bg-gradient-to-b from-purple-900 via-indigo-900 to-purple-900" />

{/* Montanhas nevadas (SVG) */}
<svg className="absolute bottom-0 w-full h-64 opacity-20">
  <path d="M0,200 L200,50 L400,150 L600,80 L800,140 L1000,100 L1200,160 L1400,120 L1600,180 L1920,200 L1920,300 L0,300 Z" 
        fill="white" opacity="0.3"/>
  <path d="M0,250 L150,120 L350,180 L550,130 L750,170 L950,140 L1150,190 L1350,160 L1550,200 L1920,250 L1920,300 L0,300 Z" 
        fill="white" opacity="0.2"/>
</svg>

{/* Lua */}
<div className="absolute top-20 right-20 w-32 h-32 rounded-full bg-yellow-100 opacity-40" />

{/* Casas */}
<div className="absolute bottom-32 left-10 text-6xl opacity-20">🏠❄️</div>
<div className="absolute bottom-32 right-10 text-6xl opacity-20">🏘️</div>

{/* Árvores */}
<div className="absolute bottom-40 left-1/4 text-8xl opacity-25 animate-pulse">🎄</div>
<div className="absolute bottom-40 right-1/3 text-7xl opacity-25 animate-pulse">🎄</div>

{/* Trenó voador */}
<div className="fixed animate-sleighFly z-0 text-6xl whitespace-nowrap">
  🦌🦌🛷
</div>

{/* Estrelas piscantes */}
{stars.map((star, i) => (
  <div key={i} 
       className="absolute animate-sparkle text-yellow-200"
       style={{
         left: star.left,
         top: star.top,
         fontSize: star.size,
         animationDelay: `${Math.random() * 5}s`,
         animationDuration: `${2 + Math.random() * 3}s`
       }}>
    ✨
  </div>
))}

{/* Flocos de neve */}
{snowflakes.map((flake, i) => (
  <div key={i}
       className="fixed animate-snowfall text-white opacity-60 pointer-events-none"
       style={{
         left: flake.left,
         fontSize: flake.size,
         animationDuration: flake.duration,
         animationDelay: flake.delay,
         zIndex: 1
       }}>
    ❄
  </div>
))}
```

---

## 📦 Configurações

### `package.json`
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@vercel/blob": "^2.0.0",
    "@vercel/postgres": "^0.10.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.552.0",
    "next": "16.0.1",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### `next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações padrão
};

export default nextConfig;
```

---

**Próximo**: [03 - Funcionalidades](./03-funcionalidades.md)
