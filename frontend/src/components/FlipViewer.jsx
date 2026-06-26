import { useEffect, useRef, useState, forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";
import { ChevronLeft, ChevronRight, BookOpen, Square } from "lucide-react";
import { fileUrl } from "@/lib/flipApi";

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

export function FlipViewer({ pages, onPageChange }) {
  const flipRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const [spread, setSpread] = useState(false);
  const [dims, setDims] = useState({ w: 420, h: 560 });
  const total = pages.length;

  const first = pages[0] || {};
  const aspect =
    first.width && first.height ? first.width / first.height : 0.72;

  useEffect(() => {
    const calc = () => {
      const availH = Math.min(window.innerHeight - 240, 760);
      let h = Math.max(320, availH);
      let w = Math.round(h * aspect);
      const isSpread = spread && window.innerWidth > 900;
      const maxW = window.innerWidth - 80;
      const targetW = isSpread ? w * 2 : w;
      if (targetW > maxW) {
        const scale = maxW / targetW;
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      setDims({ w, h, isSpread });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [spread, aspect]);

  useEffect(() => {
    if (onPageChange) onPageChange(current);
  }, [current, onPageChange]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-6 overflow-hidden">
        <div className="flip-shadow">
          <HTMLFlipBook
            key={`${dims.w}x${dims.h}-${dims.isSpread ? "s" : "p"}`}
            ref={flipRef}
            width={dims.w}
            height={dims.h}
            size="fixed"
            minWidth={250}
            maxWidth={760}
            minHeight={350}
            maxHeight={1000}
            maxShadowOpacity={0.5}
            drawShadow={true}
            showCover={true}
            usePortrait={!dims.isSpread}
            mobileScrollSupport={true}
            flippingTime={700}
            onFlip={(e) => setCurrent(e.data)}
            data-testid="flipbook"
          >
            {pages.map((p, i) => (
              <Page key={p.id} src={fileUrl(p.storage_path)} label={`Page ${i + 1}`} />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 md:gap-6 pb-8">
        <button
          data-testid="prev-page-button"
          onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
          className="w-11 h-11 flex items-center justify-center border border-white/25 text-white hover:bg-[#C34A36] hover:border-[#C34A36] transition-colors"
        >
          <ChevronLeft strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <span className="label-overline text-white/60 w-20 text-center" data-testid="page-indicator">
          {Math.min(current + 1, total)} / {total}
        </span>
        <button
          data-testid="next-page-button"
          onClick={() => flipRef.current?.pageFlip()?.flipNext()}
          className="w-11 h-11 flex items-center justify-center border border-white/25 text-white hover:bg-[#C34A36] hover:border-[#C34A36] transition-colors"
        >
          <ChevronRight strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <button
          data-testid="spread-toggle-button"
          onClick={() => setSpread((s) => !s)}
          title={spread ? "Single page" : "Two-page spread"}
          className={`ml-2 h-11 px-4 flex items-center gap-2 border transition-colors label-overline ${
            spread
              ? "bg-[#C34A36] border-[#C34A36] text-white"
              : "border-white/25 text-white/70 hover:text-white"
          }`}
        >
          {spread ? <BookOpen strokeWidth={1.5} className="w-4 h-4" /> : <Square strokeWidth={1.5} className="w-4 h-4" />}
          {spread ? "Spread" : "Single"}
        </button>
      </div>
    </div>
  );
}
