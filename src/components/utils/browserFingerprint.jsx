// Generate anonymous browser fingerprint for abuse detection
export async function generateFingerprint() {
  const components = [];
  
  // Screen info
  components.push(screen.width);
  components.push(screen.height);
  components.push(screen.colorDepth);
  components.push(screen.pixelDepth);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  components.push(navigator.languages?.join(',') || '');
  
  // Platform
  components.push(navigator.platform);
  components.push(navigator.hardwareConcurrency || 0);
  components.push(navigator.deviceMemory || 0);
  
  // Canvas fingerprint (lightweight)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    components.push(canvas.toDataURL());
  } catch (e) {
    components.push('canvas-error');
  }
  
  // WebGL
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
      components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
    }
  } catch (e) {
    components.push('webgl-error');
  }
  
  // Combine and hash
  const fingerprint = components.join('|||');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}