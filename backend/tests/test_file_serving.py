"""Regression test for serve_file endpoint (GET /api/files/{path}).
Validates the refactored serve_file: returns Response inside try, 404 on HTTPError.
"""
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


def _png(size=(120, 90), color=(40, 80, 200)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def book_with_image():
    r = requests.post(f"{API}/books", json={"title": "TEST_FileServe"}, timeout=20)
    assert r.status_code == 200
    bid = r.json()["id"]
    files = [("files", ("p.png", _png(), "image/png"))]
    rr = requests.post(f"{API}/books/{bid}/pages", files=files, timeout=60)
    assert rr.status_code == 200
    storage_path = rr.json()["pages"][0]["storage_path"]
    yield bid, storage_path
    requests.delete(f"{API}/books/{bid}", timeout=20)


def test_serve_file_returns_image_200(book_with_image):
    _, storage_path = book_with_image
    r = requests.get(f"{API}/files/{storage_path}", timeout=30)
    assert r.status_code == 200
    ct = r.headers.get("Content-Type", "")
    assert ct.startswith("image/"), f"unexpected content-type: {ct}"
    # Body should be non-empty bytes that look like an image
    assert len(r.content) > 100
    # Cache-Control is set by backend but may be overridden by ingress/CDN.
    # Just verify the header exists in the response (presence test).
    assert "Cache-Control" in r.headers


def test_serve_file_404_on_missing_path():
    r = requests.get(f"{API}/files/flipbook/uploads/does-not-exist/zzz.png", timeout=30)
    assert r.status_code == 404
    data = r.json()
    assert "detail" in data
