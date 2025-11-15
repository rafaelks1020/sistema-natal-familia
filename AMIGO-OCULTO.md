# 🎁 Sistema de Amigo Oculto (Amigo Secreto)

## 🎯 Visão Geral

Sistema completo de amigo oculto integrado ao sistema de Natal, com:
- ✅ **Sorteio justo** com algoritmo validado
- ✅ **Regras customizáveis** (ex: casais não podem tirar um ao outro)
- ✅ **Revelação gradual** (cada pessoa vê apenas seu amigo)
- ✅ **Lista de desejos** por participante
- ✅ **Privacidade total** (ninguém vê o sorteio completo, exceto admin)

---

## 📋 Pré-requisitos

### 1. Executar SQL no Banco de Dados

Execute o arquivo `AMIGO-OCULTO.sql` no seu banco Neon:

```sql
-- Copie e cole todo o conteúdo de AMIGO-OCULTO.sql
-- no SQL Editor do Neon
```

Isso criará 3 novas tabelas:
- `secret_santa_config` - Configuração do sorteio
- `secret_santa_draws` - Resultado do sorteio (quem tirou quem)
- `wish_list` - Lista de desejos dos participantes

---

## 🎲 Como Funciona o Sorteio

### Algoritmo

O sistema usa um algoritmo de **permutação aleatória com validação de ciclo hamiltoniano**:

1. **Embaralha** os participantes aleatoriamente
2. **Valida** se ninguém tirou a si mesmo
3. **Valida** se as regras customizadas foram respeitadas
4. **Valida** se forma um ciclo completo (todos conectados)
5. Se inválido, tenta novamente (até 1000 tentativas)

### Regras Automáticas

- ❌ Ninguém pode tirar a si mesmo
- ✅ Cada pessoa tira exatamente uma pessoa
- ✅ Cada pessoa é tirada por exatamente uma pessoa
- ✅ Forma um ciclo completo (A→B→C→A)

### Regras Customizáveis

Você pode adicionar regras do tipo "X não pode tirar Y":

```typescript
const rules = [
  { 
    type: 'cannot_draw',
    participant1_id: 1, // João
    participant2_id: 2  // Maria
  }
  // João não pode tirar Maria E Maria não pode tirar João
];
```

**Casos de uso:**
- Casais (não podem tirar um ao outro)
- Irmãos (opcional)
- Pessoas que moram juntas
- Qualquer outra restrição

---

## 🚀 Como Usar (Admin)

### 1. Fazer o Sorteio

```typescript
// POST /api/secret-santa
{
  "action": "draw",
  "rules": [
    {
      "type": "cannot_draw",
      "participant1_id": 1,
      "participant2_id": 2
    }
  ],
  "min_gift_value": 50.00,  // Opcional
  "max_gift_value": 150.00, // Opcional
  "reveal_date": "2025-12-24T00:00:00Z" // Opcional
}
```

**Importante:**
- Apenas participantes que **pagaram** entram no sorteio
- Mínimo de **3 participantes** pagos
- Se as regras forem muito restritivas, o sorteio pode falhar

### 2. Ver Todos os Sorteios (Admin)

```typescript
// GET /api/secret-santa?action=all-draws
// Retorna:
[
  {
    "giver_name": "João",
    "receiver_name": "Maria",
    "revealed": false
  },
  ...
]
```

### 3. Cancelar Sorteio

```typescript
// DELETE /api/secret-santa
// Desativa o sorteio atual
```

---

## 👥 Como Usar (Participantes)

### 1. Ver Meu Amigo Oculto

```typescript
// GET /api/secret-santa?action=my-draw&participant_id=1
// Retorna:
{
  "receiver_id": 5,
  "receiver_name": "Maria",
  "revealed": false
}
```

### 2. Marcar como Revelado

```typescript
// POST /api/secret-santa
{
  "action": "reveal",
  "participant_id": 1
}
```

---

## 🎁 Lista de Desejos

### 1. Adicionar Item

```typescript
// POST /api/wishlist
{
  "participant_id": 1,
  "item_name": "Livro de receitas",
  "item_description": "Preferencialmente de massas italianas",
  "item_url": "https://amazon.com.br/...",
  "priority": 3 // 1=baixa, 2=média, 3=alta
}
```

### 2. Ver Minha Lista

```typescript
// GET /api/wishlist?participant_id=1
// Retorna todos os itens do participante
```

### 3. Ver Lista do Meu Amigo Oculto

```typescript
// 1. Buscar quem eu tirei
const draw = await fetch('/api/secret-santa?action=my-draw&participant_id=1');
const { receiver_id } = await draw.json();

// 2. Buscar lista de desejos dessa pessoa
const wishlist = await fetch(`/api/wishlist?participant_id=${receiver_id}`);
```

### 4. Marcar Item como Comprado

```typescript
// PUT /api/wishlist
{
  "id": 1,
  "purchased": true
}
```

### 5. Deletar Item

```typescript
// DELETE /api/wishlist?id=1
```

---

## 🎨 Interface (A Implementar)

### Para Admin

**Nova Tab: "Amigo Oculto"**

1. **Configuração do Sorteio**
   - Botão: "Fazer Sorteio"
   - Inputs: Valor mínimo/máximo do presente
   - Data de revelação
   - Adicionar regras (selecionar pares que não podem tirar um ao outro)

2. **Visualização**
   - Tabela com todos os sorteios (quem tirou quem)
   - Status de revelação
   - Botão: "Cancelar Sorteio"

### Para Participantes

**Nova Tab: "Meu Amigo Oculto"**

1. **Minha Lista de Desejos**
   - Formulário para adicionar itens
   - Lista de itens com prioridade
   - Editar/deletar itens

2. **Meu Amigo Oculto**
   - Botão: "Revelar Meu Amigo Oculto"
   - Após revelar: Nome da pessoa
   - Lista de desejos da pessoa
   - Marcar itens como comprados

---

## 🔐 Privacidade

### O que cada um vê:

**Visitante (sem login):**
- ❌ Nada do amigo oculto

**Participante (com login individual):**
- ✅ Sua própria lista de desejos
- ✅ Seu amigo oculto (após revelar)
- ✅ Lista de desejos do seu amigo oculto
- ❌ Não vê quem tirou quem (exceto o dele)

**Admin:**
- ✅ Tudo (configuração, sorteios, listas)
- ✅ Pode fazer/cancelar sorteios
- ✅ Pode ver todas as listas de desejos

---

## 📊 Fluxo Completo

### Fase 1: Preparação (Admin)
1. Admin marca quem pagou
2. Admin configura regras (casais, etc)
3. Admin faz o sorteio
4. Sistema valida e salva

### Fase 2: Lista de Desejos (Participantes)
1. Cada participante acessa o sistema
2. Adiciona itens à sua lista de desejos
3. Define prioridades

### Fase 3: Revelação (Participantes)
1. Participante clica em "Revelar"
2. Sistema mostra quem ele tirou
3. Sistema mostra lista de desejos da pessoa
4. Participante pode marcar itens como comprados

### Fase 4: Natal! 🎄
1. Troca de presentes
2. Revelação pública (opcional)

---

## ⚠️ Validações e Erros

### Erros Comuns

**"É necessário pelo menos 3 participantes"**
- Solução: Marque mais pessoas como "pago"

**"Impossível sortear: João não tem ninguém para tirar"**
- Solução: Remova algumas regras ou adicione mais participantes

**"Não foi possível realizar o sorteio com as regras definidas"**
- Solução: As regras são muito restritivas, simplifique

### Validação de Regras

Antes de fazer o sorteio, o sistema valida se é possível:

```typescript
import { validateRules } from '@/app/lib/secretSanta';

const validation = validateRules(participants, rules);
if (!validation.valid) {
  console.error(validation.error);
}
```

---

## 🧪 Testes

### Testar Sorteio Localmente

```typescript
import { drawSecretSanta } from '@/app/lib/secretSanta';

const participants = [
  { id: 1, name: 'João' },
  { id: 2, name: 'Maria' },
  { id: 3, name: 'Pedro' },
  { id: 4, name: 'Ana' }
];

const rules = [
  { type: 'cannot_draw', participant1_id: 1, participant2_id: 2 } // João e Maria são casados
];

const result = drawSecretSanta(participants, rules);
console.log(result);
// [
//   { giver_id: 1, receiver_id: 3 }, // João → Pedro
//   { giver_id: 2, receiver_id: 4 }, // Maria → Ana
//   { giver_id: 3, receiver_id: 2 }, // Pedro → Maria
//   { giver_id: 4, receiver_id: 1 }  // Ana → João
// ]
```

---

## 🎯 Próximos Passos

1. ✅ SQL criado
2. ✅ Algoritmo implementado
3. ✅ APIs criadas
4. ⏳ Implementar interface no `page.tsx`
5. ⏳ Adicionar autenticação individual para participantes
6. ⏳ Testar fluxo completo
7. ⏳ Deploy

---

## 💡 Ideias Futuras

- 📧 Enviar email quando o sorteio for feito
- 📱 Notificação quando alguém adiciona item à lista
- 🎨 Tema especial para a página de amigo oculto
- 📊 Estatísticas (quantos revelaram, quantos compraram, etc)
- 🎲 Sorteio ao vivo (animação)
- 🎁 Sugestões de presentes baseadas na lista

---

**Feliz Amigo Oculto! 🎁✨**
