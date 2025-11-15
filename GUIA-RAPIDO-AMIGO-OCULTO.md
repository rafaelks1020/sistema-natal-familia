# 🎁 Guia Rápido - Amigo Oculto

## 🚀 Setup Inicial (5 minutos)

### 1. Executar SQL no Banco
1. Acesse https://console.neon.tech
2. Abra seu projeto
3. Vá em "SQL Editor"
4. Copie todo o conteúdo de `AMIGO-OCULTO.sql`
5. Cole e execute
6. ✅ Pronto! 3 tabelas criadas

### 2. Testar APIs (Opcional)
```bash
# Fazer sorteio de teste
curl -X POST http://localhost:3000/api/secret-santa \
  -H "Content-Type: application/json" \
  -d '{
    "action": "draw",
    "rules": [],
    "min_gift_value": 50,
    "max_gift_value": 150
  }'

# Ver resultado
curl http://localhost:3000/api/secret-santa?action=all-draws
```

---

## 🎯 Como Usar (Fluxo Completo)

### Fase 1: Admin Faz o Sorteio

1. **Login como Admin**
2. **Ir na tab "Amigo Oculto"**
3. **Configurar:**
   - Valor mínimo/máximo do presente
   - Adicionar regras (ex: casais não podem tirar um ao outro)
4. **Clicar em "Fazer Sorteio"**
5. ✅ Sistema sorteia automaticamente

**Regras do Sorteio:**
- Apenas quem **pagou** entra no sorteio
- Mínimo **3 participantes**
- Ninguém tira a si mesmo
- Respeita regras customizadas

---

### Fase 2: Participantes Adicionam Desejos

Cada participante:
1. Acessa o sistema
2. Clica em "Meu Amigo Oculto"
3. Adiciona itens à lista de desejos:
   - Nome do item
   - Descrição (opcional)
   - Link (opcional)
   - Prioridade (1=baixa, 2=média, 3=alta)

---

### Fase 3: Participantes Revelam

1. Clica em "Revelar Meu Amigo Oculto"
2. Sistema mostra quem tirou
3. Sistema mostra lista de desejos da pessoa
4. Pode marcar itens como "comprado"

---

## 🎨 Exemplo de Uso Real

### Cenário: Família Silva

**Participantes que pagaram:**
- João (casado com Maria)
- Maria (casada com João)
- Pedro
- Ana
- Carlos

**Admin (João) configura:**
```
Valor: R$ 50 - R$ 150
Regras: João ↔ Maria (não podem tirar um ao outro)
```

**Sorteio possível:**
```
João → Pedro
Maria → Carlos
Pedro → Ana
Ana → João
Carlos → Maria
```

**Todos formam um ciclo completo!** ✅

---

## 🔐 Níveis de Acesso

### Visitante (Público)
- ❌ Não vê nada do amigo oculto

### Participante (Com ID)
- ✅ Sua lista de desejos
- ✅ Seu amigo oculto (após revelar)
- ✅ Lista de desejos do seu amigo
- ❌ Não vê outros sorteios

### Admin
- ✅ Fazer/cancelar sorteios
- ✅ Ver todos os sorteios
- ✅ Ver todas as listas
- ✅ Configurar regras

---

## ⚠️ Problemas Comuns

### "É necessário pelo menos 3 participantes"
**Causa:** Menos de 3 pessoas marcadas como "pago"
**Solução:** Marque mais participantes como pagos

### "João não tem ninguém para tirar"
**Causa:** Regras muito restritivas
**Solução:** Remova algumas regras ou adicione mais participantes

### "Não foi possível realizar o sorteio"
**Causa:** Combinação impossível de regras
**Solução:** Simplifique as regras

**Exemplo de regras impossíveis:**
```
4 participantes: A, B, C, D
Regras:
- A ↔ B (não podem tirar um ao outro)
- A ↔ C (não podem tirar um ao outro)
- A ↔ D (não podem tirar um ao outro)

Resultado: A não tem ninguém para tirar! ❌
```

---

## 🧪 Testar Algoritmo

Você pode testar o algoritmo localmente:

```typescript
import { drawSecretSanta } from '@/app/lib/secretSanta';

const participants = [
  { id: 1, name: 'João' },
  { id: 2, name: 'Maria' },
  { id: 3, name: 'Pedro' },
  { id: 4, name: 'Ana' }
];

const rules = [
  { type: 'cannot_draw', participant1_id: 1, participant2_id: 2 }
];

try {
  const result = drawSecretSanta(participants, rules);
  console.log('✅ Sorteio válido:', result);
} catch (error) {
  console.error('❌ Erro:', error.message);
}
```

---

## 📊 Estrutura do Banco

```
secret_santa_config (configuração)
├── id
├── year
├── is_active (apenas 1 ativo por vez)
├── draw_date
├── min_gift_value
├── max_gift_value
└── rules (JSON)

secret_santa_draws (sorteios)
├── id
├── config_id → secret_santa_config
├── giver_id → participants
├── receiver_id → participants
├── revealed (boolean)
└── revealed_at

wish_list (desejos)
├── id
├── participant_id → participants
├── config_id → secret_santa_config
├── item_name
├── item_description
├── item_url
├── priority (1, 2, 3)
└── purchased (boolean)
```

---

## 🎯 Checklist de Deploy

- [ ] SQL executado no Neon
- [ ] APIs testadas localmente
- [ ] Interface integrada no `page.tsx`
- [ ] Testado fluxo completo
- [ ] Deploy no Vercel
- [ ] Testar em produção
- [ ] Compartilhar com a família!

---

## 💡 Dicas

### Para o Admin
- Faça o sorteio alguns dias antes do Natal
- Configure um valor justo para todos
- Adicione regras apenas se necessário
- Não revele o sorteio completo para manter o suspense!

### Para Participantes
- Adicione vários itens à lista (dá mais opções)
- Use prioridades (facilita a escolha)
- Adicione links (facilita a compra)
- Marque como comprado para evitar duplicatas

### Segurança
- Cada participante só vê seu próprio sorteio
- Admin vê tudo (é o organizador)
- Sorteio é aleatório e justo
- Impossível manipular o resultado

---

## 🎄 Exemplo de Lista de Desejos

```
Participante: Maria

1. Livro "Receitas Italianas" ⭐⭐⭐ (Alta)
   Link: https://amazon.com.br/...
   
2. Vela aromática de lavanda ⭐⭐ (Média)
   Descrição: Qualquer marca, tamanho médio
   
3. Caneca personalizada ⭐ (Baixa)
   Descrição: Com tema de gatos
```

Quem tirou Maria vê essa lista e escolhe o que comprar!

---

**Feliz Amigo Oculto! 🎁✨**
