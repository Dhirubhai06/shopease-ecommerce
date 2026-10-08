import json
import logging
import re
from decimal import Decimal

import requests
from django.conf import settings
from django.db.models import Q

from .models import Category, Product

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SORT_FIELDS = {"price_asc": "price", "price_desc": "-price", "newest": "-id"}


def _system_prompt(categories):
    cat_lines = "\n".join(f"{c.id}: {c.name}" for c in categories) or "none"
    return (
        "You convert a shopping request into search filters for an online store. "
        "The request can be in English, Hindi or Hinglish. "
        "Reply with ONLY a JSON object with these keys:\n"
        '- "keywords": list of up to 3 short ENGLISH product words (like "phone", "laptop"), or []\n'
        '- "category_id": an id from the category list below, or null\n'
        '- "min_price": number or null\n'
        '- "max_price": number or null\n'
        '- "sort": "price_asc", "price_desc", "newest" or null\n'
        'Rules: "sasta"/"cheap" means sort price_asc. "neeche"/"under"/"tak" sets max_price. '
        '"mehenga"/"premium" means sort price_desc. Never invent categories.\n'
        f"Categories:\n{cat_lines}"
    )


def validate_filters(data, valid_category_ids):
    """LLM ka jawab kabhi bhi galat ho sakta hai, isliye har cheez check hoti hai."""
    if not isinstance(data, dict):
        return {}
    clean = {}

    keywords = data.get("keywords")
    if isinstance(keywords, list):
        words = [str(k).strip()[:30] for k in keywords if str(k).strip()]
        if words:
            clean["keywords"] = words[:3]

    category_id = data.get("category_id")
    if (
        isinstance(category_id, int)
        and not isinstance(category_id, bool)
        and category_id in valid_category_ids
    ):
        clean["category_id"] = category_id

    for key in ("min_price", "max_price"):
        if data.get(key) is None:
            continue
        try:
            value = Decimal(str(data.get(key)))
            if value.is_finite() and value >= 0:
                clean[key] = value
        except Exception:
            pass

    if "min_price" in clean and "max_price" in clean and clean["min_price"] > clean["max_price"]:
        clean["min_price"], clean["max_price"] = clean["max_price"], clean["min_price"]

    if data.get("sort") in SORT_FIELDS:
        clean["sort"] = data["sort"]

    return clean


def parse_query(query):
    if not settings.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY set nahi hai (.env check karo, server restart karo)")

    categories = list(Category.objects.all())
    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.GROQ_MODEL,
            "messages": [
                {"role": "system", "content": _system_prompt(categories)},
                {"role": "user", "content": query},
            ],
            "temperature": 0,
            "max_tokens": 200,
            "response_format": {"type": "json_object"},
        },
        timeout=10,
    )
    if not response.ok:
        # Groq ka asli error (galat model, galat key, rate limit...)
        raise RuntimeError(
            f"Groq {response.status_code}: {response.text[:300]}")

    content = response.json()["choices"][0]["message"]["content"]
    return validate_filters(json.loads(content), {c.id for c in categories})


# ---------- Fallback: AI na chale tab bhi basic Hinglish samajh le ----------

STOPWORDS = {
    "ke", "ki", "ka", "ko", "se", "me", "mein", "par", "pe", "aur", "hai", "ho",
    "achha", "accha", "acha", "achhe", "acche", "best", "good", "nice", "mujhe",
    "dikhao", "dikha", "dikhana", "batao", "chahiye", "chahie", "dena", "do",
    "show", "me", "find", "want", "need", "the", "a", "an", "for", "with", "and",
    "neeche", "niche", "under", "below", "tak", "andar", "kam", "less", "than",
    "upar", "ooper", "above", "over", "zyada", "more", "rs", "rupees", "rupaye",
    "sasta", "sasti", "cheap", "mehenga", "mehnga", "premium", "expensive",
}
MAX_CUES = {"neeche", "niche", "under", "below", "tak", "andar", "kam", "less"}
MIN_CUES = {"upar", "ooper", "above", "over", "zyada", "more"}


def fallback_filters(query):
    """AI fail ho jaye to simple rules se filters banao (number, neeche/upar, sasta/mehenga)."""
    text = query.lower().replace("₹", " ")
    tokens = re.findall(r"[a-z]+|\d[\d,]*k?", text)
    filters = {}

    price = None
    for t in tokens:
        if t[0].isdigit():
            raw = t.replace(",", "")
            mult = 1000 if raw.endswith("k") else 1
            raw = raw.rstrip("k")
            if raw.isdigit():
                price = Decimal(raw) * mult
                break

    if price is not None:
        if any(t in MIN_CUES for t in tokens) and not any(t in MAX_CUES for t in tokens):
            filters["min_price"] = price
        else:
            filters["max_price"] = price

    if any(t in {"sasta", "sasti", "cheap"} for t in tokens):
        filters["sort"] = "price_asc"
    elif any(t in {"mehenga", "mehnga", "premium", "expensive"} for t in tokens):
        filters["sort"] = "price_desc"

    words = [t for t in tokens if t.isalpha() and len(t) >
             2 and t not in STOPWORDS]
    if words:
        filters["keywords"] = words[:3]
    return filters


def _apply(filters, use_keywords=True):
    qs = Product.objects.all()
    words = list(filters.get("keywords") or []) if use_keywords else []
    cat_id = filters.get("category_id")

    if cat_id:
        # category mili to wahi sabse pakki cheez hai: sirf us category ke products
        qs = qs.filter(category_id=cat_id)

        # keyword agar category ka hi naam dohra raha hai (laptop / laptops),
        # to usse name/description me dobara mat dhundho
        cat_name = (
            Category.objects.filter(id=cat_id).values_list(
                "name", flat=True).first() or ""
        ).lower().rstrip("s")

        def restates(word):
            w = word.lower().rstrip("s")
            return bool(w) and bool(cat_name) and (w in cat_name or cat_name in w)

        words = [w for w in words if not restates(w)]

    if "min_price" in filters:
        qs = qs.filter(price__gte=filters["min_price"])
    if "max_price" in filters:
        qs = qs.filter(price__lte=filters["max_price"])

    if words:
        q = Q()
        for word in words:
            q |= Q(name__icontains=word) | Q(description__icontains=word)
        qs = qs.filter(q)

    if filters.get("sort"):
        qs = qs.order_by(SORT_FIELDS[filters["sort"]])
    return qs


def run_search(filters):
    products = list(_apply(filters))
    # Keywords ne sab hata diya, to sirf category/price se dobara try
    other = {"category_id", "min_price", "max_price"} & filters.keys()
    if not products and filters.get("keywords") and other:
        products = list(_apply(filters, use_keywords=False))
    return products


def describe(filters):
    """Frontend par chips dikhane ke liye padhne layak summary."""
    parts = []
    cat_name = ""
    if "category_id" in filters:
        cat = Category.objects.filter(id=filters["category_id"]).first()
        if cat:
            cat_name = cat.name
            parts.append(f"Category: {cat.name}")

    keywords = filters.get("keywords") or []
    if cat_name:
        # keyword agar category ka hi naam dohra raha ho, to chip mat dikhao
        c = cat_name.lower().rstrip("s")
        keywords = [
            k for k in keywords
            if not (k.lower().rstrip("s") in c or c in k.lower().rstrip("s"))
        ]
    if keywords:
        parts.append("Keywords: " + ", ".join(keywords))

    if "min_price" in filters:
        parts.append(f"From ₹{filters['min_price']:.0f}")
    if "max_price" in filters:
        parts.append(f"Up to ₹{filters['max_price']:.0f}")
    labels = {"price_asc": "Cheapest first",
              "price_desc": "Most expensive first", "newest": "Newest first"}
    if filters.get("sort"):
        parts.append(labels[filters["sort"]])
    return parts
