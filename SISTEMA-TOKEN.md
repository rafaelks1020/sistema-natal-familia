# 🎫 Sistema de Tokens - Amigo Oculto

## 🎯 Como Funciona

Agora o sistema usa **tokens individuais** ao invés de mostrar o resultado completo do sorteio!

### ✨ Vantagens:
- ✅ **Mais privado**: Ninguém vê quem tirou quem (nem o admin!)
- ✅ **Mais seguro**: Cada pessoa só descobre seu próprio amigo oculto
- ✅ **Mais justo**: Impossível trapacear ou espiar
- ✅ **Mais prático**: Basta compartilhar um código de 8 letras

---

## 🔄 Migração (Se Já Criou a Tabela)

Se você já executou o SQL anterior **SEM o campo token**, execute:

```sql
-- Copie e cole o conteúdo de MIGRACAO-TOKEN.sql no Neon
```

Se está criando pela **primeira vez**, use o `AMIGO-OCULTO.sql` atualizado.

---

## 👨‍💼 Para o Admin

### 1. Fazer o Sorteio

1. Login como admin
2. Vá na tab **"🎅 Amigo Oculto"**
3. Configure valor do presente e regras
4. Clique em **"🎲 Fazer Sorteio"**

### 2. Distribuir os Tokens

Após o sorteio, você verá uma lista assim:

```
🎫 Tokens para Distribuir

João
┌─────────────────┐
│   ABC12345      │  [📋 Copiar]
└─────────────────┘

Maria
┌─────────────────┐
│   XYZ98765      │  [📋 Copiar]
└─────────────────┘
```

### 3. Como Entregar os Tokens

**Opção 1: WhatsApp/Telegram**
```
Olá João! 🎁

Seu token do amigo oculto é: ABC12345

Acesse o site e clique em "Meu Amigo Oculto" 
para descobrir quem você tirou!
```

**Opção 2: Papel**
```
✂️ Imprima e recorte:

┌─────────────────────┐
│  AMIGO OCULTO 2025  │
│                     │
│  João               │
│  Token: ABC12345    │
│                     │
│  Use no site! 🎁    │
└─────────────────────┘
```

**Opção 3: Email**
- Copie o token
- Envie por email individual
- Não envie em grupo!

---

## 👤 Para os Participantes

### 1. Acessar o Site

Abra o site do Natal da família

### 2. Clicar em "Meu Amigo Oculto"

No header, clique no botão roxo **"🎁 Meu Amigo Oculto"**

### 3. Digitar o Token

```
┌─────────────────────────────────┐
│ Digite seu token (ex: ABC12345) │
│                                 │
│         ABC12345                │
│                                 │
│      [🎁 Revelar]               │
└─────────────────────────────────┘
```

### 4. Descobrir Seu Amigo Oculto!

```
Olá, João!

Você tirou:

╔═══════════════════╗
║                   ║
║     MARIA         ║
║                   ║
║ 🎁 Seu amigo oculto! ║
╚═══════════════════╝

💰 Valor sugerido: R$ 50 - R$ 150
```

---

## 🔐 Segurança

### O que o Admin Vê:
- ✅ Lista de tokens
- ✅ Nome de quem recebeu cada token
- ❌ **NÃO vê** quem tirou quem

### O que Cada Participante Vê:
- ✅ Apenas seu próprio amigo oculto
- ❌ **NÃO vê** outros sorteios
- ❌ **NÃO vê** quem tirou ele

### Tokens:
- 🔒 Únicos (8 caracteres aleatórios)
- 🔒 Impossível adivinhar
- 🔒 Uso único (cada token revela apenas 1 pessoa)

---

## 📝 Exemplo Completo

### Cenário:
5 participantes: João, Maria, Pedro, Ana, Carlos

### Admin faz sorteio:
```
Sistema gera:
- João → Token: ABC12345
- Maria → Token: XYZ98765
- Pedro → Token: QWE45678
- Ana → Token: RTY12389
- Carlos → Token: UIO56790
```

### Admin distribui:
```
WhatsApp para João: "Seu token: ABC12345"
WhatsApp para Maria: "Seu token: XYZ98765"
WhatsApp para Pedro: "Seu token: QWE45678"
...
```

### Participantes revelam:
```
João digita ABC12345 → Descobre que tirou Pedro
Maria digita XYZ98765 → Descobre que tirou Ana
Pedro digita QWE45678 → Descobre que tirou Carlos
...
```

### Resultado:
- ✅ Cada um sabe apenas quem tirou
- ✅ Ninguém sabe quem tirou ele
- ✅ Admin não vê o resultado completo
- ✅ Sorteio justo e secreto!

---

## ❓ FAQ

**P: E se alguém perder o token?**
R: Admin pode copiar novamente da lista e reenviar

**P: Posso usar o mesmo token duas vezes?**
R: Sim! O token sempre revela a mesma pessoa

**P: O admin pode ver quem tirou quem?**
R: Não! O admin só vê os tokens, não o resultado

**P: E se eu quiser ver de novo?**
R: Basta digitar o token novamente

**P: Preciso estar logado?**
R: Não! Qualquer pessoa com o token pode revelar

**P: O token expira?**
R: Não! Funciona até o sorteio ser cancelado

---

## 🎄 Pronto para Usar!

O sistema está **100% funcional** com tokens!

**Próximos passos:**
1. ✅ Execute a migração SQL (se necessário)
2. ✅ Faça o sorteio como admin
3. ✅ Distribua os tokens
4. ✅ Aguarde as revelações!

**Feliz Amigo Oculto! 🎁✨**
