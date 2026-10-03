import { h } from 'preact';
import type { PdfContent } from '../meta';
import type { EditorProps } from '../types';

export function PdfEditor({ value, onChange }: EditorProps<PdfContent>) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL del PDF
        </label>
        <input
          type="text"
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 font-mono"
          placeholder="/activities/pdfs/Lesson 1.pdf"
          value={value?.url ?? ''}
          onInput={(e) => onChange({ ...value, url: e.currentTarget.value })}
        />
        <p className="mt-1 text-sm text-gray-500">
          Puede ser una URL externa o una ruta interna (ej. /activities/pdfs/Lesson 1.pdf).
        </p>
      </div>
    </div>
  );
}
