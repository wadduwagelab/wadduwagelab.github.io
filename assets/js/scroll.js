/*
 * Scroll interactions:
 *  1. Circular text badges rotate with scroll position (plus a slow idle spin).
 *  2. Sections and cards fade/slide in as they enter the viewport.
 * Both are skipped for visitors who prefer reduced motion.
 */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // 1. rotating circular text
  const rings = Array.from(document.querySelectorAll('.circle-rot'));
  if (rings.length && !reduce) {
    let angle = 0, lastY = window.scrollY, velocity = 0;
    function tick() {
      const y = window.scrollY;
      velocity += (y - lastY) * 0.35;        // scrolling pushes the ring
      lastY = y;
      velocity *= 0.9;                        // ease out
      angle += 0.12 + velocity * 0.1;         // idle spin + scroll spin
      rings.forEach(r => r.setAttribute('transform', `rotate(${angle.toFixed(2)} 100 100)`));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // 2. reveal on scroll
  if (reduce || !('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll(
    'main section:not(.hero) .section-title, .research-card, .software-card, .member, .news-item, .pub-list > li, .funding-item, .patent-item'
  );
  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 6) * 45}ms`;
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  targets.forEach(el => io.observe(el));
})();
