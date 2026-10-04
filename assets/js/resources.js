/*
 * Resources page: remembers the "Joining ODU" checkboxes in this browser only.
 * Storage can be unavailable (private windows, blocked site data); the page works without it.
 */
(function () {
  const boxes = document.querySelectorAll('.res-check input[type="checkbox"][data-key]');
  if (!boxes.length) return;
  const KEY = 'wl-resources-checklist';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
  boxes.forEach(box => {
    box.checked = !!state[box.dataset.key];
    box.addEventListener('change', () => {
      state[box.dataset.key] = box.checked;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* not saved */ }
    });
  });
})();
