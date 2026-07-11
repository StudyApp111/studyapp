import React from 'react';

/**
 * lazyWithReload
 *
 * Wraps React.lazy so that a failed dynamic import — which happens when the
 * browser holds a STALE index.html/JS bundle after a new deploy changed the
 * chunk hashes (old chunk URLs 404) — triggers ONE full-page reload instead of
 * crashing into the error boundary.
 *
 * Why a reload is the correct fix (not a bandaid):
 *   Once the entry HTML is stale, the referenced chunk hashes no longer exist
 *   on the server. There is no way to recover the module in-place — the only
 *   way to get valid hashes is to re-fetch index.html. A guarded hard reload
 *   does exactly that, and the retried navigation loads the fresh chunk.
 *
 * Loop protection: we record the reload attempt in sessionStorage keyed by the
 * chunk name. If the import fails AGAIN after a reload (genuine build/network
 * problem, not a stale bundle), we stop reloading and let the error surface to
 * the ErrorBoundary so it isn't hidden.
 */
export function lazyWithReload(factory, chunkName) {
  return React.lazy(() =>
    factory().catch((error) => {
      const isChunkLoadError =
        /Failed to fetch dynamically imported module|Unable to preload CSS|error loading dynamically imported module|Importing a module script failed/i.test(
          error?.message || ''
        );

      const key = `chunk_reload_${chunkName || 'unknown'}`;

      if (isChunkLoadError && !sessionStorage.getItem(key)) {
        // First failure for this chunk this session — mark and hard-reload to
        // pull the fresh index.html with the correct chunk hashes.
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise so React keeps the Suspense fallback
        // visible during the split-second before the reload takes effect.
        return new Promise(() => {});
      }

      // Either not a chunk error, or we already reloaded once and it still
      // failed — let it propagate so the ErrorBoundary can report it.
      throw error;
    })
  );
}

/**
 * On a fully successful load we clear the reload marker, so a LATER deploy in
 * the same session can retry-reload again. Call this once the app has mounted.
 */
export function clearChunkReloadMarkers() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('chunk_reload_'))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}