#!/usr/bin/env python3
"""Build snacks / qsr / gift catalog JSONs from scraped Bikanervala +
Haldiram's data. Emits three files into scripts/seed-data/ for
seed-catalog.ts. Test data only.
"""
import json, re, os
from html import unescape
from collections import defaultdict

ROOT = "/Users/ravibyakod/WORK/mithai-shop/mithai-shop/.claude/worktrees/mishran-mobile"
OUT = f"{ROOT}/scripts/seed-data"

def strip_html(s):
    if not s: return ""
    s = re.sub(r"<[^>]+>", " ", s); s = unescape(s)
    return re.sub(r"\s+", " ", s).strip()

def slugify(t):
    return re.sub(r"[^a-z0-9]+","-", t.lower().replace("'","")).strip("-")

def load(path):
    return json.load(open(path))["products"]

def norm(p, source="bikanervala"):
    v = (p.get("variants") or [{}])[0]
    opts = [o.get("values",[]) for o in p.get("options",[]) if "weight" not in o.get("name","").lower()]
    weight = next((vals[0] for vals in opts if vals and vals[0] != "Default Title"), "1 pack")
    price = v.get("price")
    return dict(
        name=p["title"].strip(),
        handle=p["handle"],
        description=strip_html(p.get("body_html")),
        price=int(float(price)) if price else None,
        weight=weight,
        images=[i["src"] for i in p.get("images",[])][:2],
        product_type=p.get("product_type",""),
        sourceUrl=f"https://bikanervala.com/products/{p['handle']}",
    )

# ---------- SNACKS ----------
SNACK_SOURCES = {  # collection file -> snack-products category
    "bv-snack-namkeen.json":"namkeen", "bv-snack-bhujia-sev.json":"namkeen",
    "bv-snack-mixture.json":"namkeen", "bv-snack-khakhra.json":"namkeen",
    "bv-snack-matthi.json":"namkeen", "bv-snack-chips.json":"namkeen",
    "bv-snack-papad.json":"namkeen", "bv-snack-namak-para.json":"namkeen",
    "bv-snack-samosa.json":"namkeen", "bv-snack-fox-nut.json":"namkeen",
    "bv-snack-cookies.json":"cookie", "bv-rusk.json":"cookie", "bv-snack-dried-fruits.json":"dry-fruit",
}
PER_CAT = {"namkeen": 14, "cookie": 6, "dry-fruit": 4}
seen, snacks = set(), []
percat = defaultdict(int)
for f, cat in SNACK_SOURCES.items():
    for p in load(f"/tmp/scrape/{f}"):
        n = norm(p)
        if n["handle"] in seen or not n["images"] or percat[cat] >= PER_CAT[cat]: continue
        seen.add(n["handle"]); percat[cat] += 1
        snacks.append(dict(
            name=n["name"], category=cat, weight=n["weight"],
            description=n["description"],
            msrp=f"₹{n['price']:,}" if n["price"] else "Price on request",
            images=n["images"], source="bikanervala", sourceUrl=n["sourceUrl"],
        ))

# ---------- QSR ----------
QSR_SOURCES = ["bv-qsr-ready-to-eat.json","bv-qsr-ready-to-eat-paneer.json",
               "bv-qsr-ready-to-eat-rice.json","bv-qsr-curry-vegetables.json"]
seen, qsr = set(), []
for f in QSR_SOURCES:
    for p in load(f"/tmp/scrape/{f}"):
        if p.get("product_type") != "cooking": continue  # skip sweets in RTE list
        n = norm(p)
        if n["handle"] in seen or not n["images"]: continue
        seen.add(n["handle"])
        t = n["name"].lower()
        cat = "chole-bhature" if re.search(r"chole|choley|chana", t) else "thaali"
        spice = "hot" if re.search(r"spicy|hot|mirchi", t) else "medium" if re.search(r"masala|tikka|paneer", t) else "mild"
        qsr.append(dict(
            name=n["name"], category=cat, description=n["description"],
            veg=True, spiceLevel=spice,
            price=f"₹{n['price']:,}" if n["price"] else "Price on request",
            images=n["images"][:1], source="bikanervala", sourceUrl=n["sourceUrl"],
        ))
# Haldiram's ready meals (og-scraped earlier) — add variety. Most product
# pages expose no og:image to curl, so fall back to freely-licensed dish
# photos from Wikimedia Commons (source marked for provenance).
WIKIMEDIA_DISH_IMAGES = {
    "choley-chawal": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Chole_Chawal_%28Indian_delicacy%29.jpg/960px-Chole_Chawal_%28Indian_delicacy%29.jpg",
    "dal-palak": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Dal_palak_casserole.jpg/960px-Dal_palak_casserole.jpg",
    "dal-tadka": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Dal_Tadka-Delhi.jpg/960px-Dal_Tadka-Delhi.jpg",
    "dal-tadka-with-jeera-rice": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Dal_Tadka-Delhi.jpg/960px-Dal_Tadka-Delhi.jpg",
    "dum-biryani": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Veg_biryani.jpg/960px-Veg_biryani.jpg",
    "mutter-paneer": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Matar-Paneer.JPG/960px-Matar-Paneer.JPG",
    "palak-paneer": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg/960px-Palakpaneer_Rayagada_Odisha_0009.jpg",
}
for h in json.load(open("/tmp/scrape/haldirams-meals.json")):
    img = h.get("image") or WIKIMEDIA_DISH_IMAGES.get(h["handle"])
    qsr.append(dict(
        name=h["name"], category="chole-bhature" if "choley" in h["handle"] else "thaali",
        description=h.get("description",""), veg=True,
        spiceLevel="medium" if re.search(r"masala|tikka|paneer|biryani", h["name"], re.I) else "mild",
        price="₹ on request / pack", images=[img] if img else [],
        source="haldirams" if h.get("image") else "wikimedia-commons",
        sourceUrl=f"https://haldirams.com/product/sweets/{h['handle']}",
    ))

# ---------- GIFT ----------
GIFT_SOURCES = ["bv-gift-gift-hampers.json","bv-gift-dry-fruits-thal.json","bv-gift-gifting.json","bv-gift-gift-hamper.json"]
seen, gifts = set(), []
for f in GIFT_SOURCES:
    for p in load(f"/tmp/scrape/{f}"):
        n = norm(p)
        if n["handle"] in seen or not n["images"] or len(gifts) >= 22: continue
        seen.add(n["handle"])
        gifts.append(dict(
            name=n["name"], size="custom",
            compartmentLayout=n["description"][:300] or "Assorted sweets and snacks in a keepsake gift box.",
            displayPrice=f"₹{n['price']:,}" if n["price"] else "Price on request",
            images=n["images"][:2], source="bikanervala", sourceUrl=n["sourceUrl"],
        ))

for name, data in [("snacks-catalog.json", snacks), ("qsr-catalog.json", qsr), ("gift-catalog.json", gifts)]:
    json.dump({"generated":"scraped from bikanervala.com + haldirams.com (test seed data)","products":data},
              open(f"{OUT}/{name}","w"), indent=2, ensure_ascii=False)
    print(f"{name}: {len(data)}")
print("snacks by cat:", dict(percat))
print("qsr by cat:", dict(__import__('collections').Counter(q['category'] for q in qsr)))
