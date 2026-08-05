import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ title, message, confirmLabel = "Vahvista", dangerLabel, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="panel w-[380px] shadow-float bg-surface border border-line rounded-lg overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <div className="w-8 h-8 rounded-md bg-danger/10 border border-danger/25 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-danger" />
          </div>
          <h2 className="flex-1 text-title font-semibold text-text">{title}</h2>
          <button onClick={onCancel} className="btn btn-ghost btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-ui text-muted leading-relaxed">{message}</p>
          <div className="flex gap-2 pt-2 border-t border-line">
            <button onClick={onCancel} className="btn btn-ghost flex-1">Peruuta</button>
            <button onClick={onConfirm} className="btn btn-danger flex-1">
              {dangerLabel ?? confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

