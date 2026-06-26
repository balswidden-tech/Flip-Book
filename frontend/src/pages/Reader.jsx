import { useEffect, useRef, useState, forwardRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HTMLFlipBook from "react-pageflip";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getBook, fileUrl } from "@/lib/flipApi";

const Page = forwardRef(({ src, label }, ref) => (
  <div ref={ref} className="book-page" data-density="hard">
    <div className="book-page-content relative bg-[#FAF9F6]">
      {src ? (
        <img
          src={src}
          alt={label}
          className="w-full h-full object-contain bg-white"
          draggable={false}
        />
      ) : (
        <span className="font-serif-display text-3xl text-[#8A867D]">{label}</span>
      )}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/12 to-transparent" />
    </div>
  </div>
));
Page.displayName = "Page";

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const flipRef = useRef(null);
  const [dims, setDims] = useState({ w: 420, h: 560 });

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

  useEffect(() => {
    const calc = () => {
      const availH = Math.min(window.innerHeight - 220, 720);
      const h = Math.max(380, availH);
      const w = Math.round(h * 0.72);
      setDims({ w, h });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  if (loading || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#C34A36]" />
      </div>
    );
  }

  const total = book.pages.length;

  return (
    <div className="min-h-screen flex flex-col relative z-10 bg-[#23211D]">
      {/* top bar */}
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
        <span className="label-overline text-white/60" data-testid="page-indicator">
          {Math.min(current + 1, total)} / {total}
        </span>
      </div>

      {/* book stage */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-hidden">
        <div className="flip-shadow">
          <HTMLFlipBook
            key={`${dims.w}x${dims.h}`}
            ref={flipRef}
            width={dims.w}
            height={dims.h}
            size="fixed"
            minWidth={300}
            maxWidth={700}
            minHeight={400}
            maxHeight={900}
            maxShadowOpacity={0.5}
            drawShadow={true}
            showCover={true}
            usePortrait={true}
            mobileScrollSupport={true}
            flippingTime={700}
            className="folio-flipbook"
            onFlip={(e) => setCurrent(e.data)}
            data-testid="flipbook"
          >
            {book.pages.map((p, i) => (
              <Page
                key={p.id}
                src={fileUrl(p.storage_path)}
                label={`Page ${i + 1}`}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-6 pb-10">
        <button
          data-testid="prev-page-button"
          onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
          className="w-12 h-12 flex items-center justify-center border border-white/25 text-white hover:bg-[#C34A36] hover:border-[#C34A36] transition-colors"
        >
          <ChevronLeft strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <span className="label-overline text-white/50">Turn the page</span>
        <button
          data-testid="next-page-button"
          onClick={() => flipRef.current?.pageFlip()?.flipNext()}
          className="w-12 h-12 flex items-center justify-center border border-white/25 text-white hover:bg-[#C34A36] hover:border-[#C34A36] transition-colors"
        >
          <ChevronRight strokeWidth={1.5} className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
