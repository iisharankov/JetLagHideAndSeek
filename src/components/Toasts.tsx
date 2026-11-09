import { type CloseButtonProps, ToastContainer } from "react-toastify";

/** A full-height × on the toast's right edge, 44 px wide (principle 7). */
const ToastClose = ({ closeToast }: CloseButtonProps) => (
    <button
        type="button"
        className="toast-close"
        aria-label="Close"
        onClick={(event) => {
            // The toast closes on a tap too; this keeps it to one close.
            event.stopPropagation();
            closeToast(true);
        }}
    >
        ×
    </button>
);

/** The notifications (Layout.astro), with the full-height ×. */
export const Toasts = () => (
    <ToastContainer
        draggable
        closeOnClick
        draggablePercent={40}
        closeButton={ToastClose}
    />
);

export default Toasts;
