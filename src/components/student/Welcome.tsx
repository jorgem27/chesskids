import { useEffect } from 'preact/hooks';
import { burst, speak } from '../../lib/fx';
import { sfx } from '../../lib/sfx';

/** One-shot welcome celebration after login (?hola=1). */
export default function Welcome({ name, missions }: { name: string; missions: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      burst(0.5, 0.3, 1);
      sfx.coin();
      speak(missions > 0 ? `¡Hola ${name}! Tienes ${missions} ${missions === 1 ? 'misión' : 'misiones'} esta semana.` : `¡Hola ${name}! ¡Vamos a jugar!`);
      history.replaceState(null, '', '/app');
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
