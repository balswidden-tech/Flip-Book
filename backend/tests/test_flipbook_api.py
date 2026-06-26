"""End-to-end tests for Folio Flipbook Studio backend API.

Covers: book CRUD, image upload, PDF page split, reorder, page delete,
rename, file serving and 404 handling.
"""
import io
import os
import pytest
import requests
from PIL import Image
import fitz  # PyMuPDF

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get(
    'REACT_APP_BACKEND_URL') else None

# Fallback: read from frontend env
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

API = f"{BASE_URL}/api"


def _png_bytes(color=(200, 100, 50)):
    img = Image.new("RGB", (300, 400), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _pdf_bytes(pages=3):
    """Create a multi-page PDF using PyMuPDF (no extra deps)."""
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=400, height=600)
        page.insert_text((100, 100), f"TEST PDF Page {i + 1}", fontsize=32)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def created_book_ids():
    ids = []
    yield ids
    # Cleanup
    for bid in ids:
        try:
            requests.delete(f"{API}/books/{bid}", timeout=20)
        except Exception:
            pass


# ---------------- Health / root ----------------
def test_root(session):
    r = session.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert "message" in r.json()


# ---------------- Books CRUD ----------------
def test_create_book(session, created_book_ids):
    r = session.post(f"{API}/books", json={"title": "TEST_Book_A"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "TEST_Book_A"
    assert data["page_count"] == 0
    assert isinstance(data["id"], str)
    created_book_ids.append(data["id"])


def test_list_books(session, created_book_ids):
    r = session.get(f"{API}/books", timeout=20)
    assert r.status_code == 200
    titles = [b["title"] for b in r.json()]
    assert "TEST_Book_A" in titles


def test_get_book_by_id(session, created_book_ids):
    bid = created_book_ids[0]
    r = session.get(f"{API}/books/{bid}", timeout=20)
    assert r.status_code == 200
    assert r.json()["id"] == bid


def test_get_book_404(session):
    r = session.get(f"{API}/books/does-not-exist-xyz", timeout=20)
    assert r.status_code == 404


# ---------------- Upload images + PDF ----------------
def test_upload_image_and_pdf(session, created_book_ids):
    bid = created_book_ids[0]
    files = [
        ("files", ("a.png", _png_bytes((255, 0, 0)), "image/png")),
        ("files", ("b.png", _png_bytes((0, 255, 0)), "image/png")),
        ("files", ("doc.pdf", _pdf_bytes(3), "application/pdf")),
    ]
    r = session.post(f"{API}/books/{bid}/pages", files=files, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    # 2 images + 3 PDF pages = 5
    assert data["page_count"] == 5, f"Got {data['page_count']} pages"
    # Cover should be set
    assert data["cover_path"]
    # Verify order monotonic 0..4
    orders = [p["order"] for p in data["pages"]]
    assert orders == sorted(orders)
    assert orders == list(range(5))


def test_unsupported_file_rejected(session, created_book_ids):
    bid = created_book_ids[0]
    files = [("files", ("bad.xyz", b"junk", "application/octet-stream"))]
    r = session.post(f"{API}/books/{bid}/pages", files=files, timeout=30)
    assert r.status_code == 400


# ---------------- File serving ----------------
def test_serve_file(session, created_book_ids):
    bid = created_book_ids[0]
    book = session.get(f"{API}/books/{bid}", timeout=20).json()
    path = book["pages"][0]["storage_path"]
    r = session.get(f"{API}/files/{path}", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("Content-Type", "").startswith("image/")
    assert len(r.content) > 100


def test_serve_file_404(session):
    r = session.get(f"{API}/files/nonexistent/path/file.png", timeout=30)
    assert r.status_code == 404


# ---------------- Reorder ----------------
def test_reorder_pages(session, created_book_ids):
    bid = created_book_ids[0]
    book = session.get(f"{API}/books/{bid}", timeout=20).json()
    ids = [p["id"] for p in book["pages"]]
    reversed_ids = list(reversed(ids))
    r = session.put(f"{API}/books/{bid}/reorder",
                    json={"page_ids": reversed_ids}, timeout=20)
    assert r.status_code == 200
    new_order = [p["id"] for p in r.json()["pages"]]
    assert new_order == reversed_ids

    # GET to verify persistence
    book2 = session.get(f"{API}/books/{bid}", timeout=20).json()
    assert [p["id"] for p in book2["pages"]] == reversed_ids


# ---------------- Delete page ----------------
def test_delete_page(session, created_book_ids):
    bid = created_book_ids[0]
    book = session.get(f"{API}/books/{bid}", timeout=20).json()
    initial = book["page_count"]
    page_to_delete = book["pages"][0]["id"]
    r = session.delete(f"{API}/books/{bid}/pages/{page_to_delete}", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["page_count"] == initial - 1
    ids = [p["id"] for p in data["pages"]]
    assert page_to_delete not in ids
    # Orders should be 0..n-1 after renumbering
    assert [p["order"] for p in data["pages"]] == list(range(len(data["pages"])))


# ---------------- Rename ----------------
def test_rename_book(session, created_book_ids):
    bid = created_book_ids[0]
    r = session.patch(f"{API}/books/{bid}",
                      json={"title": "TEST_Book_Renamed"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_Book_Renamed"
    # Persistence
    book = session.get(f"{API}/books/{bid}", timeout=20).json()
    assert book["title"] == "TEST_Book_Renamed"


def test_rename_book_404(session):
    r = session.patch(f"{API}/books/nope-xxxx",
                      json={"title": "x"}, timeout=20)
    assert r.status_code == 404


# ---------------- Delete book ----------------
def test_delete_book_soft(session, created_book_ids):
    # Create separate one for deletion test
    r = session.post(f"{API}/books", json={"title": "TEST_DeleteMe"}, timeout=20)
    bid = r.json()["id"]

    r = session.delete(f"{API}/books/{bid}", timeout=20)
    assert r.status_code == 200
    assert r.json().get("success") is True

    # Should not appear in list
    titles = [b["title"] for b in session.get(f"{API}/books", timeout=20).json()]
    assert "TEST_DeleteMe" not in titles

    # GET by id should 404 (since soft-deleted)
    r = session.get(f"{API}/books/{bid}", timeout=20)
    assert r.status_code == 404


def test_delete_book_404(session):
    r = session.delete(f"{API}/books/nope-yyy", timeout=20)
    assert r.status_code == 404
