# Builds the Grand Prix art used by the game from the Pixellab sources in tables/grandprix/art/src:
#   playfield.png  the 320x640 backdrop: the grandstand, pit garages and pit straight across the top
#                  (grandstand.png), the twisty circuit in the middle (track.png), and grass with a starting grid
#                  painted here down to the flippers; dimmed so the parts drawn over it stand out
#   sprites        the tyre-stack bumpers and the car shrunk to size, and the lamp icons
# Usage: python3 art/compose_grandprix.py
from PIL import Image, ImageDraw, ImageEnhance, ImageChops
import os, random
SRC = 'tables/grandprix/art/src'; OUT = 'tables/grandprix/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

random.seed(11)
field = Image.new('RGBA', (W, H))
px = field.load()
for y in range(H):                                     # mown grass, in bands across
    band = (y // 18) % 2
    for x in range(W):
        g = (128, 178, 70) if band else (116, 164, 62)
        n = random.randint(-4, 4)
        px[x, y] = (g[0] + n, g[1] + n, g[2] + n, 255)
def fade(img, top, bottom):
    m = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        m.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    img.putalpha(ImageChops.multiply(img.split()[3], m))
    return img
field.alpha_composite(fade(load('grandstand.png'), 0, 24), (0, 0))
field.alpha_composite(fade(load('track.png'), 20, 30), (0, 196))
# the starting grid above the flippers: an asphalt strip with white boxes, staggered
d = ImageDraw.Draw(field)
d.rectangle([96, 448, 206, 640], fill=(70, 70, 76, 255))
for i in range(4):
    for side, x in ((0, 108), (1, 160)):
        y = 462 + i * 40 + side * 20
        d.line([x, y, x + 32, y], fill=(235, 235, 235, 255), width=2)
        d.line([x, y, x, y + 8], fill=(235, 235, 235, 255), width=2)
        d.line([x + 32, y, x + 32, y + 8], fill=(235, 235, 235, 255), width=2)
for x in range(96, 207, 6):                            # the start line, chequered
    for k in range(2):
        d.rectangle([x, 444 + k * 3, x + 2, 446 + k * 3], fill=(240, 240, 240, 255) if (x // 3 + k) % 2 else (20, 20, 20, 255))
field = ImageEnhance.Brightness(field).enhance(0.62)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    q = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = q[x, y]; q[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('tyres.png'), (24, 24)).save(os.path.join(OUT, 'tyres.png'))
shrink(load('car.png'), (12, 20)).save(os.path.join(OUT, 'car.png'))
LAMPS = {'helmet': 13, 'flag': 12, 'tyre': 13, 'wrench': 13, 'lights': 16, 'trophy': 13, 'bottle': 13, 'watch': 13,
         'wing': 15, 'star': 12, 'xball': 13}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
