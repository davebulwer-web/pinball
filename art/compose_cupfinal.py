# Builds the Cup Final art used by the game from the Pixellab sources in tables/cupfinal/art/src:
#   playfield.png  the 320x640 backdrop: the crowd (from the stadium picture) round the top, and a pitch drawn
#                  here so its markings line up with the goal: mown stripes, the penalty area and six-yard box
#                  round the goal, the penalty spot and D, the halfway line and centre circle; dimmed so the
#                  parts drawn over it stand out
#   sprites        the football bumpers, the keeper and the defenders shrunk to size, and the lamp icons
# Usage: python3 art/compose_cupfinal.py
from PIL import Image, ImageDraw, ImageEnhance
import math, os, random
SRC = 'tables/cupfinal/art/src'; OUT = 'tables/cupfinal/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')

random.seed(7)
field = Image.new('RGBA', (W, H))
px = field.load()
for y in range(H):
    band = (y // 24) % 2
    for x in range(W):
        g = (58, 150, 52) if band else (48, 132, 44)
        n = random.randint(-6, 6)
        px[x, y] = (g[0] + n, g[1] + n, g[2] + n, 255)
d = ImageDraw.Draw(field)
LINE = (236, 240, 230, 255)
GOAL_Y = 122
d.rectangle([70, GOAL_Y, 250, 226], outline=LINE)            # penalty area
d.rectangle([116, GOAL_Y, 204, 152], outline=LINE)           # six-yard box
d.rectangle([158, 196, 161, 199], fill=LINE)                 # penalty spot
d.arc([120, 158, 200, 238], 30, 150, fill=LINE)              # the D
d.line([14, GOAL_Y, 300, GOAL_Y], fill=LINE)                 # goal line
d.line([14, 420, 300, 420], fill=LINE)                       # halfway line
d.ellipse([116, 376, 204, 464], outline=LINE)                # centre circle
d.rectangle([158, 418, 161, 421], fill=LINE)
# the crowd round the top: a strip of the stadium picture's stands, behind the goal line
stands = load('stands.png').crop((20, 18, 300, 70)).resize((320, 74), Image.NEAREST)
field.paste(stands, (0, 0))
fade = Image.new('RGBA', (W, 10), (20, 30, 20, 160)); field.alpha_composite(fade, (0, 74))
# advertising boards along the goal line ends
field = ImageEnhance.Brightness(field).enhance(0.62)
field = ImageEnhance.Color(field).enhance(0.85)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('ball.png'), (25, 25)).save(os.path.join(OUT, 'ball.png'))
shrink(load('keeper.png'), (26, 18)).save(os.path.join(OUT, 'keeper.png'))
shrink(load('defender.png'), (12, 18)).save(os.path.join(OUT, 'defender.png'))
LAMPS = {'boot': 13, 'whistle': 12, 'yellow': 10, 'red': 12, 'flag': 12, 'cup': 14, 'medal': 12, 'scarf': 12, 'glove': 12,
         'shirt': 13, 'ball': 11, 'xball': 14, 'net': 14, 'star': 13}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
