import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function Modal({ open, onClose, children, wide = false }: { open: boolean; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  // Keyboard / screen reader support: focus moves into the dialog, Escape closes it, focus returns.
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" class={`max-h-[92vh] w-full overflow-auto rounded-3xl bg-white p-6 text-slate-800 shadow-2xl outline-none ${wide ? 'max-w-4xl' : 'max-w-lg'}`} style="animation: ck-pop .3s ease-out" onClick={(e) => e.stopPropagation()}>
        <div class="flex justify-end"><button onClick={onClose} class="-mr-2 -mt-2 min-h-11 min-w-11 rounded-full px-3 py-1 text-xl text-slate-600 hover:bg-slate-100" aria-label="Cerrar">✕</button></div>
        {children}
      </div>
    </div>
  );
}
