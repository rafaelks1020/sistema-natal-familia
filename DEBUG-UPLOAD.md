# 🔧 Debug do Upload de Fotos

## ❌ Erro: "Erro ao fazer upload"

### 🔍 Possíveis Causas:

#### 1. Token do Vercel Blob Inválido
**Sintoma:** Erro 401 ou 403
**Solução:**
```bash
# Gerar novo token em: https://vercel.com/dashboard/stores
# Copiar e colar no .env.local
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_NOVO_TOKEN_AQUI
```

#### 2. Servidor não reiniciado após configurar .env
**Sintoma:** Token não encontrado
**Solução:**
```bash
# Parar o servidor (Ctrl+C)
# Reiniciar
npm run dev
```

#### 3. Arquivo muito grande
**Sintoma:** Timeout ou erro de memória
**Solução:**
- Vercel Blob tem limite de 4.5MB por arquivo no plano free
- Redimensione a imagem antes de fazer upload

#### 4. Formato de arquivo não suportado
**Sintoma:** Erro ao processar arquivo
**Solução:**
- Use: JPG, PNG, GIF, WEBP
- Evite: BMP, TIFF, RAW

---

## 🔍 Como Debugar:

### 1. Abra o Console do Navegador (F12)
Procure por:
```
📤 Enviando arquivo: foto.jpg 123456 bytes
❌ Erro na resposta: {error: "...", details: "..."}
```

### 2. Verifique o Terminal do Servidor
Procure por:
```
🔵 Iniciando upload...
✅ Token encontrado
📁 Arquivo recebido: foto.jpg Tamanho: 123456 bytes
✅ Upload concluído! URL: https://...
```

### 3. Teste o Token Manualmente
```bash
# No terminal
curl -X POST https://blob.vercel-storage.com/upload \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -F "file=@caminho/para/foto.jpg"
```

---

## ✅ Checklist de Verificação:

- [ ] `.env.local` existe e tem `BLOB_READ_WRITE_TOKEN`
- [ ] Token começa com `vercel_blob_rw_`
- [ ] Servidor foi reiniciado após configurar token
- [ ] Arquivo tem menos de 4.5MB
- [ ] Formato é JPG, PNG, GIF ou WEBP
- [ ] Console do navegador mostra logs
- [ ] Terminal do servidor mostra logs

---

## 🚀 Solução Rápida:

### Se estiver rodando LOCAL:
1. Pare o servidor (Ctrl+C)
2. Verifique `.env.local`:
   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
   ```
3. Reinicie:
   ```bash
   npm run dev
   ```
4. Tente fazer upload novamente
5. Veja os logs no console e terminal

### Se estiver no VERCEL:
1. Vá em: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione:
   - Key: `BLOB_READ_WRITE_TOKEN`
   - Value: `vercel_blob_rw_...`
3. Redeploy o projeto
4. Tente fazer upload

---

## 📝 Logs Adicionados:

### Frontend (Console do Navegador):
- `📤 Enviando arquivo:` - Confirma que arquivo foi selecionado
- `✅ Upload bem-sucedido!` - Upload funcionou
- `❌ Erro na resposta:` - Mostra erro detalhado

### Backend (Terminal do Servidor):
- `🔵 Iniciando upload...` - API foi chamada
- `✅ Token encontrado` - Token está configurado
- `📁 Arquivo recebido:` - Arquivo chegou na API
- `✅ Upload concluído!` - Vercel Blob aceitou
- `❌ Erro detalhado:` - Mostra stack trace completo

---

## 🆘 Se Nada Funcionar:

1. **Crie novo token:**
   - https://vercel.com/dashboard/stores
   - Create Store → Blob
   - Copy token

2. **Cole no .env.local:**
   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_NOVO_TOKEN
   ```

3. **Reinicie TUDO:**
   ```bash
   # Pare servidor
   Ctrl+C
   
   # Limpe cache
   rm -rf .next
   
   # Reinstale
   npm install
   
   # Reinicie
   npm run dev
   ```

4. **Teste com imagem pequena:**
   - Use PNG ou JPG
   - Menos de 1MB
   - Tente fazer upload

---

**Agora tenta de novo e me fala o que aparece no console! 🔍**
