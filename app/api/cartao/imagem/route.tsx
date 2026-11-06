import { ImageResponse } from 'next/og';
import { cleanText, HttpError, isBlobUrl, requireUser, route } from '@/app/lib/api';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregarFontes } from '../_fontes';
import { FRASES, MAX_ASSINATURA, MAX_TEXTO, modeloValido, type ModeloId } from '../_modelo';

// GET /api/cartao/imagem?foto=<url do Blob>&modelo=meia-noite|cereja|flash&texto=...&assinatura=...&baixar=1
// Devolve o PNG 1080x1350 do cartão de Natal. Exige login (cookie ou Bearer do app).

const L = 1080;
const A = 1350;
const MAX_FOTO = 8 * 1024 * 1024;

const COR = { carvao: '#171b18', carvao2: '#1d221f', marfim: '#f3ebdc', champagne: '#bfa577', cereja: '#c5292d' };
const BODONI = 'Bodoni, Georgia, serif';
const MANROPE = 'Manrope, sans-serif';

/** Satori lê JPEG, PNG e GIF. Baixa a foto aqui (só do nosso Blob) e entrega como data URI. */
async function fotoComoDataUri(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(400, 'Não deu para abrir essa foto. Tente outra.');
  }
  if (!res.ok) throw new HttpError(400, 'Não deu para abrir essa foto. Tente outra.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FOTO) throw new HttpError(400, 'A foto é grande demais.');
  const mime =
    buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf[0] === 0x47 && buf[1] === 0x49 ? 'image/gif' : null;
  if (!mime) throw new HttpError(400, 'Essa foto está num formato que o cartão não lê. Envie uma nova (JPG ou PNG).');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function tamanhoTexto(t: string, base: number): number {
  if (t.length <= 50) return base;
  if (t.length <= 90) return Math.round(base * 0.84);
  return Math.round(base * 0.72);
}

interface Dados {
  foto: string;
  texto: string;
  assinatura: string;
  ano: number;
}

function meiaNoite({ foto, texto, assinatura, ano }: Dados) {
  return (
    <div style={{ width: L, height: A, display: 'flex', background: COR.carvao, padding: 44 }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: `2px solid ${COR.champagne}`,
          padding: '56px 60px 48px',
        }}
      >
        <div style={{ display: 'flex', color: COR.champagne, fontFamily: MANROPE, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase' }}>
          {`Natal em Família ${ano}`}
        </div>
        <div style={{ display: 'flex', marginTop: 34, padding: 10, border: `2px solid ${COR.champagne}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={foto} width={840} height={690} style={{ width: 840, height: 690, objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 10px' }}>
          <div
            style={{
              display: 'flex',
              textAlign: 'center',
              justifyContent: 'center',
              color: COR.marfim,
              fontFamily: BODONI,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: tamanhoTexto(texto, 60),
              lineHeight: 1.22,
            }}
          >
            {texto}
          </div>
        </div>
        <div style={{ display: 'flex', width: 120, height: 2, background: COR.champagne }} />
        <div style={{ display: 'flex', marginTop: 24, color: COR.champagne, fontFamily: BODONI, fontWeight: 700, fontSize: 46 }}>{assinatura}</div>
      </div>
    </div>
  );
}

function cereja({ foto, texto, assinatura, ano }: Dados) {
  return (
    <div style={{ width: L, height: A, display: 'flex', flexDirection: 'column', background: COR.carvao }}>
      <div style={{ display: 'flex', height: 170, alignItems: 'center', justifyContent: 'center', background: COR.cereja, flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: COR.marfim, fontFamily: BODONI, fontWeight: 700, fontSize: 84 }}>Feliz Natal</div>
      </div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', padding: '44px 70px 0' }}>
        <div style={{ display: 'flex', padding: 8, background: COR.marfim }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={foto} width={800} height={640} style={{ width: 800, height: 640, objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              textAlign: 'center',
              justifyContent: 'center',
              color: COR.marfim,
              fontFamily: BODONI,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: tamanhoTexto(texto, 58),
              lineHeight: 1.22,
            }}
          >
            {texto}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', height: 150, background: COR.cereja, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', color: COR.marfim, fontFamily: BODONI, fontWeight: 700, fontSize: 44 }}>{assinatura}</div>
        <div style={{ display: 'flex', marginTop: 8, color: COR.marfim, fontFamily: MANROPE, fontSize: 20, letterSpacing: 6, textTransform: 'uppercase' }}>
          {`Natal em Família ${ano}`}
        </div>
      </div>
    </div>
  );
}

function flash({ foto, texto, assinatura, ano }: Dados) {
  return (
    <div style={{ width: L, height: A, display: 'flex', position: 'relative', background: COR.carvao }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={foto} width={L} height={A} style={{ position: 'absolute', top: 0, left: 0, width: L, height: A, objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: L,
          height: 240,
          display: 'flex',
          backgroundImage: 'linear-gradient(to bottom, rgba(23,27,24,0.7), rgba(23,27,24,0))',
        }}
      />
      <div style={{ position: 'absolute', top: 64, left: 0, width: L, display: 'flex', justifyContent: 'center', color: COR.marfim, fontFamily: MANROPE, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase' }}>
        {`Natal em Família ${ano}`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: L,
          height: 720,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 80px 80px',
          backgroundImage: 'linear-gradient(to top, rgba(23,27,24,0.96), rgba(23,27,24,0.82) 45%, rgba(23,27,24,0))',
        }}
      >
        <div
          style={{
            display: 'flex',
            textAlign: 'center',
            justifyContent: 'center',
            color: COR.marfim,
            fontFamily: BODONI,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: tamanhoTexto(texto, 68),
            lineHeight: 1.2,
          }}
        >
          {texto}
        </div>
        <div style={{ display: 'flex', width: 120, height: 2, background: COR.champagne, marginTop: 36 }} />
        <div style={{ display: 'flex', marginTop: 26, color: COR.champagne, fontFamily: BODONI, fontWeight: 700, fontSize: 48 }}>{assinatura}</div>
      </div>
    </div>
  );
}

const MODELO_FN: Record<ModeloId, (d: Dados) => React.JSX.Element> = { 'meia-noite': meiaNoite, cereja, flash };

export const GET = route(async (req) => {
  const me = await requireUser();
  const p = new URL(req.url).searchParams;

  const foto = p.get('foto');
  if (!isBlobUrl(foto)) throw new HttpError(400, 'Escolha uma foto enviada pelo app.');
  const modelo = p.get('modelo') ?? 'meia-noite';
  if (!modeloValido(modelo)) throw new HttpError(400, 'Modelo de cartão inválido.');
  const um = (v: string) => v.replace(/\s+/g, ' ').trim();
  const texto = um(cleanText(p.get('texto'), 'a frase', MAX_TEXTO, false)) || FRASES[0];
  const assinatura = um(cleanText(p.get('assinatura'), 'a assinatura', MAX_ASSINATURA, false)) || me.name.slice(0, MAX_ASSINATURA);

  const [dataUri, fontes] = await Promise.all([fotoComoDataUri(foto), carregarFontes()]);
  const baixar = p.get('baixar') === '1';

  return new ImageResponse(MODELO_FN[modelo]({ foto: dataUri, texto, assinatura, ano: edicaoAtual() }), {
    width: L,
    height: A,
    fonts: fontes,
    headers: {
      'Cache-Control': 'private, max-age=300',
      ...(baixar ? { 'Content-Disposition': 'attachment; filename="cartao-de-natal.png"' } : {}),
    },
  });
});
