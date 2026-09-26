# tools/generate_icons.py —— 依赖 Pillow（pip install pillow），一次性工具
from PIL import Image, ImageDraw

def make(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = size * 0.22
    d.rounded_rectangle([size*0.06, size*0.06, size*0.94, size*0.94], radius=r, fill=(37, 99, 235, 255))
    # 卡片叠层：三层横条象征历史卡片组
    for i, alpha in enumerate((120, 180, 255)):
        y0 = size * (0.28 + 0.18 * i)
        d.rounded_rectangle([size*0.22, y0, size*0.78, y0 + size*0.10],
                            radius=size*0.05, fill=(255, 255, 255, alpha))
    img.save(path)

for s, name in ((16, "icon16.png"), (48, "icon48.png"), (128, "icon128.png")):
    make(s, f"icons/{name}")
print("icons generated")
