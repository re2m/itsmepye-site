"""Shrink the hosted ricecake app's images (run after copying a fresh build into public/things/ricecake/).

- Converts every PNG the app references (except share images in src/assets/og/) to WebP,
  keeping transparency and capping width at 1024px, then rewrites the references in the
  HTML and CSS files.
- Deletes PNGs under src/assets/ that nothing references.

usage: python3 scripts/optimize-ricecake.py
"""
import os, re, glob
from PIL import Image

ROOT = 'public/things/ricecake'
TEXT_FILES = [os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'gift', 'index.html')] + glob.glob(os.path.join(ROOT, 'src', 'styles', '*.css'))
MAX_W, QUALITY = 1024, 82

texts = {p: open(p, encoding='utf-8').read() for p in TEXT_FILES}
blob = '\n'.join(texts.values())
before = after = 0
for png in sorted(glob.glob(os.path.join(ROOT, 'src', 'assets', '**', '*.png'), recursive=True)):
    rel = os.path.relpath(png, ROOT).replace(os.sep, '/')          # src/assets/media/media-01.png
    name = rel.split('src/assets/', 1)[1]                            # media/media-01.png
    if rel.startswith('src/assets/og/'):
        continue
    size = os.path.getsize(png); before += size
    if name not in blob:
        os.remove(png); print('removed unused', rel); continue
    im = Image.open(png)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    webp = png[:-4] + '.webp'
    im.save(webp, 'WEBP', quality=QUALITY, method=6)
    os.remove(png); after += os.path.getsize(webp)
    for p in texts:
        texts[p] = texts[p].replace(name, name[:-4] + '.webp')
for p, t in texts.items():
    open(p, 'w', encoding='utf-8').write(t)
print(f'images: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
