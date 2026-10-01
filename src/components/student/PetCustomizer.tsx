import { useState } from 'preact/hooks';
import { PET_BASES, PET_ITEMS, getUnlockedItems, type PetBase, type PetSlot } from '../../lib/pets';

interface Props {
  studentXp: number;
  /** Item ids unlocked by campaign rewards (not by XP). */
  extraItems?: string[];
  initialBase: PetBase;
  initialEquipped: Partial<Record<PetSlot, string>>;
}

export function PetCustomizer({ studentXp, extraItems = [], initialBase, initialEquipped }: Props) {
  const [basePet, setBasePet] = useState<PetBase>(initialBase);
  const [equipped, setEquipped] = useState<Partial<Record<PetSlot, string>>>(initialEquipped);
  const [saving, setSaving] = useState(false);
  
  const unlocked = getUnlockedItems(studentXp, extraItems);
  const activeBase = PET_BASES.find(b => b.id === basePet) || PET_BASES[0];

  const toggleItem = (id: string, slot: PetSlot) => {
    setEquipped(prev => {
      const next = { ...prev };
      if (next[slot] === id) {
        delete next[slot];
      } else {
        next[slot] = id;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await fetch('/api/pet', {
      method: 'POST',
      body: JSON.stringify({ base_pet: basePet, equipped }),
      headers: { 'Content-Type': 'application/json' },
    });
    setSaving(false);
  };

  return (
    <div class="flex flex-col md:flex-row gap-6">
      {/* Vista Previa de la Mascota */}
      <div class="flex-1 bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-100 flex flex-col items-center justify-center relative min-h-[300px]">
        <div class="relative flex items-center justify-center w-48 h-48 bg-slate-50 rounded-full border-4 border-slate-100 shadow-inner">
          <span class="text-9xl relative z-10 text-slate-800">{activeBase.emoji}</span>
          
          {equipped.head && <span class="absolute -top-6 text-6xl z-20 transition-transform">{PET_ITEMS.find(i => i.id === equipped.head)?.emoji}</span>}
          {equipped.face && <span class="absolute top-12 text-6xl z-30 transition-transform">{PET_ITEMS.find(i => i.id === equipped.face)?.emoji}</span>}
          {equipped.body && <span class="absolute top-24 text-7xl z-20 transition-transform">{PET_ITEMS.find(i => i.id === equipped.body)?.emoji}</span>}
          {equipped.feet && <span class="absolute -bottom-4 text-5xl z-20 transition-transform">{PET_ITEMS.find(i => i.id === equipped.feet)?.emoji}</span>}
        </div>
        
        {equipped.phrase && (
          <div class="absolute top-4 right-4 bg-white border-2 border-violet-200 rounded-2xl p-3 shadow-lg max-w-xs animate-bounce font-display font-bold text-violet-700">
            {PET_ITEMS.find(i => i.id === equipped.phrase)?.emoji}
          </div>
        )}
        
        <button 
          onClick={save} 
          disabled={saving}
          class="mt-8 bg-violet-600 text-white px-8 py-3 rounded-full font-display font-bold text-lg hover:bg-violet-700 transition-colors shadow-md disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Mascota'}
        </button>
      </div>

      {/* Selector de piezas y accesorios */}
      <div class="flex-1 flex flex-col gap-6">
        <div class="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-100">
          <h2 class="text-xl font-display font-bold text-slate-800 mb-4">Elige tu pieza base</h2>
          <div class="flex gap-2 overflow-x-auto pb-2">
            {PET_BASES.map(b => (
              <button 
                key={b.id}
                onClick={() => setBasePet(b.id)}
                class={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-4xl border-2 transition-all ${basePet === b.id ? 'border-violet-500 bg-violet-50 shadow-md transform scale-110' : 'border-slate-100 hover:border-violet-300'}`}
              >
                {b.emoji}
              </button>
            ))}
          </div>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-100">
          <h2 class="text-xl font-display font-bold text-slate-800 mb-4">Accesorios Desbloqueados</h2>
          {unlocked.length === 0 ? (
            <div class="text-slate-500 text-center py-4 bg-slate-50 rounded-xl">
              ¡Sigue jugando y ganando XP para desbloquear ropa y accesorios!
            </div>
          ) : (
            <div class="grid grid-cols-4 gap-3">
              {unlocked.map(item => {
                const isActive = equipped[item.slot] === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id, item.slot)}
                    class={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${isActive ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                    title={item.name}
                  >
                    <span class="text-3xl">{item.emoji}</span>
                    <span class="text-[10px] font-bold text-slate-500 mt-1 truncate w-full text-center">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <div class="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100">
           <h2 class="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Próximos desbloqueos</h2>
           <div class="flex gap-2 overflow-x-auto pb-2 opacity-50 grayscale">
             {PET_ITEMS.filter(i => i.unlockXp > studentXp && !extraItems.includes(i.id)).slice(0, 4).map(item => (
               <div key={item.id} class="flex-shrink-0 flex flex-col items-center bg-white p-2 rounded-xl border-2 border-slate-200 min-w-[4rem]">
                 <span class="text-2xl">{item.emoji.split(' ')[0]}</span>
                 <span class="text-xs font-bold text-slate-400 mt-1">{item.unlockXp} XP</span>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
