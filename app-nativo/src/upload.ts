import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api, ApiError } from './api';

// Fotos do app: escolher (câmera ou galeria), reduzir no aparelho e enviar para /api/upload.
// Lado maior 1600 px em JPEG 0,82: foto de 8 MB vira ~300 KB e sobe rápido no 4G.
// Uso nas telas: const fotos = await escolherFotos('galeria', 6); const url = await enviarFoto(fotos[0]);

export type Origem = 'camera' | 'galeria';

export interface FotoLocal {
  uri: string;
  width: number;
  height: number;
}

/** Abre câmera ou galeria. Devolve [] se a pessoa cancelar. Lança ApiError(0) se a permissão for negada. */
export async function escolherFotos(origem: Origem, maximo = 1): Promise<FotoLocal[]> {
  const permissao =
    origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) {
    throw new ApiError(
      origem === 'camera'
        ? 'Permita o uso da câmera nos Ajustes do aparelho para tirar a foto.'
        : 'Permita o acesso às fotos nos Ajustes do aparelho para escolher.',
      0,
    );
  }
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: origem === 'galeria' && maximo > 1,
    selectionLimit: maximo,
    exif: false,
  };
  const resultado =
    origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (resultado.canceled) return [];
  return resultado.assets.slice(0, maximo).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

async function reduzir(foto: FotoLocal, lado = 1600): Promise<string> {
  const maior = Math.max(foto.width, foto.height);
  const contexto = ImageManipulator.manipulate(foto.uri);
  if (maior > lado) {
    contexto.resize(foto.width >= foto.height ? { width: lado } : { height: lado });
  }
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return salva.uri;
}

/** Reduz e envia uma foto. Devolve a URL pública (Vercel Blob) para usar nos posts, gastos e perfil. */
export async function enviarFoto(foto: FotoLocal): Promise<string> {
  const uri = await reduzir(foto).catch(() => foto.uri);
  const form = new FormData();
  // React Native aceita { uri, name, type } como arquivo no FormData.
  form.append('file', { uri, name: `foto-${Date.now()}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  const { url } = await api<{ url: string }>('/api/upload', { method: 'POST', body: form, timeoutMs: 60000 });
  return url;
}
