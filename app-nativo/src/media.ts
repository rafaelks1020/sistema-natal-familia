// Animações locais (copiadas de ../public/media). Para adicionar: copie .mp4 e .jpg e inclua aqui.
export const media = {
  'mn-afeto': { video: require('../assets/media/mn-afeto.mp4'), poster: require('../assets/media/mn-afeto.jpg') },
  'mn-album': { video: require('../assets/media/mn-album.mp4'), poster: require('../assets/media/mn-album.jpg') },
  'mn-brinde': { video: require('../assets/media/mn-brinde.mp4'), poster: require('../assets/media/mn-brinde.jpg') },
  'mn-ceia': { video: require('../assets/media/mn-ceia.mp4'), poster: require('../assets/media/mn-ceia.jpg') },
  'mn-confete': { video: require('../assets/media/mn-confete.mp4'), poster: require('../assets/media/mn-confete.jpg') },
  'mn-coracao': { video: require('../assets/media/mn-coracao.mp4'), poster: require('../assets/media/mn-coracao.jpg') },
  'mn-countdown': { video: require('../assets/media/mn-countdown.mp4'), poster: require('../assets/media/mn-countdown.jpg') },
  'mn-curtida': { video: require('../assets/media/mn-curtida.mp4'), poster: require('../assets/media/mn-curtida.jpg') },
  'mn-curtida-comentario': { video: require('../assets/media/mn-curtida-comentario.mp4'), poster: require('../assets/media/mn-curtida-comentario.jpg') },
  'mn-hero': { video: require('../assets/media/mn-hero.mp4'), poster: require('../assets/media/mn-hero.jpg') },
  'mn-loader': { video: require('../assets/media/mn-loader.mp4'), poster: require('../assets/media/mn-loader.jpg') },
  'mn-login': { video: require('../assets/media/mn-login.mp4'), poster: require('../assets/media/mn-login.jpg') },
  'mn-presente': { video: require('../assets/media/mn-presente.mp4'), poster: require('../assets/media/mn-presente.jpg') },
  'mn-revelacao': { video: require('../assets/media/mn-revelacao.mp4'), poster: require('../assets/media/mn-revelacao.jpg') },
  'mn-sino': { video: require('../assets/media/mn-sino.mp4'), poster: require('../assets/media/mn-sino.jpg') },
  'mn-vazio': { video: require('../assets/media/mn-vazio.mp4'), poster: require('../assets/media/mn-vazio.jpg') },
} as const;
export type MediaName = keyof typeof media;
