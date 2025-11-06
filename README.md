# 🎄 Natal em Família 2025

Sistema para organizar o Natal da família com controle de contribuições, compras e timeline.

## 🚀 Deploy Rápido

1. **Acesse:** https://vercel.com/new
2. **Importe este projeto**
3. **Configure as variáveis** (veja `VARIAVEIS-VERCEL.txt`)
4. **Deploy!**

## 🗄️ SQL do Banco (Neon)

```sql
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_date TIMESTAMP
);

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

## 💻 Local

```bash
npm install
npm run dev
```

Senha admin padrão: `natal2025`
