// Progressive helper: <form data-api="/api/..." data-method="POST" data-redirect="/x"> posts JSON.
function init() {
  document.querySelectorAll<HTMLFormElement>('form[data-api]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector<HTMLElement>('[data-error]');
      const btn = form.querySelector<HTMLButtonElement>('button[type=submit], button:not([type])');
      if (err) err.textContent = '';
      const data: Record<string, unknown> = {};
      new FormData(form).forEach((v, k) => { data[k] = v; });
      form.querySelectorAll<HTMLInputElement>('input[type=checkbox][name]').forEach((c) => { data[c.name] = c.checked; });
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(form.dataset.api!, {
          method: form.dataset.method ?? 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = await (res.json() as Promise<any>).catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? 'Algo ha fallado');
        const to = form.dataset.redirect?.replace(':id', String(body.id ?? ''));
        if (to) location.href = to; else location.reload();
      } catch (ex) {
        if (err) err.textContent = (ex as Error).message;
        if (btn) btn.disabled = false;
      }
    });
  });
}
init();
document.addEventListener('astro:page-load', init);
