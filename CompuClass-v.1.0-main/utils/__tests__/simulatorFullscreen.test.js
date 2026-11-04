import { documentIsFullscreen, exitDocumentFullscreen, requestElementFullscreen } from '../simulatorFullscreen';

describe('Windows simulator fullscreen', () => {
  it('asks the simulator element to enter fullscreen', async () => {
    const requestFullscreen = jest.fn(() => Promise.resolve());
    await expect(requestElementFullscreen({ requestFullscreen })).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('reports failure when the browser rejects fullscreen', async () => {
    const requestFullscreen = jest.fn(() => Promise.reject(new Error('denied')));
    await expect(requestElementFullscreen({ requestFullscreen })).resolves.toBe(false);
  });

  it('uses the webkit method when the standard one is missing', async () => {
    const webkitRequestFullscreen = jest.fn();
    await expect(requestElementFullscreen({ webkitRequestFullscreen })).resolves.toBe(true);
    expect(webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no element', async () => {
    await expect(requestElementFullscreen(null)).resolves.toBe(false);
  });

  it('leaves fullscreen through the document and ignores a normal page', async () => {
    const exitFullscreen = jest.fn(() => Promise.resolve());
    const doc = { fullscreenElement: {}, exitFullscreen };
    await expect(exitDocumentFullscreen(doc)).resolves.toBe(true);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(documentIsFullscreen(doc)).toBe(true);
    await expect(exitDocumentFullscreen({ fullscreenElement: null, exitFullscreen })).resolves.toBe(false);
    expect(documentIsFullscreen(null)).toBe(false);
  });
});
