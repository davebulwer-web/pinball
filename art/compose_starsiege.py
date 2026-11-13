# Builds the Star Siege art used by the game from the Pixellab sources in tables/starsiege/art/src:
#   playfield.png  the 320x640 backdrop: the ringed planet and nebula (nebula.png) round the top, the battle fleet
#                  (fleet.png) down the middle, a starfield drawn here between them, and the deck of the space
#                  station (station.png) under the flippers; dimmed so the parts drawn over it stand out
#   sprites        the mothership, asteroid bumpers, fighter and alien shrunk to size, and the lamp icons
# Usage: python3 art/compose_starsiege.py
from PIL import Image, ImageDraw, ImageEnhance
import os, random
SRC = 'tables/starsiege/art/src'; OUT = 'tables/starsiege/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

random.seed(11)
field = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(field)
for y in range(H):                                     # deep space: purple at the top, navy below
    k = max(0, min(1, (y - 160) / 120)); d.line([0, y, W, y], fill=(int(45 + (7 - 45) * k), int(3 + 4 * k), int(83 + (49 - 83) * k), 255))
for _ in range(700):                                   # the starfield
    x, y = random.randrange(W), random.randrange(H); v = random.choice([90, 130, 170, 230])
    d.point((x, y), fill=(v, v, min(255, v + 30), 255))
def fade_in(img, top, bottom):
    # fade the picture's top and bottom edges into the starfield
    mask = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        mask.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    img.putalpha(mask)
    return img
neb = load('nebula.png')                                # 320x220
field.alpha_composite(fade_in(neb, 0, 40), (0, 0))
fleet = load('fleet.png').crop((0, 0, 320, 224))       # (cropped above the corner signature)
field.alpha_composite(fade_in(fleet, 30, 30), (0, 250))
deck = load('station.png').crop((44, 60, 276, 200)).resize((320, 150), Image.NEAREST)
field.alpha_composite(fade_in(deck, 24, 0), (0, 500))
field = ImageEnhance.Brightness(field).enhance(0.5)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size, flip=False):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    if flip: s = s.transpose(Image.FLIP_TOP_BOTTOM)
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('mothership.png'), (44, 28)).save(os.path.join(OUT, 'mothership.png'))
shrink(load('asteroid.png'), (25, 25)).save(os.path.join(OUT, 'asteroid.png'))
shrink(load('fighter.png'), (14, 16)).save(os.path.join(OUT, 'fighter.png'))
shrink(load('alien.png'), (12, 16), flip=True).save(os.path.join(OUT, 'alien.png'))
LAMPS = {'planet': 14, 'rocket': 13, 'star': 12, 'laser': 13, 'shield': 12, 'medal': 13, 'hole': 13, 'alien': 12,
         'xball': 14, 'fuel': 11, 'beam': 12, 'moon': 12, 'earth': 13}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
