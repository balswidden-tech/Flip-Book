import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpenCheck,
  UploadCloud,
  Loader2,
  Pencil,
  Share2,
  ImagePlus,
  Copy,
  Check,
  Link2Off,
  QrCode,
  Download,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Header } from "@/components/Header";
import { CropDialog } from "@/components/CropDialog";
import { SortablePage } from "@/components/SortablePage";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  getBook,
  uploadPages,
  reorderPages,
  deletePage,
  renameBook,
  setCoverFromPage,
  uploadCover,
  rotatePage,
  cropPage,
  enableShare,
  disableShare,
} from "@/lib/flipApi";

const btnPrimary =
  "bg-[#0F0F0F] text-[#FAF9F6] px-6 py-3 font-sans text-sm tracking-wide hover:bg-[#C34A36] transition-colors duration-300 inline-flex items-center gap-2 disabled:opacity-50";
const btnSecondary =
  "bg-transparent border border-[#0F0F0F] text-[#0F0F0F] px-6 py-3 font-sans text-sm tracking-wide hover:bg-[#E8E4DA] transition-colors duration-300 inline-flex items-center gap-2";

export default function BookEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [cropTarget, setCropTarget] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = useCallback(async () => {
    try {
      const b = await getBook(id);
      setBook(b);
      setTitleDraft(b.title);
    } catch (e) {
      toast.error("Flipbook not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    setUploading(true);
    setProgress(0);
    try {
      const updated = await uploadPages(id, files, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      setBook(updated);
      toast.success("Pages added");
    } catch (e) {
      toast.error("Upload failed — check file types");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = book.pages.findIndex((p) => p.id === active.id);
    const newIndex = book.pages.findIndex((p) => p.id === over.id);
    const newPages = arrayMove(book.pages, oldIndex, newIndex);
    setBook({ ...book, pages: newPages });
    try {
      await reorderPages(id, newPages.map((p) => p.id));
    } catch (e) {
      toast.error("Could not save order");
      load();
    }
  };

  const handleDeletePage = async (pageId) => {
    const prev = book;
    setBook({ ...book, pages: book.pages.filter((p) => p.id !== pageId) });
    try {
      const updated = await deletePage(id, pageId);
      setBook(updated);
    } catch (e) {
      toast.error("Could not delete page");
      setBook(prev);
    }
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== book.title) {
      try {
        const updated = await renameBook(id, titleDraft.trim());
        setBook(updated);
      } catch (e) {
        toast.error("Rename failed");
      }
    }
  };

  const handleSetCover = async (pageId) => {
    try {
      setBook(await setCoverFromPage(id, pageId));
      toast.success("Cover updated");
    } catch (e) {
      toast.error("Could not set cover");
    }
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    try {
      setBook(await uploadCover(id, file));
      toast.success("Custom cover set");
    } catch (e) {
      toast.error("Cover upload failed");
    } finally {
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  const handleRotate = async (pageId) => {
    try {
      setBook(await rotatePage(id, pageId, 90));
    } catch (e) {
      toast.error("Rotate failed");
    }
  };

  const handleCropConfirm = async (rect) => {
    try {
      setBook(await cropPage(id, cropTarget.id, rect));
      toast.success("Page cropped");
      setCropTarget(null);
    } catch (e) {
      toast.error("Crop failed");
    }
  };

  const handleShareToggle = async (on) => {
    try {
      if (on) {
        const res = await enableShare(id);
        setBook((b) => ({ ...b, share_enabled: true, share_id: res.share_id }));
      } else {
        await disableShare(id);
        setBook((b) => ({ ...b, share_enabled: false }));
      }
    } catch (e) {
      toast.error("Could not update sharing");
    }
  };

  const shareUrl = book?.share_id
    ? `${window.location.origin}/s/${book.share_id}`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      toast.error("Copy failed");
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const safeTitle = (book?.title || "flipbook")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle || "flipbook"}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR code downloaded");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#C34A36]" />
      </div>
    );
  }

  const hasPages = book.pages.length > 0;

  return (
    <div className="min-h-screen relative z-10">
      <Header
        right={
          <>
            <button
              data-testid="share-flipbook-button"
              disabled={!hasPages}
              onClick={() => setShareOpen(true)}
              className={btnSecondary + " disabled:opacity-50"}
            >
              <Share2 strokeWidth={1.5} className="w-4 h-4" />
              Share
            </button>
            <button
              data-testid="read-flipbook-button"
              disabled={!hasPages}
              onClick={() => navigate(`/book/${id}/read`)}
              className={btnPrimary}
            >
              <BookOpenCheck strokeWidth={1.5} className="w-4 h-4" />
              Read
            </button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        <Link
          to="/"
          data-testid="back-to-library"
          className="inline-flex items-center gap-2 label-overline text-[#8A867D] hover:text-[#0F0F0F] transition-colors mb-8"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Library
        </Link>

        <div className="flex items-end justify-between gap-4 border-b border-[#D1CEC7] pb-8 mb-10">
          <div className="flex-1">
            <p className="label-overline text-[#C34A36] mb-3">Editing Volume</p>
            {editingTitle ? (
              <input
                data-testid="rename-input"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="w-full bg-transparent border-b border-[#0F0F0F] rounded-none px-0 py-1 focus:outline-none font-serif-display text-4xl md:text-5xl tracking-tighter"
              />
            ) : (
              <button
                data-testid="title-edit-trigger"
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-3 text-left"
              >
                <h1 className="font-serif-display text-4xl md:text-5xl tracking-tighter text-[#0F0F0F]">
                  {book.title}
                </h1>
                <Pencil
                  strokeWidth={1.5}
                  className="w-5 h-5 text-[#8A867D] opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </button>
            )}
            <p className="label-overline text-[#8A867D] mt-3">
              {book.pages.length} {book.pages.length === 1 ? "Page" : "Pages"}
              {hasPages && " · Drag to reorder"}
            </p>
          </div>
          <div className="shrink-0">
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="cover-upload-input"
              onChange={(e) => handleCoverUpload(e.target.files?.[0])}
            />
            <button
              data-testid="custom-cover-button"
              onClick={() => coverRef.current?.click()}
              className={btnSecondary}
            >
              <ImagePlus strokeWidth={1.5} className="w-4 h-4" />
              {book.custom_cover ? "Change cover" : "Custom cover"}
            </button>
          </div>
        </div>

        {/* Upload zone */}
        <div
          data-testid="upload-zone"
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-[#D1CEC7] bg-[#FAF9F6] hover:bg-[#E8E4DA] transition-colors duration-300 py-12 flex flex-col items-center justify-center text-center cursor-pointer mb-12"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            data-testid="file-input"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-[#C34A36] animate-spin mb-3" />
              <p className="font-serif-display text-xl">
                Binding pages… {progress}%
              </p>
            </>
          ) : (
            <>
              <UploadCloud strokeWidth={1.2} className="w-9 h-9 text-[#C34A36] mb-3" />
              <p className="font-serif-display text-2xl tracking-tight text-[#0F0F0F]">
                Drop images or PDFs here
              </p>
              <p className="text-sm text-[#8A867D] mt-1">
                or click to browse · PDFs are split into pages automatically
              </p>
            </>
          )}
        </div>

        {hasPages ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={book.pages.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
                {book.pages.map((p, i) => (
                  <SortablePage
                    key={p.id}
                    page={p}
                    index={i}
                    isCover={!book.custom_cover && book.cover_path === p.storage_path}
                    onSetCover={handleSetCover}
                    onRotate={handleRotate}
                    onCrop={setCropTarget}
                    onDelete={handleDeletePage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-center text-[#8A867D] py-10">
            No pages yet — add some files above to get started.
          </p>
        )}
      </div>

      <CropDialog
        open={!!cropTarget}
        page={cropTarget}
        onClose={() => setCropTarget(null)}
        onConfirm={handleCropConfirm}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="bg-[#FAF9F6] border border-[#D1CEC7] rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-3xl tracking-tight text-left">
              Share Flipbook
            </DialogTitle>
            <DialogDescription className="text-[#5C5A56]">
              Anyone with the link can read this flipbook — they can't edit it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-6">
            <div className="flex items-center justify-between border border-[#D1CEC7] px-4 py-3">
              <div>
                <p className="label-overline text-[#0F0F0F]">Public link</p>
                <p className="text-sm text-[#8A867D] mt-0.5">
                  {book?.share_enabled ? "Sharing is on" : "Sharing is off"}
                </p>
              </div>
              <Switch
                data-testid="share-toggle"
                checked={!!book?.share_enabled}
                onCheckedChange={handleShareToggle}
              />
            </div>
            {book?.share_enabled && shareUrl && (
              <>
                <div className="flex items-stretch border border-[#0F0F0F]">
                  <input
                    data-testid="share-link-input"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none truncate"
                  />
                  <button
                    data-testid="copy-share-link"
                    onClick={handleCopy}
                    className="px-4 bg-[#0F0F0F] text-[#FAF9F6] hover:bg-[#C34A36] transition-colors inline-flex items-center gap-2 text-sm"
                  >
                    {copied ? (
                      <Check strokeWidth={2} className="w-4 h-4" />
                    ) : (
                      <Copy strokeWidth={1.5} className="w-4 h-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-col items-center gap-3 pt-2">
                  <div
                    data-testid="share-qr-code"
                    className="bg-white p-4 border border-[#D1CEC7]"
                  >
                    <QRCodeSVG
                      value={shareUrl}
                      size={160}
                      level="M"
                      fgColor="#0F0F0F"
                      bgColor="#FFFFFF"
                    />
                  </div>
                  <button
                    data-testid="download-qr-button"
                    onClick={handleDownloadQR}
                    className="label-overline text-[#0F0F0F] inline-flex items-center gap-2 border-b border-transparent hover:border-[#0F0F0F] transition-colors pb-0.5"
                  >
                    <Download strokeWidth={1.5} className="w-4 h-4" />
                    Download QR
                  </button>
                  <p className="label-overline text-[#8A867D] flex items-center gap-2">
                    <QrCode strokeWidth={1.5} className="w-4 h-4" />
                    Scan to open on a phone
                  </p>
                  {/* hidden high-res canvas used only for PNG export */}
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={shareUrl}
                    size={512}
                    level="M"
                    marginSize={4}
                    fgColor="#0F0F0F"
                    bgColor="#FFFFFF"
                    style={{ display: "none" }}
                  />
                </div>
              </>
            )}
            {!book?.share_enabled && (
              <p className="text-xs text-[#8A867D] flex items-center gap-2">
                <Link2Off strokeWidth={1.5} className="w-4 h-4" />
                Turn on sharing to generate a link.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
