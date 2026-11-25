# Reduz uma foto recebida: corrige a rotação (EXIF), lado maior 1600 px, JPEG 82. Lê HEIC/HEIF também.
# Uso: python3 reduzir.py entrada saida.jpg  -> sai 0 se gravou, 1 se não conseguiu ler.
import sys
from PIL import Image, ImageOps
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass
try:
    im = Image.open(sys.argv[1])
    im = ImageOps.exif_transpose(im)
    if im.mode not in ('RGB', 'L'):
        fundo = Image.new('RGB', im.size, (255, 255, 255))
        fundo.paste(im, mask=im.convert('RGBA').split()[-1])
        im = fundo
    im.thumbnail((1600, 1600))
    im.save(sys.argv[2], 'JPEG', quality=82, optimize=True)
except Exception as e:
    print('falhou:', type(e).__name__, file=sys.stderr)
    sys.exit(1)
