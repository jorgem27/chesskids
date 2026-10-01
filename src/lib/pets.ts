export type PetBase = 'peon' | 'caballo' | 'alfil' | 'torre' | 'dama' | 'rey';
export type PetSlot = 'head' | 'face' | 'body' | 'feet' | 'dance' | 'phrase';

export interface PetItem {
  id: string;
  slot: PetSlot;
  name: string;
  unlockXp: number;
  emoji: string;
}

export const PET_BASES: { id: PetBase; name: string; emoji: string }[] = [
  { id: 'peon', name: 'Peón', emoji: '♙' },
  { id: 'caballo', name: 'Caballo', emoji: '♘' },
  { id: 'alfil', name: 'Alfil', emoji: '♗' },
  { id: 'torre', name: 'Torre', emoji: '♖' },
  { id: 'dama', name: 'Dama', emoji: '♕' },
  { id: 'rey', name: 'Rey', emoji: '♔' },
];

export const PET_ITEMS: PetItem[] = [
  // Sombreros (head)
  { id: 'lazo', slot: 'head', name: 'Lazo rojo', unlockXp: 50, emoji: '🎀' },
  { id: 'gorra', slot: 'head', name: 'Gorra deportiva', unlockXp: 100, emoji: '🧢' },
  { id: 'auriculares', slot: 'head', name: 'Auriculares', unlockXp: 180, emoji: '🎧' },
  { id: 'sombrero', slot: 'head', name: 'Sombrero elegante', unlockXp: 300, emoji: '🎩' },
  { id: 'sombrero_vaquero', slot: 'head', name: 'Sombrero vaquero', unlockXp: 450, emoji: '🤠' },
  { id: 'casco', slot: 'head', name: 'Casco de rescate', unlockXp: 600, emoji: '⛑️' },
  { id: 'sombrero_mago', slot: 'head', name: 'Sombrero mágico', unlockXp: 1200, emoji: '🎓' },
  { id: 'corona', slot: 'head', name: 'Corona real', unlockXp: 2000, emoji: '👑' },

  // Cara (face)
  { id: 'gafas_sol', slot: 'face', name: 'Gafas de sol', unlockXp: 200, emoji: '😎' },
  { id: 'bigote', slot: 'face', name: 'Bigote francés', unlockXp: 350, emoji: '🥸' },
  { id: 'gafas_nerd', slot: 'face', name: 'Gafas de empollón', unlockXp: 500, emoji: '🤓' },
  { id: 'antifaz', slot: 'face', name: 'Antifaz ninja', unlockXp: 750, emoji: '🥷' },
  { id: 'monoculo', slot: 'face', name: 'Monóculo', unlockXp: 1000, emoji: '🧐' },

  // Cuerpo (body)
  { id: 'bufanda', slot: 'body', name: 'Bufanda cálida', unlockXp: 120, emoji: '🧣' },
  { id: 'camiseta', slot: 'body', name: 'Camiseta', unlockXp: 250, emoji: '👕' },
  { id: 'vestido', slot: 'body', name: 'Vestido', unlockXp: 400, emoji: '👗' },
  { id: 'abrigo', slot: 'body', name: 'Abrigo de invierno', unlockXp: 650, emoji: '🧥' },
  { id: 'capa', slot: 'body', name: 'Capa de héroe', unlockXp: 1500, emoji: '🦸' },

  // Pies (feet)
  { id: 'zapatillas', slot: 'feet', name: 'Zapatillas de correr', unlockXp: 150, emoji: '👟' },
  { id: 'botas', slot: 'feet', name: 'Botas de agua', unlockXp: 320, emoji: '👢' },
  { id: 'patines', slot: 'feet', name: 'Patines sobre hielo', unlockXp: 700, emoji: '⛸️' },
  { id: 'patines_ruedas', slot: 'feet', name: 'Patines de ruedas', unlockXp: 900, emoji: '🛼' },
  { id: 'patinete', slot: 'feet', name: 'Patinete eléctrico', unlockXp: 1400, emoji: '🛴' },

  // Bailes / Animaciones (dance)
  { id: 'saludo', slot: 'dance', name: 'Saludo amistoso', unlockXp: 80, emoji: '👋' },
  { id: 'baile_victoria', slot: 'dance', name: 'Baile de victoria', unlockXp: 500, emoji: '💃' },
  { id: 'salto', slot: 'dance', name: 'Salto mortal', unlockXp: 850, emoji: '🤸' },
  { id: 'magia', slot: 'dance', name: 'Truco de magia', unlockXp: 1300, emoji: '🪄' },
  { id: 'levitacion', slot: 'dance', name: 'Levitación mística', unlockXp: 1800, emoji: '🧘' },

  // Frases (phrase)
  { id: 'frase_hola', slot: 'phrase', name: '¡Hola!', unlockXp: 0, emoji: '💬 ¡Hola!' },
  { id: 'frase_vamos', slot: 'phrase', name: '¡A jugar!', unlockXp: 220, emoji: '💬 ¡A jugar!' },
  { id: 'frase_jaque', slot: 'phrase', name: '¡Jaque Mate!', unlockXp: 450, emoji: '💬 ¡Jaque Mate!' },
  { id: 'frase_tenedor', slot: 'phrase', name: 'Cuidado con el tenedor', unlockXp: 600, emoji: '💬 ¡Tenedor a la vista!' },
  { id: 'frase_genio', slot: 'phrase', name: '¡Soy un genio!', unlockXp: 950, emoji: '💬 ¡Soy un genio!' },
  { id: 'frase_rey', slot: 'phrase', name: 'Protege al rey', unlockXp: 1600, emoji: '💬 ¡Protege al rey!' },
];

/** Items unlocked by XP, plus `extra` item ids unlocked by other means (campaign rewards). */
export function getUnlockedItems(xp: number, extra: string[] = []): PetItem[] {
  return PET_ITEMS.filter((i) => xp >= i.unlockXp || extra.includes(i.id));
}

/** Keeps only a valid base and unlocked items in their own slot (student input is untrusted). */
export function sanitizePet(base: unknown, equipped: unknown, unlocked: PetItem[]): { base: PetBase; equipped: EquippedItems } | null {
  if (!PET_BASES.some((b) => b.id === base)) return null;
  const out: EquippedItems = {};
  if (equipped && typeof equipped === 'object') {
    for (const [slot, id] of Object.entries(equipped as Record<string, unknown>)) {
      const item = unlocked.find((i) => i.id === id && i.slot === slot);
      if (item) out[item.slot] = item.id;
    }
  }
  return { base: base as PetBase, equipped: out };
}

export interface StudentPetRow {
  student_id: number;
  base_pet: PetBase;
  equipped_json: string;
}

export type EquippedItems = Partial<Record<PetSlot, string>>;
