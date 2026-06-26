"""Tests for v2 features: share, cover, rotate, crop, page dimensions."""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break
API = f"{BASE_URL}/api"


def _png(size=(400, 300), color=(120, 60, 200)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def book_with_pages():
    r = requests.post(f"{API}/books", json={"title": "TEST_V2"}, timeout=20)
    bid = r.json()["id"]
    files = [
        ("files", ("landscape.png", _png((600, 300)), "image/png")),
        ("files", ("portrait.png", _png((300, 600)), "image/png")),
    ]
    requests.post(f"{API}/books/{bid}/pages", files=files, timeout=60)
    yield bid
    requests.delete(f"{API}/books/{bid}", timeout=20)


# ---- page width/height on upload ----
def test_pages_have_dimensions(book_with_pages):
    book = requests.get(f"{API}/books/{book_with_pages}", timeout=20).json()
    p0, p1 = book["pages"][0], book["pages"][1]
    assert p0["width"] == 600 and p0["height"] == 300
    assert p1["width"] == 300 and p1["height"] == 600


# ---- share ----
def test_share_lifecycle(book_with_pages):
    bid = book_with_pages
    r = requests.post(f"{API}/books/{bid}/share", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["share_enabled"] == True
    sid = data["share_id"]
    assert isinstance(sid, str) and len(sid) > 5

    # Public fetch works
    r = requests.get(f"{API}/share/{sid}", timeout=20)
    assert r.status_code == 200
    pub = r.json()
    assert pub["id"] == bid
    assert pub["page_count"] >= 1

    # Disable
    r = requests.delete(f"{API}/books/{bid}/share", timeout=20)
    assert r.status_code == 200
    assert r.json()["share_enabled"] == False

    # 404 after disable
    r = requests.get(f"{API}/share/{sid}", timeout=20)
    assert r.status_code == 404


def test_share_invalid_id():
    r = requests.get(f"{API}/share/nope-zzz", timeout=20)
    assert r.status_code == 404


def test_share_404_on_missing_book():
    r = requests.post(f"{API}/books/missing-xxx/share", timeout=20)
    assert r.status_code == 404


# ---- cover ----
def test_set_cover_from_page(book_with_pages):
    bid = book_with_pages
    book = requests.get(f"{API}/books/{bid}", timeout=20).json()
    target_page = book["pages"][1]
    r = requests.post(f"{API}/books/{bid}/cover/page/{target_page['id']}", timeout=20)
    assert r.status_code == 200
    updated = r.json()
    assert updated["cover_path"] == target_page["storage_path"]


def test_upload_custom_cover(book_with_pages):
    bid = book_with_pages
    files = {"file": ("cover.png", _png((200, 200), (10, 200, 10)), "image/png")}
    r = requests.post(f"{API}/books/{bid}/cover", files=files, timeout=30)
    assert r.status_code == 200
    updated = r.json()
    assert updated["cover_path"]
    # custom_cover flag is internal; verify by GET on raw doc via list
    book = requests.get(f"{API}/books/{bid}", timeout=20).json()
    # cover_path shouldn't be the same as page storage paths
    page_paths = {p["storage_path"] for p in book["pages"]}
    assert book["cover_path"] not in page_paths


def test_cover_rejects_non_image(book_with_pages):
    bid = book_with_pages
    files = {"file": ("a.pdf", b"%PDF-1.4", "application/pdf")}
    r = requests.post(f"{API}/books/{bid}/cover", files=files, timeout=30)
    assert r.status_code == 400


# ---- rotate ----
def test_rotate_swaps_dimensions(book_with_pages):
    bid = book_with_pages
    book = requests.get(f"{API}/books/{bid}", timeout=20).json()
    p = book["pages"][0]
    w0, h0 = p["width"], p["height"]
    r = requests.post(f"{API}/books/{bid}/pages/{p['id']}/rotate",
                      json={"degrees": 90}, timeout=30)
    assert r.status_code == 200
    updated = r.json()["pages"][0]
    assert updated["width"] == h0
    assert updated["height"] == w0
    # Persists
    book2 = requests.get(f"{API}/books/{bid}", timeout=20).json()
    assert book2["pages"][0]["width"] == h0


# ---- crop ----
def test_crop_reduces_dimensions(book_with_pages):
    bid = book_with_pages
    book = requests.get(f"{API}/books/{bid}", timeout=20).json()
    p = book["pages"][1]
    w0, h0 = p["width"], p["height"]
    r = requests.post(f"{API}/books/{bid}/pages/{p['id']}/crop",
                      json={"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.5},
                      timeout=30)
    assert r.status_code == 200
    updated = next(pp for pp in r.json()["pages"] if pp["id"] == p["id"])
    assert updated["width"] < w0
    assert updated["height"] < h0
    assert updated["width"] > 0 and updated["height"] > 0


def test_crop_invalid_region(book_with_pages):
    bid = book_with_pages
    book = requests.get(f"{API}/books/{bid}", timeout=20).json()
    p = book["pages"][0]
    r = requests.post(f"{API}/books/{bid}/pages/{p['id']}/crop",
                      json={"x": 0.5, "y": 0.5, "width": 0, "height": 0},
                      timeout=30)
    assert r.status_code == 400
