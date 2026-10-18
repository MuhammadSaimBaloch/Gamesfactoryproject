"""Read publisher-image bounds for CSS framing; never alter the source bitmaps."""
import json
from pathlib import Path
from PIL import Image, ImageChops

sources = []
for filename in ['showcase-sources.json', 'platform-sources.json']:
    path = Path('public/catalogue') / filename
    if path.exists():
        sources.extend(json.loads(path.read_text(encoding='utf-8')))
bounds = {}
for source in sources:
    image = Image.open(Path('public') / source['key']).convert('RGBA')
    if image.getextrema()[3][0] < 255:
        box = image.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox()
    else:
        difference = ImageChops.difference(image.convert('RGB'), Image.new('RGB', image.size, 'white'))
        box = difference.convert('L').point(lambda value: 255 if value > 35 else 0).getbbox()
    if not box:
        continue
    left, top, right, bottom = box
    bounds[source['key']] = {'x': left, 'y': top, 'width': right-left, 'height': bottom-top, 'sourceWidth': image.width, 'sourceHeight': image.height}
Path('app/lib/showcase-crops.json').write_text(json.dumps(bounds, indent=2), encoding='utf-8')
print(f'Measured {len(bounds)} images for CSS framing. Original images unchanged.')
