// Script para testar conexão com banco Neon
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_19yXGeVvioYs@ep-royal-glitter-a4p2od6s-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

async function testConnection() {
  console.log('🔍 Testando conexão com Neon...\n');
  
  try {
    // Testar conexão
    const result = await sql`SELECT NOW()`;
    console.log('✅ Conexão OK!');
    console.log('⏰ Hora do servidor:', result[0].now);
    console.log('');
    
    // Verificar se tabelas existem
    console.log('🔍 Verificando tabelas...\n');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('❌ NENHUMA TABELA ENCONTRADA!');
      console.log('');
      console.log('📝 Você precisa criar as tabelas no console do Neon:');
      console.log('   https://console.neon.tech/');
      console.log('');
      console.log('Execute este SQL no SQL Editor:');
      console.log('');
      console.log(`
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  brand VARCHAR(255),
  color VARCHAR(100),
  size VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_paid ON participants(paid);
CREATE INDEX idx_purchases_created ON purchases(created_at DESC);
      `);
    } else {
      console.log('✅ Tabelas encontradas:');
      tables.forEach(t => console.log('   -', t.table_name));
      
      // Verificar se as tabelas necessárias existem
      const tableNames = tables.map(t => t.table_name);
      const hasParticipants = tableNames.includes('participants');
      const hasPurchases = tableNames.includes('purchases');
      
      console.log('');
      if (hasParticipants && hasPurchases) {
        console.log('✅ Todas as tabelas necessárias existem!');
        console.log('');
        console.log('🎄 O sistema está pronto para uso!');
      } else {
        console.log('⚠️  Faltam tabelas:');
        if (!hasParticipants) console.log('   - participants');
        if (!hasPurchases) console.log('   - purchases');
        console.log('');
        console.log('Execute o SQL acima no console do Neon.');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testConnection();
