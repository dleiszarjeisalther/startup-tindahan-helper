import pymupdf
from PIL import Image

svg_code = r"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#0F172A" flood-opacity="0.25"/>
    </filter>
  </defs>

  <g filter="url(#shadow)">
    <!-- Back cuff depth ellipse -->
    <ellipse cx="270" cy="425" rx="72" ry="24" fill="#CBD5E1" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />

    <!-- Curled pinky finger (bottom right) -->
    <path d="M 330 330 C 385 335, 398 375, 360 405 C 330 422, 300 405, 310 368 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />

    <!-- Curled ring finger (mid right) -->
    <path d="M 312 272 C 372 276, 385 322, 348 352 C 318 372, 290 355, 298 312 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />

    <!-- Curled middle finger (upper right) -->
    <path d="M 285 218 C 350 222, 365 272, 325 304 C 290 330, 265 310, 270 262 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />

    <!-- Folded thumb on left side of palm -->
    <path d="M 165 280 C 115 295, 95 340, 130 380 C 160 415, 205 395, 212 350 C 218 315, 195 272, 165 280 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />

    <!-- Continuous Clockwise Palm and Pointer Index Finger -->
    <!-- Starts at left wrist (160, 395) -->
    <!-- Up left side of palm to base of index finger (135, 220) -->
    <!-- Up left side of index finger to (70, 95) -->
    <!-- Smooth rounded fingertip arc from (70, 95) to (105, 110) -->
    <!-- Down right side of index finger to (170, 235) -->
    <!-- Top knuckle curve of palm to middle finger (275, 225) -->
    <!-- Right side of palm to (315, 345) -->
    <!-- Bottom of palm to (240, 405) -->
    <!-- Closes back to (160, 395) -->
    <path d="M 160 395
             C 140 350, 135 280, 135 220
             L 70 95
             C 58 72, 92 56, 106 78
             L 170 205
             C 195 195, 240 195, 275 225
             C 320 250, 325 305, 315 345
             C 305 390, 275 405, 230 405
             C 190 405, 175 400, 160 395 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" />

    <!-- Soft accent curves on index finger joints -->
    <path d="M 85 118 C 93 112, 103 116, 109 124" stroke="#CBD5E1" stroke-width="7" stroke-linecap="round" fill="none" />
    <path d="M 112 165 C 120 158, 130 162, 138 170" stroke="#CBD5E1" stroke-width="7" stroke-linecap="round" fill="none" />

    <!-- 3 Classic Mickey Dorsal Dart Lines (\ | /) with rounded stitch endpoints -->
    <!-- Left Dart -->
    <path d="M 205 265 L 192 322" stroke="#1E293B" stroke-width="12" stroke-linecap="round" />
    <circle cx="191" cy="328" r="5.5" fill="#1E293B" />

    <!-- Center Dart -->
    <path d="M 235 258 L 235 324" stroke="#1E293B" stroke-width="12" stroke-linecap="round" />
    <circle cx="235" cy="331" r="5.5" fill="#1E293B" />

    <!-- Right Dart -->
    <path d="M 265 265 L 278 322" stroke="#1E293B" stroke-width="12" stroke-linecap="round" />
    <circle cx="279" cy="328" r="5.5" fill="#1E293B" />

    <!-- Puffed Gauntlet Wrist Cuff (Rolled Donut Rim) -->
    <path d="M 160 392 C 205 372, 305 365, 348 400 C 372 418, 360 458, 320 464 C 260 472, 180 468, 145 435 C 128 418, 138 400, 160 392 Z" 
          fill="#FFFFFF" stroke="#1E293B" stroke-width="15" stroke-linejoin="round" />
    <!-- Cuff rim shadow crease -->
    <path d="M 185 412 C 230 396, 300 396, 335 416" stroke="#E2E8F0" stroke-width="9" stroke-linecap="round" fill="none" />
  </g>
</svg>
"""

doc = pymupdf.open(stream=svg_code.encode("utf-8"), filetype="svg")
page = doc[0]
pix = page.get_pixmap(alpha=True, dpi=144)
temp_path = "assets/images/temp_glove.png"
pix.save(temp_path)

im = Image.open(temp_path)
bbox = im.getbbox()
margin = 12
crop_box = (
    max(0, bbox[0] - margin),
    max(0, bbox[1] - margin),
    min(im.width, bbox[2] + margin),
    min(im.height, bbox[3] + margin),
)
cropped = im.crop(crop_box)

final_target = "assets/images/mickey_glove_pointer.png"
cropped.save(final_target, "PNG")

alpha = cropped.split()[-1]
pts = [(x, y) for y in range(cropped.height) for x in range(cropped.width) if alpha.getpixel((x, y)) > 128]
min_y = min(p[1] for p in pts)
top_pts = [p for p in pts if p[1] == min_y]
fingertip = top_pts[len(top_pts) // 2]

print(f"Final image size: {cropped.width} x {cropped.height}")
print(f"Fingertip hotspot: X={fingertip[0]}, Y={fingertip[1]}")
print(f"Fingertip percentage: X={fingertip[0]/cropped.width:.4f}, Y={fingertip[1]/cropped.height:.4f}")
