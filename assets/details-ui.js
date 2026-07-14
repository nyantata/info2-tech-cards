(() => {
  function setAll(open) {
    document.querySelectorAll('.concept-detail').forEach((d) => { d.open = open; });
  }
  function openHashTarget() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    const parent = target.closest?.('details');
    if (parent) parent.open = true;
  }
  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-details-open]').forEach((b) => b.addEventListener('click', () => setAll(true)));
    document.querySelectorAll('[data-details-close]').forEach((b) => b.addEventListener('click', () => setAll(false)));
    document.querySelectorAll('.concept-detail').forEach((d) => {
      const s = d.querySelector(':scope > summary');
      if (!s) return;
      s.setAttribute('role', 'button');
      s.setAttribute('aria-controls', d.id ? `${d.id}-body` : '');
      const body = d.querySelector(':scope > .concept-detail-body');
      if (body && d.id) body.id = `${d.id}-body`;
      const sync = () => s.setAttribute('aria-expanded', d.open ? 'true' : 'false');
      d.addEventListener('toggle', sync); sync();
    });
    openHashTarget();
  });
  addEventListener('hashchange', openHashTarget);
  addEventListener('beforeprint', () => setAll(true));
})();
