'use client';

import { UtensilsCrossed } from 'lucide-react';
import styles from './cenas.module.css';

export interface PratoCeiaTelao {
  nome: string;
  categoria: string | null;
  quem: string;
}

export interface CeiaCenaProps {
  pratos: PratoCeiaTelao[];
}

const ORDEM_CATEGORIAS: { id: string; titulo: string }[] = [
  { id: 'salgado', titulo: 'Salgados' },
  { id: 'doce', titulo: 'Doces' },
  { id: 'bebida', titulo: 'Bebidas' },
  { id: 'descartavel', titulo: 'Descartáveis' },
  { id: 'outro', titulo: 'Outros' },
];

function normalizarCategoria(cat: string | null): string {
  const c = (cat ?? '').trim().toLowerCase();
  if (ORDEM_CATEGORIAS.some((o) => o.id === c)) return c;
  return 'outro';
}

export function CeiaCena({ pratos }: CeiaCenaProps) {
  const grupos = ORDEM_CATEGORIAS.map((cat) => ({
    ...cat,
    itens: pratos.filter((p) => normalizarCategoria(p.categoria) === cat.id),
  })).filter((g) => g.itens.length > 0);

  return (
    <div className={`${styles.cena} ${styles.ceiaCena}`}>
      <header className={styles.ceiaCabecalho}>
        <p className={styles.kicker}>Mesa da família</p>
        <h2 className={styles.titulo}>A ceia está servida</h2>
      </header>

      {grupos.length === 0 ? (
        <div className={styles.viradaAntes}>
          <UtensilsCrossed className={styles.tacaEsq} strokeWidth={1.3} />
          <p className={styles.subtitulo}>Os pratos da nossa mesa aparecerão aqui.</p>
        </div>
      ) : (
        <div className={styles.ceiaColunas}>
          {grupos.map((grupo) => (
            <section key={grupo.id} className={styles.ceiaColuna} aria-label={grupo.titulo}>
              <h3 className={styles.ceiaCatTitulo}>{grupo.titulo}</h3>
              <ul className={styles.ceiaLista}>
                {grupo.itens.map((prato, i) => (
                  <li key={`${prato.nome}-${prato.quem}-${i}`} className={styles.ceiaItem}>
                    <span className={styles.ceiaPratoNome}>{prato.nome}</span>
                    <span className={styles.ceiaPratoQuem}>{prato.quem}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default CeiaCena;
