# 🚀 Script de Deploy Automático
Write-Host "🎄 Natal em Família - Deploy Automático" -ForegroundColor Green
Write-Host ""

# Verificar se está na pasta correta
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: Execute este script na pasta do projeto!" -ForegroundColor Red
    exit 1
}

# Passo 1: Testar build
Write-Host "📦 Passo 1/3: Testando build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build falhou! Corrija os erros antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build OK!" -ForegroundColor Green
Write-Host ""

# Passo 2: Verificar Vercel CLI
Write-Host "🔧 Passo 2/3: Verificando Vercel CLI..." -ForegroundColor Cyan

$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "⚠️  Vercel CLI não encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g vercel
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar Vercel CLI!" -ForegroundColor Red
        Write-Host "💡 Tente manualmente: npm install -g vercel" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Vercel CLI OK!" -ForegroundColor Green
Write-Host ""

# Passo 3: Deploy
Write-Host "🚀 Passo 3/3: Fazendo deploy..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Configure as variáveis de ambiente quando solicitado!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cole estas variáveis:" -ForegroundColor White
Write-Host "DATABASE_URL=postgresql://neondb_owner:npg_19yXGeVvioYs@ep-royal-glitter-a4p2od6s-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" -ForegroundColor Gray
Write-Host "POSTGRES_URL=postgresql://neondb_owner:npg_19yXGeVvioYs@ep-royal-glitter-a4p2od6s-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" -ForegroundColor Gray
Write-Host "ADMIN_PASSWORD=natal2025" -ForegroundColor Gray
Write-Host "BLOB_READ_WRITE_TOKEN=vercel_blob_rw_AyyCSwbZQqDjNQqb_Sc2PeeUBEwTkRsP4wM7e6appcA8xIu" -ForegroundColor Gray
Write-Host ""

Read-Host "Pressione ENTER para continuar com o deploy"

vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Acesse o link fornecido pelo Vercel" -ForegroundColor White
    Write-Host "2. Configure as variáveis de ambiente no painel (se ainda não fez)" -ForegroundColor White
    Write-Host "3. Teste o login com a senha: natal2025" -ForegroundColor White
    Write-Host "4. Compartilhe com a família! 🎄" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Deploy falhou!" -ForegroundColor Red
    Write-Host "💡 Verifique os logs acima para mais detalhes" -ForegroundColor Yellow
}
