# Builds the Race Day art used by the game from the Pixellab sources in tables/raceday/art/src:
#   playfield.png  the 320x640 backdrop: the grandstand at the top, the parade ring in the middle, the
#                  home straight (where the race toy runs) above the flippers; joined with soft blends and
#                  dimmed so the parts drawn over it stand out
#   sprites        the horses and hay bales cropped and shrunk to size, and the lamp icons shrunk to inserts
# Usage: python3 art/compose_raceday.py
from PIL import Image, ImageEnhance
import os
SRC = 'tables/raceday/art/src'; OUT = 'tables/raceday/art'
W, H = 320, 640

def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

# panel name, y offset on the playfield, first and last source rows used
PANELS = [('stands.png', 0, 0, 200), ('paddock.png', 150, 0, 240), ('straight.png', 360, 0, 220), ('straight.png', 578, 166, 220), ('straight.png', 620, 166, 220)]
BLEND = 18   # rows over which a panel fades in over the one above

field = Image.new('RGBA', (W, H), (20, 60, 30, 255))
for name, dy, r0, r1 in PANELS:
    p = load(name).crop((0, r0, 320, r1))
    mask = Image.new('L', p.size, 255)
    if dy > 0:
        for y in range(BLEND): mask.paste(int(255 * (y + 1) / (BLEND + 1)), (0, y, p.width, y + 1))
    field.paste(p, (0, dy), mask)

# a daytime course is bright: dim it more than Fun Fair so the chrome rails and the ball stand out
field = ImageEnhance.Brightness(field).enhance(0.55)
field = ImageEnhance.Color(field).enhance(0.8)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    px = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

for i in range(4): shrink(load(f'horse{i}.png'), (18, 14)).save(os.path.join(OUT, f'horse{i}.png'))
shrink(load('bale.png'), (26, 26)).save(os.path.join(OUT, 'bale.png'))
# lamp icons: Pixellab's smallest image is 32px, so they are drawn at 32 and shrunk to fit the inserts
LAMPS = {'horse': 14, 'tip': 12, 'trophy': 12, 'rosette': 14, 'xball': 14, 'coins': 14, 'hurdle': 14, 'hay': 12, 'shoe': 12, 'cap': 12, 'flag': 10}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
