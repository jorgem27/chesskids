import type { ComponentChildren } from 'preact';

export function Modal({ open, onClose, children, wide = false }: { open: boolean; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div class={`max-h-[92vh] w-full overflow-auto rounded-3xl bg-white p-6 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`} style="animation: ck-pop .3s ease-out" onClick={(e) => e.stopPropagation()}>
        <div class="flex justify-end"><button onClick={onClose} class="-mr-2 -mt-2 rounded-full px-3 py-1 text-xl text-slate-400 hover:bg-slate-100">✕</button></div>
        {children}
      </div>
    </div>
  );
}
