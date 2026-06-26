import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2, FileText } from "lucide-react";
import { Header } from "@/components/Header";
import {
  listBooks,
  createBook,
  deleteBook,
  uploadPages,
  fileUrl,
} from "@/lib/flipApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const btnPrimary =
  "bg-[#0F0F0F] text-[#FAF9F6] px-6 py-3 font-sans text-sm tracking-wide hover:bg-[#C34A36] transition-colors duration-300 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

function BookCard({ book, onDelete }) {
  const navigate = useNavigate();
  const cover = fileUrl(book.cover_path);
  return (
    <div
      className="group relative cursor-pointer"
      data-testid={`book-card-${book.id}`}
      onClick={() => navigate(`/book/${book.id}`)}
    >
      <div className="relative aspect-[3/4] bg-white border border-[#D1CEC7] shadow-[0_8px_30px_rgba(15,15,15,0.06)] overflow-hidden transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/15 to-transparent z-10" />
        {cover ? (
          <img
            src={cover}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[#8A867D] bg-[#FAF9F6]">
            <FileText strokeWidth={1.2} className="w-10 h-10" />
            <span className="label-overline">Empty</span>
          </div>
        )}
        <button
          data-testid={`delete-book-${book.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(book);
          }}
          className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center bg-[#FAF9F6]/90 border border-[#D1CEC7] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#C34A36] hover:text-white"
        >
          <Trash2 strokeWidth={1.5} className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-4">
        <h3 className="font-serif-display text-2xl leading-tight tracking-tight text-[#0F0F0F] line-clamp-1">
          {book.title}
        </h3>
        <p className="label-overline text-[#8A867D] mt-1">
          {book.page_count} {book.page_count === 1 ? "Page" : "Pages"}
        </p>
      </div>
    </div>
  );
}

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pendingFiles, setPendingFiles] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setBooks(await listBooks());
    } catch (e) {
      toast.error("Could not load your library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Give your flipbook a title");
      return;
    }
    setCreating(true);
    try {
      const book = await createBook(title.trim());
      if (pendingFiles && pendingFiles.length) {
        await uploadPages(book.id, pendingFiles);
      }
      toast.success("Flipbook created");
      setOpen(false);
      setTitle("");
      setPendingFiles(null);
      navigate(`/book/${book.id}`);
    } catch (e) {
      toast.error("Failed to create flipbook");
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    const b = toDelete;
    setToDelete(null);
    try {
      await deleteBook(b.id);
      setBooks((prev) => prev.filter((x) => x.id !== b.id));
      toast.success("Flipbook deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      <Header
        right={
          <button
            data-testid="new-book-button"
            onClick={() => setOpen(true)}
            className={btnPrimary}
          >
            <Plus strokeWidth={2} className="w-4 h-4" />
            New Flipbook
          </button>
        }
      />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-10 border-b border-[#D1CEC7]">
        <p className="label-overline text-[#C34A36] mb-5">
          Documents &amp; Images, Bound Beautifully
        </p>
        <h1 className="font-serif-display text-5xl md:text-7xl tracking-tighter leading-[0.95] font-medium max-w-3xl text-[#0F0F0F]">
          Turn your files into a flipbook you can actually turn.
        </h1>
        <p className="mt-6 text-[#5C5A56] text-lg max-w-xl leading-relaxed">
          Upload PDFs and images, arrange the pages, and read them with a
          realistic page-curl. No accounts, no clutter — just your collection.
        </p>
      </section>

      {/* Library */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-14">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="font-serif-display text-3xl md:text-4xl tracking-tight text-[#0F0F0F]">
            Your Library
          </h2>
          <span className="label-overline text-[#8A867D]">
            {books.length} {books.length === 1 ? "Volume" : "Volumes"}
          </span>
        </div>

        {(() => {
          if (loading) {
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {["s1", "s2", "s3", "s4"].map((k) => (
                  <div
                    key={k}
                    className="aspect-[3/4] bg-[#FAF9F6] border border-[#D1CEC7] animate-pulse"
                  />
                ))}
              </div>
            );
          }
          if (books.length === 0) {
            return (
              <div
                data-testid="empty-state"
                className="border-2 border-dashed border-[#D1CEC7] bg-[#FAF9F6] py-24 flex flex-col items-center justify-center text-center"
              >
                <BookOpen strokeWidth={1.2} className="w-12 h-12 text-[#C34A36] mb-5" />
                <h3 className="font-serif-display text-3xl tracking-tight text-[#0F0F0F]">
                  No flipbooks yet
                </h3>
                <p className="text-[#5C5A56] mt-2 mb-7 max-w-sm">
                  Create your first volume and breathe life into your documents.
                </p>
                <button
                  data-testid="empty-new-book-button"
                  onClick={() => setOpen(true)}
                  className={btnPrimary}
                >
                  <Plus strokeWidth={2} className="w-4 h-4" /> Create Flipbook
                </button>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
              {books.map((b) => (
                <BookCard key={b.id} book={b} onDelete={setToDelete} />
              ))}
            </div>
          );
        })()}
      </section>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#FAF9F6] border border-[#D1CEC7] rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-3xl tracking-tight text-left">
              New Flipbook
            </DialogTitle>
            <DialogDescription className="text-[#5C5A56] text-left">
              Name your flipbook and optionally add images or PDFs to start.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div>
              <label className="label-overline text-[#8A867D]">Title</label>
              <input
                data-testid="book-title-input"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Summer Sketchbook"
                className="w-full bg-transparent border-b border-[#D1CEC7] rounded-none px-0 py-2 mt-2 focus:outline-none focus:border-[#0F0F0F] text-lg font-serif-display"
              />
            </div>
            <div>
              <label className="label-overline text-[#8A867D]">
                Add files now (optional)
              </label>
              <input
                data-testid="initial-files-input"
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => setPendingFiles(e.target.files)}
                className="block w-full mt-2 text-sm text-[#5C5A56] file:mr-4 file:py-2 file:px-4 file:border file:border-[#0F0F0F] file:bg-transparent file:text-[#0F0F0F] file:rounded-none file:cursor-pointer hover:file:bg-[#E8E4DA]"
              />
              {pendingFiles && (
                <p className="text-xs text-[#8A867D] mt-2">
                  {pendingFiles.length} file(s) selected
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              data-testid="create-book-confirm"
              onClick={handleCreate}
              disabled={creating}
              className={btnPrimary + " w-full justify-center"}
            >
              {creating ? "Creating…" : "Create Flipbook"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-[#FAF9F6] border border-[#D1CEC7] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-display text-2xl">
              Delete “{toDelete?.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5C5A56]">
              This will remove the flipbook from your library. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-[#0F0F0F]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-book"
              onClick={confirmDelete}
              className="rounded-none bg-[#C34A36] hover:bg-[#A63E2D]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
