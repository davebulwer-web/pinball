# Builds the Fergus art used by the game from the Pixellab sources in tables/fergus/art/src:
#   playfield.png  the 320x640 backdrop: the wedding dance floor round the top (dance.png, the Friend Zone sits on
#                  it), the pub down the middle (pub.png) and the cafe under the flippers (cafe.png), each cropped
#                  inside its frame and faded into the next; dimmed so the parts drawn over it stand out
#   sprites        Fergus, his two friends and the pint bumpers shrunk to size, and the lamp icons
# Usage: python3 art/compose_fergus.py
from PIL import Image, ImageEnhance
import os
SRC = 'tables/fergus/art/src'; OUT = 'tables/fergus/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')
def fade_in(img, top, bottom):
    mask = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        mask.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    img.putalpha(mask)
    return img

field = Image.new('RGBA', (W, H), (36, 18, 30, 255))
field.alpha_composite(fade_in(load('dance.png').resize((320, 240), Image.NEAREST), 0, 30), (0, 0))
pub = load('pub.png').crop((36, 24, 284, 212)).resize((320, 260), Image.NEAREST)
field.alpha_composite(fade_in(pub, 30, 30), (0, 220))
cafe = load('cafe.png').crop((10, 8, 310, 192)).resize((320, 170), Image.NEAREST)
field.alpha_composite(fade_in(cafe, 30, 0), (0, 470))
field = ImageEnhance.Brightness(field).enhance(0.55)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('fergus.png'), (22, 28)).save(os.path.join(OUT, 'fergus.png'))
shrink(load('friend1.png'), (16, 24)).save(os.path.join(OUT, 'friend1.png'))
shrink(load('friend2.png'), (18, 24)).save(os.path.join(OUT, 'friend2.png'))
shrink(load('pint.png'), (18, 24)).save(os.path.join(OUT, 'pint.png'))
LAMPS = {'broken': 13, 'glasses': 14, 'coffee': 12, 'rose': 13, 'ring': 13, 'phone': 12, 'note': 12, 'hug': 14, 'star': 12,
         'xball': 13, 'comb': 12, 'disco': 12, 'heart': 11}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
