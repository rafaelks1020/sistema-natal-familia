// Mede cada tela do site em celular (390x844), em letra normal e em letra maior: letras pequenas, alvos de toque
// pequenos, conteúdo cortado na lateral e presença do botão Voltar. Só leitura, com a conta de revisão.
// Uso: PLAYWRIGHT=/caminho/para/node_modules/playwright node scripts/medir-telas.cjs ["/,/pontos"] [saida.jsonl]
//   BASE=http://localhost:3000  mede outro endereço (padrão: produção)
//   MODOS=normal,grande,maior   tamanhos de letra a medir
//   FOTOS=/,/pontos             tira foto dessas rotas (pasta capturas/ ao lado da saída); INTEIRA=1 para a página toda
// A conta usada é a de revisão das lojas (~/Jobs/SPEEDTECH/credenciais/natal-familia/revisor.txt). Só lê, não altera nada.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const cred = Object.fromEntries(fs.readFileSync(process.env.HOME + '/Jobs/SPEEDTECH/credenciais/natal-familia/revisor.txt', 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'https://natalemfamilia.com.br';
const ROTAS = (process.argv[2] || '/,/advento,/album,/amigo-oculto,/amigo-oculto/ao-vivo,/ao-vivo,/arvore,/capsula,/caronas,/cartao,/ceia,/conquistas,/conta,/contas-da-ceia,/convidar,/convites,/familia,/festa,/festa/bingo,/festa/desafio,/festa/enquete,/festa/foto-oficial,/festa/jogos-novos,/festa/quiz,/historias,/homenagem,/karaoke,/karaoke/prova,/memorias,/memorias/linha-do-tempo,/missoes,/mural,/organizar,/pagar,/playlist,/pontos,/receitas,/vaquinha').split(',');
const SAIDA = path.resolve(process.argv[3] || 'medicao-telas.jsonl');
const MODOS = (process.env.MODOS || 'normal,grande').split(',');

const medir = () => {
  const L = window.innerWidth;
  const visivel = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const rolaDeLado = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const pequenas = {}; let total = 0, menor12 = 0, menor14 = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim(); const el = walker.currentNode.parentElement;
    if (t.length < 2 || !el || !visivel(el)) continue;
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10; total++;
    if (px < 14) menor14++;
    if (px < 12) { menor12++; const k = px + 'px'; (pequenas[k] = pequenas[k] || []).length < 4 && pequenas[k].push(t.slice(0, 28)); }
  }
  const alvos = []; let nAlvos = 0;
  for (const el of document.querySelectorAll('a, button, [role=button], input:not([type=hidden]), select, textarea, summary')) {
    if (!visivel(el)) continue; const r = el.getBoundingClientRect(); nAlvos++;
    if (r.height < 43.5 || r.width < 43.5) alvos.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (el.getAttribute('aria-label') || el.textContent || el.getAttribute('type') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 26));
  }
  const cortados = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visivel(el) || el.children.length > 3) continue; const r = el.getBoundingClientRect();
    if (r.right > L + 2 && r.left < L && !rolaDeLado(el) && getComputedStyle(el).position !== 'fixed') cortados.push(Math.round(r.right - L) + 'px a mais: ' + (el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30));
  }
  const semRotulo = [...document.querySelectorAll('a, button, [role=button]')].filter(el => visivel(el) && !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')).length;
  const voltar = [...document.querySelectorAll('a, button')].some(el => visivel(el) && /^voltar/i.test((el.textContent || el.getAttribute('aria-label') || '').trim()));
  return { telas: +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1), textos: total, menor14, menor12, pequenas, nAlvos, alvosPequenos: alvos.length, alvos: [...new Set(alvos)].slice(0, 8),
    rolagemLateral: document.documentElement.scrollWidth > L + 1, cortados: [...new Set(cortados)].slice(0, 5), semRotulo, voltar, titulo: (document.querySelector('h1')?.textContent || '').trim().slice(0, 40) };
};

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/entrar', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.getByPlaceholder('Usuário').fill(cred.usuario);
  await page.getByPlaceholder('Senha').fill(cred.senha);
  await Promise.all([page.waitForURL(u => !String(u).includes('/entrar'), { timeout: 30000 }).catch(() => {}), page.locator('button[type=submit]').click()]);
  fs.writeFileSync(SAIDA, '');
  for (const modo of MODOS) {
    await page.evaluate(m => { try { if (m === 'normal') localStorage.removeItem('nf_letra'); else localStorage.setItem('nf_letra', m); } catch {} }, modo);
    for (const rota of ROTAS) {
      const r = await page.goto(BASE + rota, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => null);
      await page.waitForTimeout(1800);
      let m; try { m = await page.evaluate(medir); } catch (e) { m = { erro: String(e).slice(0, 80) }; }
      fs.appendFileSync(SAIDA, JSON.stringify({ modo, rota, status: r ? r.status() : 0, final: new URL(page.url()).pathname, ...m }) + '\n');
      if (process.env.FOTOS && process.env.FOTOS.split(',').includes(rota)) fs.mkdirSync(path.join(path.dirname(SAIDA), 'capturas'), { recursive: true });
      if (process.env.FOTOS && process.env.FOTOS.split(',').includes(rota)) await page.screenshot({ path: path.join(path.dirname(SAIDA), 'capturas', (process.env.PREFIXO || 'v') + '-' + modo + '-' + (rota === '/' ? 'inicio' : rota.slice(1).replace(/\//g, '-')) + '.png'), fullPage: !!process.env.INTEIRA });
    }
  }
  await browser.close();
  console.log('varredura concluída:', SAIDA);
})().catch(e => { console.error('falhou:', String(e).slice(0, 400)); process.exit(1); });
