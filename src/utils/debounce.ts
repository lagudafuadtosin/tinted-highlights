export function debounce<A extends unknown[]>(
  func: (...args: A) => void,
  wait?: number,
  immediate?: boolean
) {
  let timeout: number;

  return function executedFunction(this: unknown, ...args: A) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    window.clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}
