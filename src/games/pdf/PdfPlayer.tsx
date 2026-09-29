import { h } from 'preact';
import type { PdfContent } from '../meta';
import type { PlayerProps } from '../types';

export function PdfPlayer({ content, api }: PlayerProps<PdfContent>) {
  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex-1 w-full overflow-hidden">
        <iframe src={content.url} className="w-full h-full border-none" />
      </div>
      <div className="p-4 bg-gray-100 flex justify-center border-t border-gray-300">
        <button
          onClick={() => api.finish({ score: 1, maxScore: 1, mistakes: 0, puzzlesSolved: 1, perfect: 1 })}
          className="bg-violet-600 text-white px-6 py-3 rounded-full font-bold text-xl hover:bg-violet-700 shadow-md transform transition hover:scale-105"
        >
          ¡He leído el documento!
        </button>
      </div>
    </div>
  );
}
