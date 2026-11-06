const MARFIM_3 = '#8f887c';
const LINHA = 'rgba(243,235,220,0.16)';
const FONTE = 'Manrope, system-ui, sans-serif';

function eixo(n: number): string {
  const arred = Math.round(n);
  if (Math.abs(arred) >= 1000) return `${(arred / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return String(arred);
}

export function GraficoLinhas({
  rotulos,
  series,
  aria,
}: {
  rotulos: string[];
  series: { nome: string; cor: string; valores: number[] }[];
  aria: string;
}) {
  const w = 360;
  const h = 176;
  const pad = { t: 14, r: 6, b: 24, l: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const n = Math.max(1, rotulos.length);
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const marcas = [0, max / 2, max];
  const passo = rotulos.length > 14 ? 5 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria} className="w-full">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={pad.l} x2={w - pad.r} y1={y(m)} y2={y(m)} stroke={LINHA} strokeWidth="1" />
          <text x={pad.l - 4} y={y(m) + 3} textAnchor="end" fill={MARFIM_3} fontSize="10" fontFamily={FONTE}>{eixo(m)}</text>
        </g>
      ))}
      {series.map((s) => (
        <path
          key={s.nome}
          d={s.valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={s.cor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {rotulos.map((rotulo, i) => (i % passo === 0 || i === rotulos.length - 1 ? (
        <text key={`${rotulo}-${i}`} x={x(i)} y={h - 4} textAnchor="middle" fill={MARFIM_3} fontSize="10" fontFamily={FONTE}>{rotulo}</text>
      ) : null))}
    </svg>
  );
}

export function GraficoBarras({
  itens,
  aria,
}: {
  itens: { rotulo: string; valor: number; cor: string }[];
  aria: string;
}) {
  const w = 360;
  const h = 176;
  const pad = { t: 18, r: 8, b: 28, l: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const gap = 12;
  const bw = itens.length ? (iw - gap * (itens.length - 1)) / itens.length : iw;
  const marcas = [0, max / 2, max];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria} className="w-full">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={pad.l} x2={w - pad.r} y1={y(m)} y2={y(m)} stroke={LINHA} strokeWidth="1" />
          <text x={pad.l - 4} y={y(m) + 3} textAnchor="end" fill={MARFIM_3} fontSize="10" fontFamily={FONTE}>{eixo(m)}</text>
        </g>
      ))}
      {itens.map((item, i) => {
        const x = pad.l + i * (bw + gap);
        const topo = y(item.valor);
        const altura = Math.max(0, pad.t + ih - topo);
        return (
          <g key={item.rotulo}>
            <rect x={x} y={topo} width={bw} height={altura} rx="6" fill={item.cor} />
            <text x={x + bw / 2} y={h - 8} textAnchor="middle" fill={MARFIM_3} fontSize="11" fontFamily={FONTE}>{item.rotulo}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {itens.map((item) => (
        <li key={item.nome} className="flex items-center gap-2 text-xs text-marfim-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.cor }} />
          {item.nome}
        </li>
      ))}
    </ul>
  );
}
