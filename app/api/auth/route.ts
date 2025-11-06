import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: true, token: 'admin-authenticated' });
    }
    
    return NextResponse.json({ success: false, message: 'Senha incorreta' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Erro no servidor' }, { status: 500 });
  }
}
