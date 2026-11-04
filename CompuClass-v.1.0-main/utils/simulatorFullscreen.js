// Fullscreen for the Windows simulator only. Web uses the browser Fullscreen
// API on the simulator element. A false result means the caller should fill
// the app window itself.

function asFullscreenNode(element) {
  if (!element) return null;
  if (typeof element.requestFullscreen === 'function' || typeof element.webkitRequestFullscreen === 'function') {
    return element;
  }
  return null;
}

export function requestElementFullscreen(element) {
  const node = asFullscreenNode(element);
  if (!node) return Promise.resolve(false);
  try {
    const result = typeof node.requestFullscreen === 'function'
      ? node.requestFullscreen()
      : node.webkitRequestFullscreen();
    if (result && typeof result.then === 'function') return result.then(() => true, () => false);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function exitDocumentFullscreen(doc) {
  const target = doc || (typeof document !== 'undefined' ? document : null);
  if (!target?.fullscreenElement || typeof target.exitFullscreen !== 'function') return Promise.resolve(false);
  try {
    const result = target.exitFullscreen();
    if (result && typeof result.then === 'function') return result.then(() => true, () => false);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function documentIsFullscreen(doc) {
  const target = doc || (typeof document !== 'undefined' ? document : null);
  return Boolean(target?.fullscreenElement);
}
