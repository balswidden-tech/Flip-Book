import {
  Trash2,
  GripVertical,
  MoreVertical,
  RotateCw,
  Crop,
  Star,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fileUrl } from "@/lib/flipApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SortablePage({
  page,
  index,
  isCover,
  onSetCover,
  onRotate,
  onCrop,
  onDelete,
}) {
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
      {isCover && (
        <span
          data-testid={`cover-badge-${page.id}`}
          className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-[#C34A36] text-white px-2 py-0.5 label-overline"
        >
          <Star strokeWidth={2} className="w-3 h-3 fill-white" /> Cover
        </span>
      )}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid={`page-menu-${page.id}`}
                className="p-1 hover:text-[#C34A36] outline-none"
              >
                <MoreVertical strokeWidth={1.5} className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-none border-[#D1CEC7] bg-[#FAF9F6]"
            >
              <DropdownMenuItem
                data-testid={`set-cover-${page.id}`}
                onClick={() => onSetCover(page.id)}
                className="rounded-none cursor-pointer"
              >
                <Star strokeWidth={1.5} className="w-4 h-4 mr-2" /> Set as cover
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={`rotate-page-${page.id}`}
                onClick={() => onRotate(page.id)}
                className="rounded-none cursor-pointer"
              >
                <RotateCw strokeWidth={1.5} className="w-4 h-4 mr-2" /> Rotate 90°
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={`crop-page-${page.id}`}
                onClick={() => onCrop(page)}
                className="rounded-none cursor-pointer"
              >
                <Crop strokeWidth={1.5} className="w-4 h-4 mr-2" /> Crop
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid={`delete-page-${page.id}`}
                onClick={() => onDelete(page.id)}
                className="rounded-none cursor-pointer text-[#C34A36] focus:text-[#C34A36]"
              >
                <Trash2 strokeWidth={1.5} className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
