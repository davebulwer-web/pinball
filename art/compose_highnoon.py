# Builds the High Noon art used by the game from the Pixellab sources in tables/highnoon/art/src:
#   playfield.png  the 320x640 backdrop: the town street at the top, the canyon and its railroad in the
#                  middle, the ranch yard above the flippers; joined with soft blends and dimmed so the parts
#                  drawn over it stand out. The saloon's sign is relettered (the generated one was gibberish).
#   sprites        the barrels, the Quick Draw figures and the stagecoach shrunk to size, and the lamp icons
#                  shrunk to inserts
# Usage: python3 art/compose_highnoon.py
from PIL import Image, ImageEnhance
import os
SRC = 'tables/highnoon/art/src'; OUT = 'tables/highnoon/art'
W, H = 320, 640

def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

# the saloon sign: paint out the generated letters and write SALOON in a 5x7 font
FONT = {'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], 'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], 'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001']}
town = load('town.png')
px = town.load()
cream = px[14, 27]
for y in range(25, 41):
    for x in range(10, 62):
        r, g, b, a = px[x, y]
        if r + g + b < 360: px[x, y] = cream
word = 'SALOON'; x0 = 36 - (len(word) * 6 - 1) // 2
for i, ch in enumerate(word):
    for j, row in enumerate(FONT[ch]):
        for k, c in enumerate(row):
            if c == '1': px[x0 + i * 6 + k, 29 + j] = (60, 34, 20, 255)

# panel, y offset on the playfield, first and last source rows used
PANELS = [(town, 0, 0, 200), (load('canyon.png'), 186, 0, 240), (load('ranch.png'), 420, 0, 220)]
BLEND = 18
field = Image.new('RGBA', (W, H), (60, 36, 18, 255))
for p, dy, r0, r1 in PANELS:
    p = p.crop((0, r0, 320, r1))
    mask = Image.new('L', p.size, 255)
    if dy > 0:
        for y in range(BLEND): mask.paste(int(255 * (y + 1) / (BLEND + 1)), (0, y, p.width, y + 1))
    field.paste(p, (0, dy), mask)
# the desert is bright: dim it so the rails, the pistols and the ball stand out
field = ImageEnhance.Brightness(field).enhance(0.5)
field = ImageEnhance.Color(field).enhance(0.85)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    px = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('barrel.png'), (26, 26)).save(os.path.join(OUT, 'barrel.png'))
for n in ('outlaw', 'outlaw2', 'folk', 'folk2'): shrink(load(f'{n}.png'), (24, 24)).save(os.path.join(OUT, f'{n}.png'))
shrink(load('coach.png'), (34, 16)).save(os.path.join(OUT, 'coach.png'))
LAMPS = {'star': 13, 'bullet': 10, 'dynamite': 13, 'gold': 12, 'wanted': 14, 'key': 12, 'train': 14, 'hat': 13, 'cactus': 12,
         'bag': 13, 'xball': 14, 'whiskey': 12, 'safe': 12, 'coach': 13}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
