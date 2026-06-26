import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export const Header = ({ right }) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#F2EFE9]/80 border-b border-[#D1CEC7]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="logo-home-link">
          <BookOpen strokeWidth={1.5} className="w-5 h-5 text-[#C34A36]" />
          <span className="font-serif-display text-2xl leading-none tracking-tight text-[#0F0F0F]">
            Folio
          </span>
          <span className="label-overline text-[#8A867D] hidden sm:inline ml-1 mt-1">
            Flipbook Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
};
