import { media, type MediaName } from '../../media';

// O integrador adicionará os arquivos e o manifesto compartilhado. Até lá, a UI é estática.
export const confettiMediaName = Object.keys(media).find((name): name is MediaName => name === 'mn-confete');
