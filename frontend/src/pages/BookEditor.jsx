import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpenCheck,
  UploadCloud,
  Trash2,
  GripVertical,
  Loader2,
  Pencil,
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Header } from "@/components/Header";
import {
  getBook,
  uploadPages,
  reorderPages,
  deletePage,
  renameBook,
  fileUrl,
} from "@/lib/flipApi";

const btnPrimary =
  "bg-[#0F0F0F] text-[#FAF9F6] px-6 py-3 font-sans text-sm tracking-wide hover:bg-[#C34A36] transition-colors duration-300 inline-flex items-center gap-2 disabled:opacity-50";
const btnSecondary =
  "bg-transparent border border-[#0F0F0F] text-[#0F0F0F] px-6 py-3 font-sans text-sm tracking-wide hover:bg-[#E8E4DA] transition-colors duration-300 inline-flex items-center gap-2";

function SortablePage({ page, index, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`page-thumb-${page.id}`}
      className="group relative bg-white border border-[#D1CEC7] shadow-[0_4px_16px_rgba(15,15,15,0.05)]"
    >
      <div className="aspect-[3/4] overflow-hidden">
        <img
          src={fileUrl(page.storage_path)}
          alt={`Page ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1.5 bg-[#0F0F0F]/85 text-[#FAF9F6]">
        <span className="label-overline">{index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            data-testid={`drag-page-${page.id}`}
            className="cursor-grab active:cursor-grabbing p-1 hover:text-[#C34A36]"
            {...attributes}
            {...listeners}
          >
            <GripVertical strokeWidth={1.5} className="w-4 h-4" />
          </button>
          <button
            data-testid={`delete-page-${page.id}`}
            onClick={() => onDelete(page.id)}
            className="p-1 hover:text-[#C34A36]"
          >
            <Trash2 strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const fileRef = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = async () => {
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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

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
          <button
            data-testid="read-flipbook-button"
            disabled={!hasPages}
            onClick={() => navigate(`/book/${id}/read`)}
            className={btnPrimary}
          >
            <BookOpenCheck strokeWidth={1.5} className="w-4 h-4" />
            Read
          </button>
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
    </div>
  );
}
