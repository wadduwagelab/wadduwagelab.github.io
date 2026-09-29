/*
 * Scroll interaction: sections and cards fade/slide in as they enter the viewport.
 * Skipped for visitors who prefer reduced motion.
 */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // reveal on scroll
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
