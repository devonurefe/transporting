/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";

/**
 * Accessibility helper for modal dialogs: focus trap, ESC-to-close, initial focus
 * and focus restore on close. Attach the returned ref to the dialog panel element
 * (and set role="dialog" aria-modal="true" on it). Keyboard users can no longer
 * tab outside the open modal.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onClose: () => void
) {
  const containerRef = useRef<T>(null);
  // Keep the latest onClose without re-running the effect on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const prevFocused = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    // Initial focus: first focusable element, else the container itself
    const first = focusables()[0];
    (first ?? container)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prevFocused?.focus?.();
    };
  }, [active]);

  return containerRef;
}
