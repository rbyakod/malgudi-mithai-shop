#!/usr/bin/env python3
"""Build a normalized mithai catalog from scraped Shopify/og sources.
Classifies each product into one of the 5 Mishran families, dedupes across
sources (Bikanervala preferred — richest data), caps each family at a target,
and emits scripts/seed-data/mithai-catalog.json for seed-catalog.ts to ingest.
"""
import json, re, os
from html import unescape

ROOT = "/Users/ravibyakod/WORK/mithai-shop/mithai-shop/.claude/worktrees/mishran-mobile"
OUT_DIR = f"{ROOT}/scripts/seed-data"
os.makedirs(OUT_DIR, exist_ok=True)

TARGET_PER_FAMILY = 14  # 14 * 5 families = 70 products

# ---- explicit family keyword sets (title-based) ----
SEASONAL = {"gond laddu","gur til buggha","shahi til buggha","plain til buggha",
    "panjeeri laddu","shahi pinni","anjeer dry fruit laddu","dry fruits laddu",
    "atta laddu","bikanervala khajoor box","pista khajoor","badam khajoor",
    "tilkut","mothichoor winter","mango halwa"}
REGIONAL = {"mysore pak","karachi halwa","dhoda burfi","sohan halwa","balushahi",
    "chandrakala","ghar ki gujia","kheer kadam","special patisa","soan papdi",
    "soan papdi desi ghee","rasgulla","agra taj petha","khoya mathura peda",
    "longlata gujia sweet"}
ORIGINAL = {"kaju apple","kaju lemon","kaju paan","kaju honey dew","kaju cassata",
    "kaju rose cake","kaju anjeer roll","kaju anjeer cake","kaju chocolate burfi",
    "khoya chocolate burfi","kiwi burfi","kiwi delights","chocolate laddu",
    "white chocolate laddu","mewa bite","mewa bite badam","mewa bite chocolate",
    "mewa bite orange","mewa bite rose","baklava","baklava pista pyramid",
    "kaju pyramid baklava","bikanervala shahi laddu","kaju kalash","orange burfee",
    "assorted chikki","assorted dry fruit bites","karachi halwa" if False else "kaju samosa",
    "gujia samosa","bikanervala diamond mix","bikanervala diamond super mix"}

def strip_html(s):
    if not s: return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def detect_allergens(name, desc=""):
    t = (name + " " + desc).lower()
    a = []
    if re.search(r"cashew|kaju|badam|almond|pista|pistachio|dry ?fruit|anjeer", t): a.append("tree-nuts")
    if re.search(r"milk|khoya|peda|burfi|barfi|halwa|kheer|katli|laddu|rosogulla|rasgulla|jamun|petha", t): a.append("milk")
    if re.search(r"besan|atta|wheat|chickpea|gujia|samosa|namkeen|bhujia", t): a.append("gluten")
    if re.search(r"ghee", t): pass
    return a or ["milk"]

def slugify(t):
    s = re.sub(r"[^a-z0-9]+","-", t.lower().replace("'","")).strip("-")
    return s

def classify(name, source_is_sugarfree):
    key = name.lower().strip()
    if source_is_sugarfree or re.search(r"sugar[ -]?free|sugarless", key):
        return "sugar-free"
    if key in SEASONAL: return "seasonal"
    if key in REGIONAL: return "regional"
    if key in ORIGINAL: return "original"
    # default: timeless staples → classic
    return "classic"

def freshness(name):
    k = name.lower()
    if re.search(r"khajoor|chikki|dry ?fruit bite|baklava|sugar ?free|petha|tin|packed", k): return "batch-frozen"
    if re.search(r"katli|burfi|laddu|peda|halwa|jamun|rosogulla|rasgulla", k): return "made-to-order"
    return "made-daily"

def shelf(name, family):
    k = name.lower()
    if family == "sugar-free" or re.search(r"khajoor|chikki|dry ?fruit|baklava|petha", k): return "15-20 days"
    if re.search(r"katli|laddu|burfi|peda|halwa", k): return "7-10 days"
    return "5-7 days"

def from_bikanervala():
    d = json.load(open("/tmp/scrape/bikanervala-sweets.json"))
    out = []
    for p in d["products"]:
        v = (p.get("variants") or [{}])[0]
        weights = [o.get("values",[]) for o in p.get("options",[]) if "weight" in o.get("name","").lower()]
        weight = (weights[0][0] if weights and weights[0] else "500g")
        price = v.get("price")
        imgs = [i["src"] for i in p.get("images",[])][:2]
        out.append(dict(
            name=p["title"].strip(),
            family=None,
            description=strip_html(p.get("body_html")),
            displayPrice=f"₹{int(float(price)):,} / {weight}" if price else "Price on request",
            weight=weight,
            images=imgs,
            allergens=detect_allergens(p["title"]),
            source="bikanervala",
            sourceUrl=f"https://bikanervala.com/products/{p['handle']}",
            tags=[t for t in p.get("tags",[]) if t][:5],
        ))
    return out

def from_haldirams():
    d = json.load(open("/tmp/scrape/haldirams-products.json"))
    out = []
    for p in d:
        out.append(dict(
            name=re.sub(r"\s*[–\-].*$","",p["title"]).strip(),  # drop tagline after em-dash
            family=None,
            description=p.get("description",""),
            displayPrice="₹ on request / pack",
            weight="250g",
            images=[p["image"]] if p.get("image") else [],
            allergens=detect_allergens(p["title"], p.get("description","")),
            source="haldirams",
            sourceUrl=f"https://haldirams.com/product/premium-sweets/{p['handle']}",
            tags=["premium-sweets"],
        ))
    return out

def from_anand(coll, sugarfree=True):
    d = json.load(open(f"/tmp/scrape/anand-{coll}.json"))
    out = []
    for p in d["products"]:
        v = (p.get("variants") or [{}])[0]
        price = v.get("price")
        imgs = [i["src"] for i in p.get("images",[])][:2]
        out.append(dict(
            name=p["title"].strip(),
            family=None,
            description=strip_html(p.get("body_html")),
            displayPrice=f"₹{int(float(price)):,} / pack" if price else "Price on request",
            weight="130g",
            images=imgs,
            allergens=detect_allergens(p["title"], strip_html(p.get("body_html"))),
            source="anand",
            sourceUrl=f"https://anandsweets.in/products/{p['handle']}",
            tags=[coll],
            _sugarfree=sugarfree,
        ))
    return out

products = []
products += from_bikanervala()
products += from_haldirams()
products += from_anand("guilt-free", True)
products += from_anand("healthy-laddu", True)
products += from_anand("sugar-free-sweets", True)

# classify
for p in products:
    p["family"] = classify(p["name"], p.pop("_sugarfree", False))
    p["freshnessStatus"] = freshness(p["name"])
    p["shelfLife"] = shelf(p["name"], p["family"])
    p["storage"] = "Room temperature, airtight container."
    p["slug"] = slugify(p["name"])
    p["dietaryTags"] = (["vegetarian"] + (["sugar-free"] if p["family"]=="sugar-free" else []))

# dedupe by slug, prefer source order (bikanervala, haldirams, anand)
seen, dedup = set(), []
for p in products:
    if p["slug"] in seen or not p["images"]:
        continue
    seen.add(p["slug"]); dedup.append(p)

# select per family (cap at TARGET), keep source variety
from collections import defaultdict
by_fam = defaultdict(list)
for p in dedup:
    by_fam[p["family"]].append(p)

final = []
for fam in ["classic","original","regional","seasonal","sugar-free"]:
    items = by_fam[fam][:TARGET_PER_FAMILY]
    for p in items: p.pop("tags", None)
    final += items
    print(f"  {fam:12s} {len(items):3d}")

# ensure unique slugs across final
used = set()
for p in final:
    base, i = p["slug"], 1
    while p["slug"] in used:
        p["slug"] = f"{base}-{i}"; i += 1
    used.add(p["slug"])

out = {"generated": "scraped from bikanervala.com, haldirams.com, anandsweets.in (test seed data)",
       "families": ["classic","original","sugar-free","regional","seasonal"],
       "products": final}
json.dump(out, open(f"{OUT_DIR}/mithai-catalog.json","w"), indent=2, ensure_ascii=False)
print(f"\nwrote {len(final)} products to {OUT_DIR}/mithai-catalog.json")
