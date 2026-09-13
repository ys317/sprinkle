# Stitch demo frames into an animated GIF. Usage: python make_gif.py out.gif frame1.png:ms frame2.png:ms ...
import sys
from PIL import Image
out = sys.argv[1]
frames, durations = [], []
for arg in sys.argv[2:]:
    path, ms = arg.rsplit(':', 1)
    im = Image.open(path).convert('RGB')
    im.thumbnail((960, 960), Image.LANCZOS)
    frames.append(im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    durations.append(int(ms))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)
import os
print(out, os.path.getsize(out) // 1024, 'KB', len(frames), 'frames')
