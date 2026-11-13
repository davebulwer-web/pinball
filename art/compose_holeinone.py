# Builds the Hole in One art used by the game from the Pixellab sources in tables/holeinone/art/src:
#   playfield.png  the 320x640 backdrop: the putting green round the top (green.png, its flag where the Cup is),
#                  the fairway with its pond down the middle (course.png), and mown stripes drawn here between
#                  them and down to the flippers; dimmed so the parts drawn over it stand out
#   sprites        the tree bumpers, the ball, the flag and the buggy shrunk to size, and the lamp icons
# Usage: python3 art/compose_holeinone.py
from PIL import Image, ImageDraw, ImageEnhance
import os, random
SRC = 'tables/holeinone/art/src'; OUT = 'tables/holeinone/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

random.seed(3)
field = Image.new('RGBA', (W, H))
px = field.load()
for y in range(H):                                     # mown stripes
    band = (y // 20) % 2
    for x in range(W):
        g = (64, 150, 44) if band else (54, 136, 38)
        n = random.randint(-5, 5)
        px[x, y] = (g[0] + n, g[1] + n, g[2] + n, 255)
def fade_in(img, top, bottom):
    mask = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        mask.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    img.putalpha(mask)
    return img
field.alpha_composite(fade_in(load('green.png'), 0, 30), (2, 0))       # (its flag lines up with the Cup)
field.alpha_composite(fade_in(load('course.png'), 30, 30), (0, 236))
d = ImageDraw.Draw(field)
d.rectangle([120, 584, 182, 600], fill=(80, 168, 60, 255))           # the tee box between the flippers
for x in (128, 174): d.ellipse([x - 3, 589, x + 3, 595], fill=(240, 240, 240, 255))
field = ImageEnhance.Brightness(field).enhance(0.62)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('tree.png'), (26, 26)).save(os.path.join(OUT, 'tree.png'))
shrink(load('ball.png'), (10, 10)).save(os.path.join(OUT, 'ball.png'))
shrink(load('flag.png'), (14, 20)).save(os.path.join(OUT, 'flag.png'))
shrink(load('buggy.png'), (16, 16)).save(os.path.join(OUT, 'buggy.png'))
LAMPS = {'club': 13, 'trophy': 13, 'tee': 13, 'bird': 13, 'eagle': 13, 'wind': 14, 'flag': 13, 'house': 13, 'xball': 13,
         'star': 12, 'sand': 13, 'card': 13}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
