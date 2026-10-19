import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

API_KEY = "osBvMIClYssLh6mBfpFX6ZprsREsOqwvF8P7aiE5"
RENDER_URL = "https://api.shotstack.io/v1/render"

FONT_URL = "https://fonts.gstatic.com/s/opensans/v44/mem8YaGs126MiZpBA-U1UpcaXcl0Aw.ttf"
FONT_FAMILY = "mem8YaGs126MiZpBA-U1UpcaXcl0Aw"

def render_from_storyboard(storyboard_path, output_mp4_path):
    print(f"Loading Storyboard: {storyboard_path}")
    with open(storyboard_path, "r", encoding="utf-8") as f:
        storyboard = json.load(f)

    scenes = storyboard["scenes"]
    badge_clips = []
    media_clips = []
    bg_clips = []

    total_duration = sum(s["length"] for s in scenes)
    current_time = 0.0

    for i, scene in enumerate(scenes):
        duration = float(scene["length"])
        start_time = float(scene.get("start", current_time))
        current_time = start_time + duration

        # Media Clip (Video, Image, or HTML)
        if scene["type"] == "video":
            media_asset = {
                "type": "video",
                "src": scene["src"],
                "speed": float(scene.get("speed", 1.0)),
                "volume": float(scene.get("volume", 1.0))
            }
            media_clips.append({
                "asset": media_asset,
                "start": start_time,
                "length": duration,
                "fit": scene.get("fit", "crop" if scene.get("scale", 1.0) == 1.0 else "contain"),
                "scale": float(scene.get("scale", 1.0)),
                "offset": { "x": 0.0, "y": 0.04 if scene.get("scale", 1.0) < 1.0 else 0.0 },
                "transition": { "in": "fade", "out": "fade" }
            })
        elif scene["type"] == "image":
            media_asset = {
                "type": "image",
                "src": scene["src"]
            }
            media_clips.append({
                "asset": media_asset,
                "start": start_time,
                "length": duration,
                "fit": scene.get("fit", "contain"),
                "scale": float(scene.get("scale", 0.85)),
                "offset": { "x": 0.0, "y": 0.04 },
                "effect": scene.get("motion", "zoomIn"),
                "transition": { "in": "fade", "out": "fade" }
            })
        elif scene["type"] == "html":
            media_asset = {
                "type": "html",
                "html": scene["html"],
                "width": 720,
                "height": 1280
            }
            media_clips.append({
                "asset": media_asset,
                "start": start_time,
                "length": duration,
                "fit": "crop",
                "transition": { "in": "fade", "out": "fade" }
            })

        # Rich-Text Badge Clip (Official Shotstack typography engine - never cut off)
        if "badge" in scene and scene["badge"]:
            badge_title = scene["badge"]["title"]
            badge_sub = scene["badge"]["subtitle"]
            badge_text = f"{badge_title}\n{badge_sub}"

            badge_clips.append({
                "asset": {
                    "type": "rich-text",
                    "text": badge_text,
                    "font": {
                        "family": FONT_FAMILY,
                        "size": 24,
                        "weight": "700",
                        "color": "#ffffff"
                    },
                    "style": {
                        "lineHeight": 1.25
                    },
                    "background": {
                        "color": "#0d6efd",
                        "opacity": 0.95,
                        "borderRadius": 12
                    },
                    "align": {
                        "horizontal": "center",
                        "vertical": "middle"
                    }
                },
                "start": start_time,
                "length": duration,
                "width": 640,
                "height": 95,
                "position": "bottom",
                "offset": { "x": 0.0, "y": 0.05 },
                "transition": { "in": "fade", "out": "fade" }
            })

    # Dark gradient background layer
    bg_clips.append({
        "asset": {
            "type": "html",
            "html": "<div style='width:100%;height:100%;background:linear-gradient(180deg,#0a1128 0%,#1e293b 100%);'></div>",
            "width": 720,
            "height": 1280
        },
        "start": 0.0,
        "length": total_duration
    })

    # Tracks ordered top to bottom:
    # 0: Badge overlay (rich-text)
    # 1: Media (video / image / html)
    # 2: Background gradient
    tracks = [
        { "clips": badge_clips },
        { "clips": media_clips },
        { "clips": bg_clips }
    ]

    # Process Audio Tracks (Voiceover & Music)
    audio_config = storyboard.get("audio", {})
    if "voiceover" in audio_config:
        vo = audio_config["voiceover"]
        tracks.append({
            "clips": [
                {
                    "asset": {
                        "type": "audio",
                        "src": vo["src"],
                        "volume": float(vo.get("volume", 1.0))
                    },
                    "start": float(vo.get("start", 0.0)),
                    "length": float(vo.get("length", total_duration))
                }
            ]
        })

    if "music" in audio_config:
        bgm = audio_config["music"]
        tracks.append({
            "clips": [
                {
                    "asset": {
                        "type": "audio",
                        "src": bgm["src"],
                        "volume": float(bgm.get("volume", 0.18))
                    },
                    "start": float(bgm.get("start", 0.0)),
                    "length": float(bgm.get("length", total_duration))
                }
            ]
        })

    edit_payload = {
        "timeline": {
            "fonts": [
                { "src": FONT_URL }
            ],
            "background": "#0a1128",
            "tracks": tracks
        },
        "output": {
            "format": "mp4",
            "resolution": "sd",
            "aspectRatio": "9:16",
            "fps": 30
        }
    }

    print(f"Total Duration: {total_duration:.2f}s across {len(scenes)} scenes.")
    print(f"Total Tracks: {len(tracks)} (Badges: {len(badge_clips)}, Media: {len(media_clips)})")
    print("Submitting render job to Shotstack API...")
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(RENDER_URL, data=json.dumps(edit_payload).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            render_id = res["response"]["id"]
            print(f"Render queued successfully! ID: {render_id}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"HTTP Error {e.code}: {err_msg}")
        return None

    print("Polling render status...")
    for attempt in range(45):
        time.sleep(3)
        poll_req = urllib.request.Request(f"{RENDER_URL}/{render_id}", headers={"x-api-key": API_KEY}, method="GET")
        try:
            with urllib.request.urlopen(poll_req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                status = data["response"]["status"]
                print(f"  [{attempt+1}] Status: {status}")
                if status == "done":
                    video_url = data["response"]["url"]
                    print("\n=======================================================")
                    print(f"RENDER SUCCESSFUL! Output Video URL:")
                    print(video_url)
                    print("=======================================================\n")
                    
                    # Save metadata
                    meta_path = r"c:\Developer\startupTindahanHelper\marketing\video\final_ad_render_result.json"
                    with open(meta_path, "w", encoding="utf-8") as out_f:
                        json.dump(data["response"], out_f, indent=2)
                    
                    # Download output MP4
                    print(f"Downloading final video to {output_mp4_path}...")
                    urllib.request.urlretrieve(video_url, output_mp4_path)
                    file_size_mb = os.path.getsize(output_mp4_path) / (1024 * 1024)
                    print(f"Download complete: {file_size_mb:.2f} MB")
                    return video_url
                elif status == "failed":
                    print(f"Render failed: {data['response'].get('error')}")
                    return None
        except urllib.error.HTTPError as e:
            print(f"Polling HTTP Error {e.code}: {e.read().decode('utf-8')}")
            time.sleep(2)
            
    print("Render timed out waiting for completion.")
    return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--storyboard", default=r"c:\Developer\startupTindahanHelper\marketing\video\storyboard-user-sequence.json")
    parser.add_argument("--output", default=r"c:\Developer\startupTindahanHelper\marketing\video\startup-tindahan-helper-final-ad.mp4")
    args = parser.parse_args()
    render_from_storyboard(args.storyboard, args.output)
