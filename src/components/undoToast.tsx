import { toast } from "react-toastify";

/** A toast with an Undo button, for destructive actions. */
export const showUndoToast = (message: string, undo: () => void) =>
    toast.info(
        ({ closeToast }) => (
            <div className="flex w-full items-center justify-between gap-3">
                <span>{message}</span>
                <button
                    className="rounded bg-slate-700 px-2 py-1 text-sm font-semibold text-white"
                    onClick={() => {
                        undo();
                        closeToast?.();
                    }}
                >
                    Undo
                </button>
            </div>
        ),
        { autoClose: 8000 },
    );
