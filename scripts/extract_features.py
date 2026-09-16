import csv
import urllib.request
import io
import colorsys
from PIL import Image

def analyze_cover(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            img = Image.open(io.BytesIO(resp.read())).convert("RGB")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

    # Downsample to 50x50 for consistent, rapid calculation
    img_small = img.resize((50, 50))
    pixels = [img_small.getpixel((x, y)) for x in range(50) for y in range(50)]
    n = len(pixels)

    # Average RGB (normalized 0 to 1)
    r_avg = sum(p[0] for p in pixels) / n / 255.0
    g_avg = sum(p[1] for p in pixels) / n / 255.0
    b_avg = sum(p[2] for p in pixels) / n / 255.0

    # Perceived brightness (ITU-R BT.601 formula)
    brightness = round(0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg, 3)

    # Average saturation from HSV
    saturations = [colorsys.rgb_to_hsv(p[0]/255, p[1]/255, p[2]/255)[1] for p in pixels]
    saturation = round(sum(saturations) / n, 3)

    # Percentage of dark (< 0.2) and light (> 0.8) pixels
    dark_count = sum(1 for p in pixels if (0.299*p[0] + 0.587*p[1] + 0.114*p[2]) / 255 < 0.2)
    light_count = sum(1 for p in pixels if (0.299*p[0] + 0.587*p[1] + 0.114*p[2]) / 255 > 0.8)
    pct_dark = round(dark_count / n * 100, 1)
    pct_light = round(light_count / n * 100, 1)

    # Dominant quantized color
    quantized = img_small.quantize(colors=1)
    palette = quantized.getpalette()[:3]
    dominant_hex = f"#{palette[0]:02x}{palette[1]:02x}{palette[2]:02x}"

    return {
        "brightness": brightness,
        "saturation": saturation,
        "pct_dark": pct_dark,
        "pct_light": pct_light,
        "dominant_color": dominant_hex
    }

def main():
    in_file = "data/albums.csv"
    out_file = "data/album_features.csv"

    with open(in_file, mode="r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    results = []
    print(f"Extracting visual features for {len(reader)} album covers...")

    for row in reader:
        print(f"  Analyzing: {row['title']} - {row['artist']}")
        features = analyze_cover(row["cover_url"])
        if features:
            merged = {**row, **features}
            results.append(merged)

    fieldnames = list(results[0].keys())
    with open(out_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\nSaved {len(results)} analyzed albums to {out_file}")

if __name__ == "__main__":
    main()
