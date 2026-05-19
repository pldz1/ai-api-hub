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

/**
 * Throttle a function so it runs at most once per `interval` ms.
 */
export function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}
