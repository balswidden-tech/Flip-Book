import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, BookOpen, Frown } from "lucide-react";
import { getShared } from "@/lib/flipApi";
import { FlipViewer } from "@/components/FlipViewer";

export default function SharedReader() {
  const { shareId } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getShared(shareId)
      .then((b) => {
        if (!b.pages.length) setError(true);
        else setBook(b);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10 bg-[#23211D]">
        <Loader2 className="w-6 h-6 animate-spin text-[#C34A36]" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative z-10 bg-[#23211D] text-center px-6">
        <Frown strokeWidth={1.2} className="w-12 h-12 text-[#C34A36] mb-4" />
        <h1 className="font-serif-display text-4xl text-[#FAF9F6]">
          Flipbook unavailable
        </h1>
        <p className="text-white/50 mt-2">
          This shared link has been disabled or no longer exists.
        </p>
        <Link
          to="/"
          data-testid="shared-go-home"
          className="mt-8 label-overline text-[#C34A36] hover:text-white transition-colors"
        >
          Go to Folio →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10 bg-[#23211D]">
      <div className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2" data-testid="shared-logo">
          <BookOpen strokeWidth={1.5} className="w-5 h-5 text-[#C34A36]" />
          <span className="font-serif-display text-2xl leading-none tracking-tight text-[#FAF9F6]">
            Folio
          </span>
        </Link>
        <h1 className="font-serif-display text-2xl md:text-3xl tracking-tight text-[#FAF9F6] truncate max-w-[55%]">
          {book.title}
        </h1>
        <span className="label-overline text-white/40 hidden sm:inline">Shared</span>
      </div>
      <FlipViewer pages={book.pages} />
    </div>
  );
}
