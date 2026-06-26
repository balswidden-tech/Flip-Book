from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import requests
import fitz  # PyMuPDF
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------- Object Storage ----------------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "flipbook"
storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        # refresh key once
        globals()['storage_key'] = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 403:
        globals()['storage_key'] = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- Models ----------------
class Page(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    storage_path: str
    content_type: str = "image/png"
    source_filename: Optional[str] = None
    order: int = 0


class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    pages: List[Page] = []
    cover_path: Optional[str] = None
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BookCreate(BaseModel):
    title: str


class ReorderRequest(BaseModel):
    page_ids: List[str]


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
            path = f"{APP_NAME}/uploads/{book_id}/{uuid.uuid4()}.png"
            result = put_object(path, img_bytes, "image/png")
            new_pages.append(Page(storage_path=result["path"], content_type="image/png",
                                  source_filename=file.filename))
        pdf.close()
    elif ext in MIME_TYPES:
        ct = MIME_TYPES[ext]
        path = f"{APP_NAME}/uploads/{book_id}/{uuid.uuid4()}.{ext}"
        result = put_object(path, data, ct)
        new_pages.append(Page(storage_path=result["path"], content_type=ct, source_filename=file.filename))
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
    pages = [p for p in doc.get("pages", []) if p["id"] != page_id]
    pages = sorted(pages, key=lambda p: p["order"])
    for i, p in enumerate(pages):
        p["order"] = i
    cover = pages[0]["storage_path"] if pages else None
    await db.books.update_one({"id": book_id}, {"$set": {
        "pages": pages, "cover_path": cover,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
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
    except requests.HTTPError:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=31536000"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
