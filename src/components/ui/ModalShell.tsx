import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog shell used by every modal in Gatherly.
 *
 * Implements the WAI-ARIA dialog pattern: `role="dialog"` + `aria-modal`,
 * a programmatic name from the title, Escape-to-close, a Tab focus trap,
 * focus restore to the trigger on close, and backdrop scroll locking.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClassName = 'max-w-2xl',
  bodyClassName = 'p-6 max-h-[60vh] overflow-y-auto',
  headerClassName = 'bg-gradient-to-r from-purple-900 via-rose-900 to-purple-900 text-white',
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog so keyboard and screen-reader users land here.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? panel).focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
          .filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      window.clearTimeout(focusTimer);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 ${maxWidthClassName}`}
      >
        <div className={`px-6 py-4 flex items-center justify-between ${headerClassName}`}>
          <div>
            <h3 id={titleId} className="text-base font-bold font-editorial">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className={`text-xs mt-0.5 ${headerClassName.includes('text-white') ? 'text-white/80' : 'text-slate-600'}`}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors shrink-0 ml-4"
            aria-label={`Close dialog: ${title}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
