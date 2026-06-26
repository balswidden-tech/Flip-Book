import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getBook } from "@/lib/flipApi";
import { FlipViewer } from "@/components/FlipViewer";

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBook(id)
      .then((b) => {
        if (!b.pages.length) {
          toast.error("This flipbook has no pages yet");
          navigate(`/book/${id}`);
          return;
        }
        setBook(b);
      })
      .catch(() => {
        toast.error("Flipbook not found");
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#C34A36]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10 bg-[#23211D]">
      <div className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-white/10">
        <button
          data-testid="reader-back-button"
          onClick={() => navigate(`/book/${id}`)}
          className="inline-flex items-center gap-2 label-overline text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Edit
        </button>
        <h1 className="font-serif-display text-2xl md:text-3xl tracking-tight text-[#FAF9F6] truncate max-w-[60%]">
          {book.title}
        </h1>
        <span className="w-12" />
      </div>
      <FlipViewer pages={book.pages} />
    </div>
  );
}
