'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { quemCanta, type ItemFila } from './tipos';
import styles from './karaoke.module.css';

export const URL_FILA_KARAOKE = 'https://natalemfamilia.com.br/karaoke';

export type ProximoCantorProps = {
  ultimo: Pick<ItemFila, 'nome' | 'dueto_nome' | 'titulo'> | null;
  proximo: ItemFila | null;
  /** Apenas os seguintes ao próximo, normalmente estado.fila.slice(1, 4). */
  seguintes: readonly ItemFila[];
  /** Segundos restantes, controlados pelo telão. null deixa a espera manual. */
  contagem: number | null;
  /** Reaproveita o QR já gerado pelo telão; sem ele, usa a mesma biblioteca qrcode. */
  qr?: string;
  onComecar?: () => void;
};

/**
 * Cartaz entre a nota da apresentação anterior e o começo da próxima música.
 * Integração no telão, conservando resultado até sair deste cartaz:
 * <ProximoCantor ultimo={resultado?.item ?? null} proximo={estado?.fila[0] ?? null}
 *   seguintes={estado?.fila.slice(1, 4) ?? []} contagem={contagem} qr={qr}
 *   onComecar={() => void iniciar()} />
 * O pai controla a contagem e chama iniciar() ao zerar. A contagem anterior
 * à reprodução em entrarContagem continua pertencendo ao fluxo do player.
 */
export default function ProximoCantor({ ultimo, proximo, seguintes, contagem, qr, onComecar }: ProximoCantorProps) {
  const [qrGerado, setQrGerado] = useState('');
  useEffect(() => {
    if (qr) return;
    let ativo = true;
    void QRCode.toDataURL(URL_FILA_KARAOKE, {
      margin: 1, width: 640, errorCorrectionLevel: 'M', color: { dark: '#171b18', light: '#f3ebdc' },
    }).then((url) => { if (ativo) setQrGerado(url); }).catch(() => { /* O endereço continua legível se a geração falhar. */ });
    return () => { ativo = false; };
  }, [qr]);
  const imagemQr = qr || qrGerado;
  const segundos = contagem !== null && Number.isFinite(contagem) ? Math.max(0, Math.ceil(contagem)) : null;

  return <section className={styles.cartaz} aria-label="Próximo cantor">
    {ultimo ? <p className={styles.subtitulo} style={{ fontSize: '2.4vmin' }}>Acabou de cantar: <strong>{quemCanta(ultimo)}</strong>, {ultimo.titulo}</p> : null}
    <div className={styles.proxLinha}>
      <div className={styles.proxTexto}>
        <p className={styles.kicker}>{proximo ? 'Próximo cantor' : 'Karaokê da família'}</p>
        <h2 className={styles.titulo}>{proximo ? quemCanta(proximo) : 'Quem vai cantar?'}</h2>
        <p className={styles.subtitulo}>{proximo?.titulo ?? 'Escolha sua música pelo celular.'}</p>
        {proximo && segundos !== null ? <p role="timer" aria-label={`Começa em ${segundos} segundos`} style={{ color: '#bfa577', fontSize: '5vmin', fontWeight: 800 }}>Começa em {segundos}</p> : null}
        {proximo && onComecar ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={onComecar}>Começar agora</button> : null}
        {seguintes.length ? <ol className={styles.proximos} start={2} aria-label="Os três seguintes">
          {seguintes.slice(0, 3).map((item, i) => <li key={item.id}><b>{i + 2}</b>{quemCanta(item)}: {item.titulo}</li>)}
        </ol> : null}
      </div>
      <a className={styles.proxQr} href={URL_FILA_KARAOKE} style={{ width: '34vmin', maxWidth: '40vw', color: 'inherit', textDecoration: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imagemQr ? <img src={imagemQr} width={640} height={640} alt="QR code para escolher música e entrar na fila do karaokê" /> : null}
        <p className={styles.qrTexto}>Entre na fila pelo celular</p>
        <p className={styles.qrLink}>natalemfamilia.com.br/karaoke</p>
      </a>
    </div>
  </section>;
}
