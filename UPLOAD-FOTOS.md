# 📸 Como Funciona o Upload de Fotos

## ✅ CORREÇÕES FEITAS:

### Problema 1: API não salvava image_url
**ANTES:**
```sql
INSERT INTO purchases (
  description, value, category, brand, color, size, quantity, notes
) VALUES (...)
```

**DEPOIS:**
```sql
INSERT INTO purchases (
  description, value, category, brand, color, size, quantity, notes, image_url
) VALUES (...)
```

### Problema 2: Timeline não pegava image_url
**ANTES:**
```sql
SELECT id, 'purchase' as type, description,
  value, created_at as date, category, brand, color, size, quantity, notes
FROM purchases
```

**DEPOIS:**
```sql
SELECT id, 'purchase' as type, description,
  value, created_at as date, category, brand, color, size, quantity, notes, image_url
FROM purchases
```

---

## 🔄 Fluxo Completo do Upload:

### 1. Usuário Seleciona Foto
```typescript
// Frontend: app/page.tsx
const handleImageSelect = (e) => {
  const file = e.target.files?.[0];
  setSelectedImage(file);
  setImagePreview(reader.result); // Preview
}
```

### 2. Upload para Vercel Blob
```typescript
// Frontend: app/page.tsx
const uploadImage = async () => {
  const formData = new FormData();
  formData.append('file', selectedImage);
  
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const data = await res.json();
  return data.url; // URL da foto
}
```

### 3. API Faz Upload
```typescript
// Backend: app/api/upload/route.ts
import { put } from '@vercel/blob';

const blob = await put(file.name, file, {
  access: 'public',
  token: process.env.BLOB_READ_WRITE_TOKEN,
});

return { url: blob.url };
```

### 4. Salva no Banco
```typescript
// Frontend: app/page.tsx
const addPurchaseWithImage = async () => {
  let imageUrl = '';
  if (selectedImage) {
    imageUrl = await uploadImage(); // Pega URL
  }
  
  await fetch('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({ 
      ...newPurchase, 
      image_url: imageUrl // Envia URL
    })
  });
}
```

### 5. API Salva no PostgreSQL
```typescript
// Backend: app/api/[...slug]/route.ts
INSERT INTO purchases (
  description, value, category, brand, color, size, quantity, notes, image_url
) VALUES (
  ${data.description}, ${data.value}, ..., ${data.image_url}
)
```

### 6. Timeline Busca Foto
```typescript
// Backend: app/api/[...slug]/route.ts
SELECT 
  id, 'purchase' as type, description,
  value, created_at as date, category, brand, color, size, quantity, notes, image_url
FROM purchases
```

### 7. Frontend Exibe Foto
```tsx
// Frontend: app/page.tsx
{item.type === 'purchase' && item.image_url && (
  <div className="relative aspect-video bg-gray-100 overflow-hidden">
    <img 
      src={item.image_url} 
      alt={item.description} 
      className="w-full h-full object-cover"
    />
  </div>
)}
```

---

## 🎯 Como Testar:

1. **Login como Admin**
2. **Compras** → **Adicionar Compra**
3. Preencha os dados
4. **Clique em "Escolher arquivo"**
5. Selecione uma imagem
6. Veja o **preview**
7. **Salvar**
8. Vá em **Timeline**
9. **FOTO APARECE!** 🎉

---

## 📝 Variáveis Necessárias:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

---

## ✅ Agora Está Funcionando!

- ✅ Upload para Vercel Blob
- ✅ URL salva no banco
- ✅ Timeline busca URL
- ✅ Foto aparece em 16:9
- ✅ Zoom no hover

**TESTA AÍ! 🚀**
