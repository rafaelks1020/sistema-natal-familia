# Câmera do karaokê: como ligar no telão

Arquivos: `_camera.tsx` (hook, fundo, filtros, foto), `_camera.module.css`, `app/api/karaoke/foto/route.ts`.
Filtros PNG (com transparência) esperados em `public/karaoke/filtros/`: `gorro.png`, `barba.png`, `chifres.png`, `oculos.png`.
Se faltar algum, aquele filtro simplesmente não aparece.

## 1. Hook (dentro do componente do telão)

```tsx
import { CameraFundo, EscolhaFiltros, tirarFoto, useCameraKaraoke, useEfeitos } from './_camera';

const [camLigada, setCamLigada] = useState(false);
const [efeitos, setEfeitos] = useEfeitos();               // lembra a escolha no localStorage
const canvasCamRef = useRef<HTMLCanvasElement>(null);
const cam = useCameraKaraoke({
  ligada: camLigada,
  // volume 0..1 lido a cada detecção, sem re-render. Mesma conta do medidor (linha do nivelRef):
  volume: () => Math.min(1, Math.sqrt(pitch.vivo.current.rms) * 1.6),
});
```

## 2. Fundo

Primeiro filho de `.root` (antes de `FundoLetra`/`FundoEstudio`), só quando a câmera está ligada e pronta.
Com a câmera desligada não renderize nada: fica o fundo atual.

```tsx
{camLigada && cam.pronta ? (
  <CameraFundo
    video={cam.video} rostos={cam.rostosRef} cantandoIdx={cam.cantandoRef}   // refs: desenha a ~18/s sem re-render
    nomes={nomesNaTela}             // nomes[i] = rosto i da ESQUERDA para a direita na tela
    efeitos={efeitos} faiscas={acertosRecentes} escurecer={0.35}
    canvasRef={canvasCamRef} />
) : null}
```

- `zIndex` padrão 0 (fixo, tela cheia, pointer-events none). Os demais elementos do telão já têm z-index >= 1.
- `.root` e `.videoCaixa` têm fundo opaco: com a câmera ligada, tirar o `background` do `.root` (ou a classe `.camAtiva`
  com fundo transparente) e deixar o `.videoCaixa` do YouTube no modo letra/estúdio como está.
- `nomesNaTela`: com 1 rosto, `[quemCanta(item)]`. Com dueto e 2 rostos, `[item.nome, item.dueto_nome]`
  (a ordem real pode vir trocada; se importar, deixe o cantor ativo sem nome com `nomes` vazio).
- `faiscas`: contador que SOBE a cada acerto (ex.: total de notas certas da música ao vivo, vindo de `PontuacaoAoVivo`/`eventosRef`).
  Cada aumento solta 14 faíscas por unidade (até 5 por vez, máx 150 na tela).

## 3. Botão e filtros (faixa de controles, só admin)

```tsx
<button type="button" className={`${styles.botao} ${camLigada ? styles.botaoLigado : ''}`} onClick={() => setCamLigada(v => !v)}>Câmera</button>
{camLigada ? <EscolhaFiltros valor={efeitos} onMudar={setEfeitos} /> : null}
{cam.erro ? <p className={styles.erro}>{cam.erro}</p> : null}
```
Seletor de câmera: `cam.dispositivos` (`{deviceId,label}`) e `useCameraKaraoke({ deviceId })`, igual ao do microfone.
`EscolhaFiltros` já grava em localStorage (`karaoke.camera.efeitos`); `useEfeitos` só deve montar no cliente (o telão já é client).

## 4. Foto

`tirarFoto(canvas)` devolve `Promise<Blob | null>` (JPEG 0.9, com selo "Karaokê Natal em Família 2026").
Momento: no pico do placar ao vivo (quando o combo/placar bater o maior valor da música, uma vez por música, guardando o Blob em ref),
e também no fim se nenhuma foi tirada. Envio só depois da nota gravada (para ter `fila_id` e a nota no álbum):

```tsx
async function enviarFoto(filaId: number | string, nota: number) {
  const canvas = canvasCamRef.current;
  const blob = canvas ? await tirarFoto(canvas) : null;
  if (!blob) return null;
  const fd = new FormData();
  fd.append('fila_id', String(filaId));
  fd.append('nota', String(nota));            // opcional; a rota prefere a nota gravada em karaoke_notas
  fd.append('foto', blob, 'karaoke.jpg');
  const r = await fetch('/api/karaoke/foto', { method: 'POST', body: fd });
  return r.ok ? ((await r.json()) as { url: string }).url : null;
}
```
Guarde a `url` em estado e mostre na tela da nota (`fase === 'nota'`) como polaroid no canto, com a animação `aparecer`.
Para uma foto bonita no pico, tire a foto com o canvas ainda ao vivo (a tela da nota pode manter o `CameraFundo` montado).
A rota exige admin e cria uma linha em `album_photos` (legenda "Fulano cantando <música> no karaokê, nota N").

## Detalhes
- MediaPipe carrega só ao ligar a câmera (import dinâmico). WASM do jsDelivr fixado em `VERSAO_MEDIAPIPE` (_camera.tsx): atualizar junto com o `package.json`.
- Quem canta: com 1 rosto é ele; com 2, o de maior média móvel de `jawOpen` enquanto o volume > 0.05; solta o posto após 2,5 s de silêncio.
- Rostos ordenados da esquerda para a direita NA TELA (a imagem é espelhada).
