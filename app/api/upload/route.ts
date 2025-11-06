import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 Iniciando upload...');
    
    // Verificar token
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('❌ BLOB_READ_WRITE_TOKEN não configurado!');
      return NextResponse.json({ 
        error: 'Token de upload não configurado. Configure BLOB_READ_WRITE_TOKEN no .env.local' 
      }, { status: 500 });
    }
    console.log('✅ Token encontrado');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ Nenhum arquivo no FormData');
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    
    console.log('📁 Arquivo recebido:', file.name, 'Tamanho:', file.size, 'bytes');

    // Upload para Vercel Blob com nome único
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomStr}-${file.name}`;
    
    const blob = await put(fileName, file, {
      access: 'public',
      token: token,
    });

    console.log('✅ Upload concluído! URL:', blob.url);
    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error('❌ Erro detalhado no upload:', error);
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    return NextResponse.json({ 
      error: 'Erro ao fazer upload',
      details: error.message 
    }, { status: 500 });
  }
}
