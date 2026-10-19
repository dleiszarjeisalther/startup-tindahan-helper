import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_th_icons():
    os.makedirs('assets/images', exist_ok=True)
    
    # Fonts
    font_path_bold = "C:\\Windows\\Fonts\\segoeuib.ttf"
    if not os.path.exists(font_path_bold):
        font_path_bold = "C:\\Windows\\Fonts\\arialbd.ttf"
        
    font_th = ImageFont.truetype(font_path_bold, 420)
    font_sub = ImageFont.truetype(font_path_bold, 82)

    # 1. Base 1024x1024 App Icon
    size = 1024
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Background gradient: Vibrant tindahan royal blue
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_bg = ImageDraw.Draw(bg)
    
    c_top = (32, 138, 239)    # #208AEF
    c_bottom = (10, 60, 150)  # Deep Navy
    
    for y in range(size):
        ratio = y / float(size)
        r = int(c_top[0] * (1 - ratio) + c_bottom[0] * ratio)
        g = int(c_top[1] * (1 - ratio) + c_bottom[1] * ratio)
        b = int(c_top[2] * (1 - ratio) + c_bottom[2] * ratio)
        draw_bg.line([(0, y), (size, y)], fill=(r, g, b, 255))
        
    # Decorative subtle geometric store canopy arch in background
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_ov = ImageDraw.Draw(overlay)
    draw_ov.ellipse([-100, -200, 1124, 700], fill=(255, 255, 255, 18))
    bg = Image.alpha_composite(bg, overlay)
    
    # Rounded squircle mask for standard icon
    mask = Image.new('L', (size, size), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle([0, 0, size, size], radius=220, fill=255)
    
    icon.paste(bg, (0, 0), mask)
    
    # Draw Emblem & "TH" Text
    text_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_text = ImageDraw.Draw(text_layer)
    
    # Store Roof / Canopy Accent Bar (Gold/Amber #FFB300)
    roof_w = 540
    roof_h = 36
    roof_x = (size - roof_w) // 2
    roof_y = 190
    draw_text.rounded_rectangle([roof_x, roof_y, roof_x + roof_w, roof_y + roof_h], radius=18, fill=(255, 183, 3, 255))
    
    # Small store badge notch in the center
    notch_w = 64
    notch_h = 24
    draw_text.rounded_rectangle([(size - notch_w) // 2, roof_y + roof_h - 4, (size + notch_w) // 2, roof_y + roof_h + notch_h], radius=8, fill=(255, 183, 3, 255))

    # "TH" Monogram text
    text = "TH"
    bbox = draw_text.textbbox((0, 0), text, font=font_th)
    tw = bbox[2] - bbox[0]
    th_h = bbox[3] - bbox[1]
    
    tx = (size - tw) // 2
    ty = 260
    
    # Drop shadow for TH
    shadow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_shadow = ImageDraw.Draw(shadow_layer)
    draw_shadow.text((tx, ty + 12), text, font=font_th, fill=(5, 25, 70, 130))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(14))
    
    icon = Image.alpha_composite(icon, shadow_layer)
    
    # Draw pure white "TH"
    draw_text.text((tx, ty), text, font=font_th, fill=(255, 255, 255, 255))
    
    # Subtitle "TINDAHAN HELPER"
    sub_text = "TINDAHAN HELPER"
    s_bbox = draw_text.textbbox((0, 0), sub_text, font=font_sub)
    sw = s_bbox[2] - s_bbox[0]
    sx = (size - sw) // 2
    sy = 730
    
    # Subtitle pill badge
    pill_padding_x = 44
    pill_padding_y = 18
    pill_rect = [sx - pill_padding_x, sy - pill_padding_y, sx + sw + pill_padding_x, sy + (s_bbox[3] - s_bbox[1]) + pill_padding_y + 10]
    draw_text.rounded_rectangle(pill_rect, radius=24, fill=(255, 255, 255, 35), outline=(255, 255, 255, 80), width=3)
    
    draw_text.text((sx, sy), sub_text, font=font_sub, fill=(255, 255, 255, 250))
    
    icon = Image.alpha_composite(icon, text_layer)
    icon.save('assets/images/icon.png', 'PNG')
    print("Saved assets/images/icon.png")

    # 2. Android Adaptive Icon Background (512x512)
    bg_512 = bg.resize((512, 512), Image.Resampling.LANCZOS)
    bg_512.save('assets/images/android-icon-background.png', 'PNG')
    print("Saved assets/images/android-icon-background.png")

    # 3. Android Adaptive Icon Foreground (512x512, transparent background, scaled to safe zone)
    # The adaptive icon foreground safe zone is the central 66% (diameter ~338px out of 512px)
    fg_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg_layer)
    
    # Draw TH and gold canopy scaled for safe zone
    fg_draw.rounded_rectangle([roof_x, roof_y + 30, roof_x + roof_w, roof_y + roof_h + 30], radius=18, fill=(255, 183, 3, 255))
    fg_draw.rounded_rectangle([(size - notch_w) // 2, roof_y + roof_h + 26, (size + notch_w) // 2, roof_y + roof_h + notch_h + 30], radius=8, fill=(255, 183, 3, 255))
    
    fg_draw.text((tx, ty + 20), text, font=font_th, fill=(255, 255, 255, 255))
    fg_512 = fg_layer.resize((512, 512), Image.Resampling.LANCZOS)
    fg_512.save('assets/images/android-icon-foreground.png', 'PNG')
    print("Saved assets/images/android-icon-foreground.png")

    # 4. Android Monochrome Icon (512x512, white silhouette)
    mono_layer = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    mono_draw = ImageDraw.Draw(mono_layer)
    # Extract alpha from fg_512
    r, g, b, a = fg_512.split()
    mono_layer.paste((255, 255, 255, 255), (0, 0), a)
    mono_layer.save('assets/images/android-icon-monochrome.png', 'PNG')
    print("Saved assets/images/android-icon-monochrome.png")

    # 5. Splash Screen Icon (512x512 transparent)
    splash_icon = fg_512.copy()
    splash_icon.save('assets/images/splash-icon.png', 'PNG')
    print("Saved assets/images/splash-icon.png")

    # 6. Favicon (192x192)
    fav = icon.resize((192, 192), Image.Resampling.LANCZOS)
    fav.save('assets/images/favicon.png', 'PNG')
    print("Saved assets/images/favicon.png")

if __name__ == '__main__':
    create_th_icons()
