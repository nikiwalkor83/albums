import urllib.request
import urllib.error
import json
import csv
import time
import os

GENRES = ["Rock", "Pop", "Hip-Hop", "Jazz", "Electronic", "Metal"]
TARGET_PER_GENRE = 20
USER_AGENT = "MusicVisualizer/1.0 (student@university.edu)"

def get_decade(year):
    if not year or not year.isdigit():
        return "Unknown"
    y = int(year)
    return f"{(y // 10) * 10}s"

def check_cover_exists(mbid):
    url = f"https://coverartarchive.org/release-group/{mbid}/front-500"
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 307)
    except urllib.error.HTTPError as e:
        return e.code in (200, 307)
    except Exception:
        return False

def fetch_genre_albums(genre, target_count=20):
    query_genre = genre.lower().replace("-", " ")
    url = f"https://musicbrainz.org/ws/2/release-group/?query=tag:%22{query_genre}%22%20AND%20primarytype:Album&limit=100&fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    
    albums = []
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error fetching genre {genre}: {e}")
        return albums

    release_groups = data.get("release-groups", [])
    print(f"Found {len(release_groups)} candidates for {genre}. Checking covers...")

    for rg in release_groups:
        if len(albums) >= target_count:
            break
        mbid = rg.get("id")
        title = rg.get("title")
        credits = rg.get("artist-credit", [])
        artist = credits[0].get("name") if credits else "Unknown"
        rel_date = rg.get("first-release-date", "")
        year = rel_date[:4] if len(rel_date) >= 4 and rel_date[:4].isdigit() else ""
        
        if not year or int(year) < 1950 or int(year) > 2026:
            continue
            
        # Verify cover art exists
        if check_cover_exists(mbid):
            cover_url = f"https://coverartarchive.org/release-group/{mbid}/front-500"
            albums.append({
                "id": mbid,
                "title": title,
                "artist": artist,
                "year": int(year),
                "decade": get_decade(year),
                "genre": genre,
                "cover_url": cover_url
            })
            print(f"  [{genre}] Added: {title} ({year}) by {artist}")
            time.sleep(0.1)

    return albums

def main():
    os.makedirs("data", exist_ok=True)
    out_file = "data/albums.csv"
    all_albums = []

    for genre in GENRES:
        print(f"\nFetching {genre}...")
        genre_albums = fetch_genre_albums(genre, target_count=TARGET_PER_GENRE)
        all_albums.extend(genre_albums)
        time.sleep(1.0) # Respect MusicBrainz rate limits

    with open(out_file, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["id", "title", "artist", "year", "decade", "genre", "cover_url"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_albums)

    print(f"\nDone! Saved {len(all_albums)} albums to {out_file}")

if __name__ == "__main__":
    main()
