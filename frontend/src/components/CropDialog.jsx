import { useState } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2 } from "lucide-react";
import { fileUrl } from "@/lib/flipApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function CropDialog({ open, page, onClose, onConfirm }) {
  const [crop, setCrop] = useState({ unit: "%", x: 8, y: 8, width: 84, height: 84 });
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!crop?.width || !crop?.height) return;
    setSaving(true);
    try {
      await onConfirm({
        x: crop.x / 100,
        y: crop.y / 100,
        width: crop.width / 100,
        height: crop.height / 100,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#FAF9F6] border border-[#D1CEC7] rounded-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif-display text-3xl tracking-tight text-left">
            Crop Page
          </DialogTitle>
          <DialogDescription className="text-[#5C5A56]">
            Drag the handles to choose the visible area, then save.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center bg-[#E8E4DA] p-4 max-h-[55vh] overflow-auto">
          {page && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              data-testid="crop-area"
            >
              <img
                src={fileUrl(page.storage_path)}
                alt="crop"
                style={{ maxHeight: "48vh" }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          )}
        </div>
        <DialogFooter className="gap-2">
          <button
            data-testid="crop-cancel"
            onClick={onClose}
            className="bg-transparent border border-[#0F0F0F] text-[#0F0F0F] px-6 py-3 text-sm tracking-wide hover:bg-[#E8E4DA] transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="crop-confirm"
            onClick={handleConfirm}
            disabled={saving}
            className="bg-[#0F0F0F] text-[#FAF9F6] px-6 py-3 text-sm tracking-wide hover:bg-[#C34A36] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply Crop
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
