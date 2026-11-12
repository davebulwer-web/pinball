# Builds the Fun Fair art used by the game from the Pixellab sources in tables/funfair/art/src:
#   playfield.png  the 320x640 backdrop: night skyline at the top, the Big Top plaza in the middle (its tent
#                  centred on the Big Top saucer), the carousel at the bottom; joined with soft blends and
#                  dimmed so the parts drawn over it stand out
#   sprites        each source sprite cropped to its pixels
# Usage: python3 art/compose_funfair.py
from PIL import Image, ImageEnhance
import os
SRC = 'tables/funfair/art/src'; OUT = 'tables/funfair/art'
W, H = 320, 640

def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

# panel name, x offset, y offset on the playfield, first and last source rows used
PANELS = [('sky.png', 0, 0, 0, 200), ('plaza.png', -9, 176, 0, 240), ('carousel.png', -9, 420, 0, 200)]
BLEND = 18   # rows over which a panel fades in over the one above

field = Image.new('RGBA', (W, H), (12, 14, 36, 255))
for name, dx, dy, r0, r1 in PANELS:
    p = load(name).crop((0, r0, 320, r1))
    # repeat the edge column where an x shift leaves a gap
    if dx < 0:
        wide = Image.new('RGBA', (320 - dx, p.height)); wide.paste(p, (0, 0))
        edge = p.crop((319, 0, 320, p.height)).resize((-dx, p.height))
        wide.paste(edge, (320, 0)); p = wide
    mask = Image.new('L', p.size, 255)
    if dy > 0:
        for y in range(BLEND): mask.paste(int(255 * (y + 1) / (BLEND + 1)), (0, y, p.width, y + 1))
    field.paste(p, (dx, dy), mask)

# dim and cool it a little so rails, lamps and the ball read clearly over it
field = ImageEnhance.Brightness(field).enhance(0.62)
field = ImageEnhance.Color(field).enhance(0.85)
field.save(os.path.join(OUT, 'playfield.png'))

for n in ['dodgem-red.png', 'dodgem-blue.png', 'dodgem-yellow.png', 'duck.png', 'coconut.png', 'ghost.png']:
    s = load(n); s.crop(s.getbbox()).save(os.path.join(OUT, n))
print('ok')
