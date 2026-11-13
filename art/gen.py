# Generate pixel art with Pixellab (pixflux). Reads PIXELLAB_API_KEY from the environment.
# Usage: python3 art/gen.py <out.png> <width> <height> "<description>" [seed]
#   BG=1 in the environment: a full picture with a background (playfield panels); otherwise a sprite with
#   a transparent background. Every call is logged to art/prompts/log.jsonl so any image can be made again.
import base64, json, os, sys, urllib.request
out, w, h, desc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
seed = int(sys.argv[5]) if len(sys.argv) > 5 else 0
BG = os.environ.get("BG") == "1"
body = {"description": desc, "image_size": {"width": w, "height": h}, "no_background": not BG,
        "outline": "single color black outline" if not BG else "lineless", "shading": "basic shading", "detail": "medium detail"}
if BG: body.pop("outline")
if os.environ.get("VIEW"): body["view"] = os.environ["VIEW"]
if seed: body["seed"] = seed
req = urllib.request.Request("https://api.pixellab.ai/v1/generate-image-pixflux", data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + os.environ["PIXELLAB_API_KEY"], "Content-Type": "application/json"})
d = json.load(urllib.request.urlopen(req, timeout=240))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, "wb").write(base64.b64decode(d["image"]["base64"]))
with open(os.path.join(os.path.dirname(__file__), "prompts", "log.jsonl"), "a") as f:
    f.write(json.dumps({"file": os.path.relpath(out), "size": [w, h], "description": desc, "seed": seed, "bg": BG, "view": os.environ.get("VIEW")}) + "\n")
print("ok", out, d.get("usage", ""))
