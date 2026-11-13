# Builds the Angry Andy art used by the game from the Pixellab sources in tables/angryandy/art/src:
#   playfield.png  the 320x640 backdrop: the server room round the top (servers.png, the Server Room scoop sits in
#                  it), the open-plan office down the middle (office.png) and Andy's own desk under the flippers
#                  (helpdesk.png), each cropped inside its frame and faded into the next; dimmed so the parts drawn
#                  over it stand out
#   sprites        Andy (calm and furious) and the monitor bumpers shrunk to size, and the lamp icons
# Usage: python3 art/compose_angryandy.py
from PIL import Image, ImageEnhance
import os
SRC = 'tables/angryandy/art/src'; OUT = 'tables/angryandy/art'
W, H = 320, 640
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')
def fade_in(img, top, bottom):
    mask = Image.new('L', img.size)
    for y in range(img.height):
        k = min(1, y / top if top else 1, (img.height - 1 - y) / bottom if bottom else 1)
        mask.paste(int(255 * max(0, k)), (0, y, img.width, y + 1))
    img.putalpha(mask)
    return img

field = Image.new('RGBA', (W, H), (24, 26, 34, 255))
field.alpha_composite(fade_in(load('servers.png').resize((320, 240), Image.NEAREST), 0, 30), (0, 0))
office = load('office.png').crop((6, 0, 314, 240)).resize((320, 260), Image.NEAREST)
field.alpha_composite(fade_in(office, 30, 30), (0, 220))
desk = load('helpdesk.png').crop((14, 18, 306, 180)).resize((320, 170), Image.NEAREST)
field.alpha_composite(fade_in(desk, 30, 0), (0, 470))
field = ImageEnhance.Brightness(field).enhance(0.5)
field.save(os.path.join(OUT, 'playfield.png'))

def shrink(s, size):
    s = s.crop(s.getbbox()); s.thumbnail(size, Image.BOX)
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255 if a > 110 else 0)
    return s

shrink(load('andy.png'), (22, 28)).save(os.path.join(OUT, 'andy.png'))
shrink(load('andy-red.png'), (22, 28)).save(os.path.join(OUT, 'andy-red.png'))
shrink(load('monitor.png'), (22, 22)).save(os.path.join(OUT, 'monitor.png'))
LAMPS = {'printer': 13, 'phone': 12, 'email': 13, 'key': 13, 'coffee': 12, 'ticket': 12, 'wifi': 13, 'floppy': 12,
         'fire': 12, 'star': 12, 'xball': 13, 'plug': 13, 'band': 12, 'angry': 12}
for n, size in LAMPS.items(): shrink(load(f'lamp-{n}.png'), (size, size)).save(os.path.join(OUT, f'lamp-{n}.png'))
print('ok')
