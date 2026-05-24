/**
 * Debounce a function call until the user stops triggering it for `delay` ms.
 */
export function debounce(fn, delay, immediate = false) {
  let timer;
  return function (...args) {
    if (immediate && !timer) {
      fn.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!immediate) fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
