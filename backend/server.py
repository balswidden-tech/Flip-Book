from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import secrets
import fitz  # PyMuPDF
from PIL import Image
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- DB Setup ---
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'flipbook')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Supabase Storage Setup ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = os.environ.get("SUPABASE_BUCKET", "flipbook")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to init Supabase: {e}")

APP_NAME = "flipbook"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}

def put_object(path: str, data: bytes, content_type: str) -> dict:
    if not supabase:
        raise HTTPException(status_code=500, detail="Storage not configured")
    supabase.storage.from_(BUCKET_NAME).upload(
        path=path,
        file=data,
        file_options={"content-type": content_type, "x-upsert": "true"}
    )
    return {"path": path}

def get_object(path: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Storage not configured")
    res = supabase.storage.from_(BUCKET_NAME).download(path)
    ext = path.split('.')[-1].lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    return res, content_type

def try_delete_object(path: str) -> bool:
    if not supabase:
        return False
    try:
        supabase.storage.from_(BUCKET_NAME).remove([path])
        return True
    except Exception:
        return False

# ---------------- Models ----------------
class Page(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    storage_path: str
    content_type: str = "image/png"
    source_filename: Optional[str] = None
    width: int = 0
    height: int = 0
    order: int = 0

class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    pages: List[Page] = []
    cover_path: Optional[str] = None
    custom_cover: bool = False
    share_enabled: bool = False
    share_id: Optional[str] = None
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookCreate(BaseModel):
    title: str

class ReorderRequest(BaseModel):
    page_ids: List[str]

class CropRequest(BaseModel):
    x: float
    y: float
    width: float
    height: float

class RotateRequest(BaseModel):
    degrees: int = 90

# ---------------- Helpers ----------------
def book_public(doc: dict) -> dict:
    pages = sorted(doc.get("pages", []), key=lambda p: p.get("order", 0))
    return {
        "id": doc["id"],
        "title": doc["title"],
        "pages": pages,
        "page_count": len(pages),
        "cover_path": doc.get("cover_path") or (pages[0]["storage_path"] if pages else None),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

async def record_orphans(paths):
    paths = [p for p in (paths if isinstance(paths, (list, tuple, set)) else [paths]) if p]
    if not paths:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.orphaned_objects.insert_many(
        [{"storage_path": p, "purged": False, "created_at": now} for p in paths])
    for p in paths:
        if try_delete_object(p):
            await db.orphaned_objects.update_one(
                {"storage_path": p, "purged": False},
                {"$set": {"purged": True, "purged_at": now}})

async def store_uploaded_file(book_id: str, file: UploadFile) -> List[Page]:
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    data = await file.read()
    new_pages: List[Page] = []
    if ext == "pdf":
        pdf = fitz.open(stream=data, filetype="pdf")
        for i in range(len(pdf)):
            page = pdf.load_page(i)
            pix = page.get_pixmap(dpi=130)
            img_bytes = pix.tobytes("png")
            path = f"uploads/{book_id}/{uuid.uuid4()}.png"
            result = put_object(path, img_bytes, "image/png")
            new_pages.append(Page(storage_path=result["path"], content_type="image/png",
                                  source_filename=file.filename,
                                  width=pix.width, height=pix.height))
        pdf.close()
    elif ext in MIME_TYPES:
        ct = MIME_TYPES[ext]
        try:
            with Image.open(io.BytesIO(data)) as im:
                iw, ih = im.size
        except Exception:
            iw, ih = 0, 0
        path = f"uploads/{book_id}/{uuid.uuid4()}.{ext}"
        result = put_object(path, data, ct)
        new_pages.append(Page(storage_path=result["path"], content_type=ct,
                              source_filename=file.filename, width=iw, height=ih))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
    return new_pages

# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Flipbook API"}

@api_router.post("/books")
async def create_book(payload: BookCreate):
    book = Book(title=payload.title.strip() or "Untitled")
    await db.books.insert_one(book.model_dump())
    return book_public(book.model_dump())

@api_router.get("/books")
async def list_books():
    docs = await db.books.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [book_public(d) for d in docs]

@api_router.get("/books/{book_id}")
async def get_book(book_id: str):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    return book_public(doc)

@api_router.post("/books/{book_id}/pages")
async def add_pages(book_id: str, files: List[UploadFile] = File(...)):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    existing = doc.get("pages", [])
    start_order = (max([p["order"] for p in existing]) + 1) if existing else 0
    added = []
    for f in files:
        pages = await store_uploaded_file(book_id, f)
        for p in pages:
            p.order = start_order
            start_order += 1
            added.append(p.model_dump())
    all_pages = existing + added
    update = {"pages": all_pages, "updated_at": datetime.now(timezone.utc).isoformat()}
    if not doc.get("cover_path") and all_pages:
        update["cover_path"] = sorted(all_pages, key=lambda p: p["order"])[0]["storage_path"]
    await db.books.update_one({"id": book_id}, {"$set": update})
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.put("/books/{book_id}/reorder")
async def reorder_pages(book_id: str, payload: ReorderRequest):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    pages = {p["id"]: p for p in doc.get("pages", [])}
    new_pages = []
    for idx, pid in enumerate(payload.page_ids):
        if pid in pages:
            pages[pid]["order"] = idx
            new_pages.append(pages[pid])
    cover = new_pages[0]["storage_path"] if new_pages else None
    await db.books.update_one({"id": book_id}, {"$set": {
        "pages": new_pages, "cover_path": cover,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.delete("/books/{book_id}/pages/{page_id}")
async def delete_page(book_id: str, page_id: str):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    removed = next((p for p in doc.get("pages", []) if p["id"] == page_id), None)
    pages = [p for p in doc.get("pages", []) if p["id"] != page_id]
    pages = sorted(pages, key=lambda p: p["order"])
    for i, p in enumerate(pages):
        p["order"] = i
    cover = pages[0]["storage_path"] if pages else None
    await db.books.update_one({"id": book_id}, {"$set": {
        "pages": pages, "cover_path": cover,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    if removed:
        await record_orphans(removed["storage_path"])
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.patch("/books/{book_id}")
async def rename_book(book_id: str, payload: BookCreate):
    res = await db.books.update_one({"id": book_id, "is_deleted": False},
                                    {"$set": {"title": payload.title.strip() or "Untitled",
                                              "updated_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.delete("/books/{book_id}")
async def delete_book(book_id: str):
    res = await db.books.update_one({"id": book_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"success": True}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type,
                        headers={"Cache-Control": "public, max-age=31536000"})
    except Exception as e:
        logger.error(f"File serve error: {e}")
        raise HTTPException(status_code=404, detail="File not found")

@api_router.post("/books/{book_id}/share")
async def enable_share(book_id: str):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    share_id = doc.get("share_id") or secrets.token_urlsafe(9)
    await db.books.update_one({"id": book_id}, {"$set": {
        "share_enabled": True, "share_id": share_id,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"share_enabled": True, "share_id": share_id}

@api_router.delete("/books/{book_id}/share")
async def disable_share(book_id: str):
    res = await db.books.update_one({"id": book_id, "is_deleted": False},
                                    {"$set": {"share_enabled": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"share_enabled": False}

@api_router.get("/share/{share_id}")
async def get_shared_book(share_id: str):
    doc = await db.books.find_one(
        {"share_id": share_id, "share_enabled": True, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="This flipbook is not available")
    return book_public(doc)

@api_router.post("/books/{book_id}/cover/page/{page_id}")
async def set_cover_from_page(book_id: str, page_id: str):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    page = next((p for p in doc.get("pages", []) if p["id"] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    await db.books.update_one({"id": book_id}, {"$set": {
        "cover_path": page["storage_path"], "custom_cover": False,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.post("/books/{book_id}/cover")
async def upload_cover(book_id: str, file: UploadFile = File(...)):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png").lower()
    if ext not in {"jpg", "jpeg", "png", "gif", "webp"}:
        raise HTTPException(status_code=400, detail="Cover must be an image")
    data = await file.read()
    path = f"uploads/{book_id}/cover-{uuid.uuid4()}.{ext}"
    result = put_object(path, data, MIME_TYPES.get(ext, "image/png"))
    await db.books.update_one({"id": book_id}, {"$set": {
        "cover_path": result["path"], "custom_cover": True,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

def _reprocess_page(book: dict, page_id: str, transform) -> dict:
    pages = book.get("pages", [])
    page = next((p for p in pages if p["id"] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    old_path = page["storage_path"]
    raw, _ = get_object(old_path)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img = transform(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    new_path = f"uploads/{book['id']}/{uuid.uuid4()}.png"
    result = put_object(new_path, buf.getvalue(), "image/png")
    page["storage_path"] = result["path"]
    page["content_type"] = "image/png"
    page["width"], page["height"] = img.size
    update = {"pages": pages, "updated_at": datetime.now(timezone.utc).isoformat()}
    if book.get("cover_path") == old_path:
        update["cover_path"] = result["path"]
    return update, old_path

@api_router.post("/books/{book_id}/pages/{page_id}/rotate")
async def rotate_page(book_id: str, page_id: str, payload: RotateRequest):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    deg = payload.degrees % 360
    update, old_path = _reprocess_page(doc, page_id, lambda im: im.rotate(-deg, expand=True))
    await db.books.update_one({"id": book_id}, {"$set": update})
    await record_orphans(old_path)
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

@api_router.post("/books/{book_id}/pages/{page_id}/crop")
async def crop_page(book_id: str, page_id: str, payload: CropRequest):
    doc = await db.books.find_one({"id": book_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Book not found")
    def _crop(im):
        w, h = im.size
        left = max(0, int(payload.x * w))
        top = max(0, int(payload.y * h))
        right = min(w, int((payload.x + payload.width) * w))
        bottom = min(h, int((payload.y + payload.height) * h))
        if right <= left or bottom <= top:
            raise HTTPException(status_code=400, detail="Invalid crop region")
        return im.crop((left, top, right, bottom))
    update, old_path = _reprocess_page(doc, page_id, _crop)
    await db.books.update_one({"id": book_id}, {"$set": update})
    await record_orphans(old_path)
    new_doc = await db.books.find_one({"id": book_id}, {"_id": 0})
    return book_public(new_doc)

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
