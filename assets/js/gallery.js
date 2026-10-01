/*
 * Lab life photo strip: arrow buttons scroll the strip; clicking a photo opens
 * it larger in a <dialog> with previous/next and keyboard (arrows, Esc).
 * Without JavaScript each photo is a plain link to the full-size image.
 */
(function () {
  const strip = document.querySelector('.gallery');
  const box = document.querySelector('.lightbox');
  if (!strip) return;
  const links = Array.from(strip.querySelectorAll('.gallery-link'));

  document.querySelectorAll('.gallery-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = strip.clientWidth * 0.8 * Number(btn.dataset.dir);
      strip.scrollBy({ left: step, behavior: 'smooth' });
    });
  });

  if (!box || typeof box.showModal !== 'function') return;
  const img = box.querySelector('img');
  const when = box.querySelector('.gallery-when');
  const text = box.querySelector('.lightbox-text');
  let current = 0;

  function show(i) {
    current = (i + links.length) % links.length;
    const a = links[current];
    img.src = a.href;
    img.alt = a.dataset.caption;
    when.textContent = a.dataset.when;
    text.textContent = a.dataset.caption;
  }
  links.forEach((a, i) => a.addEventListener('click', e => {
    e.preventDefault();
    show(i);
    box.showModal();
  }));
  box.querySelector('.lightbox-close').addEventListener('click', () => box.close());
  box.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
  box.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
  box.addEventListener('click', e => { if (e.target === box) box.close(); });   // click on backdrop
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
  });
  box.addEventListener('close', () => { links[current] && links[current].focus(); });
})();
