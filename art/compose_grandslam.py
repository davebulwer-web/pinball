# Builds the Grand Slam art used by the game from the Pixellab sources in tables/grandslam/art/src:
#   playfield.png  the 320x640 backdrop: the bleachers and the outfield wall across the top (the top of
#                  stands.png), mown outfield stripes drawn here down the table, and the infield (diamond.png,
#                  its grass taken out so only the dirt and the chalk show) round the diamond above the flippers;
#                  dimmed so the parts drawn over it stand out
#   sprites        the baseball bumpers, the outfielder and the runner shrunk to size, and the lamp icons
# Usage: python3 art/compose_grandslam.py
from PIL import Image, ImageDraw, ImageEnhance
import os, random
SRC = 'tables/grandslam/art/src'; OUT = 'tables/grandslam/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

random.seed(7)
field = Image.new('RGBA', (W, H))
px = field.load()
for y in range(H):                                     # mown stripes, down the table
    for x in range(W):
        band = (x // 22) % 2
        g = (104, 178, 74) if band else (88, 160, 62)
        n = random.randint(-4, 4)
        px[x, y] = (g[0] + n, g[1] + n, g[2] + n, 255)
def fade(img, top, bottom):
    a = img.split()[3]
    m = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        m.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    from PIL import ImageChops
    img.putalpha(ImageChops.multiply(a, m))
    return img
# the bleachers and the outfield wall
field.alpha_composite(fade(load('stands.png').crop((0, 0, 320, 120)), 0, 40), (0, 0))
# the infield: dirt and chalk only, scaled so home plate is at (151, 500) and second base at (151, 401)
d = load('diamond.png')
p = d.load()
for y in range(d.height):
    for x in range(d.width):
        r, g, b, a = p[x, y]
        if g > r + 30 and g > b + 30: p[x, y] = (0, 0, 0, 0)
S = 0.75
d = d.resize((round(d.width * S), round(d.height * S)), Image.NEAREST)
field.alpha_composite(d, (round(151 - 160 * S), round(500 - 201 * S)))
field = ImageEnhance.Brightness(field).enhance(0.62)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    q = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = q[x, y]; q[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('baseball.png'), (24, 24)).save(os.path.join(OUT, 'baseball.png'))
shrink(load('fielder.png'), (22, 26)).save(os.path.join(OUT, 'fielder.png'))
shrink(load('runner.png'), (14, 14)).save(os.path.join(OUT, 'runner.png'))
LAMPS = {'ball': 12, 'base': 13, 'bat': 14, 'glove': 13, 'ump': 13, 'xball': 13, 'trophy': 13, 'foam': 14, 'star': 12,
         'pennant': 14, 'hotdog': 14}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
