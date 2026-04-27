from PIL import Image, ImageDraw, ImageFont

path = r'public\assets\cat 1.png'
img = Image.open(path)
cols = 11
rows = 53
tile = 32
margin = 80
out = img.convert('RGBA')
draw = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype('arial.ttf', 14)
except Exception:
    font = ImageFont.load_default()

for r in range(rows):
    y = r * tile
    draw.rectangle([(0, y), (30, y + tile)], outline='red')
    draw.text((2, y + 8), str(r + 1), fill='red', font=font)

for c in range(cols + 1):
    x = margin + c * tile
    draw.line([(x, 0), (x, img.height)], fill='red')

out.save(r'public\assets\cat1_grid.png')
print('saved public/assets/cat1_grid.png')
