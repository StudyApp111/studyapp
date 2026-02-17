import React, { useState, useEffect } from "react";
import { Smartphone, MoreVertical, ExternalLink, X } from "lucide-react";

// Check for required browser features
const checkBrowserCompatibility = () => {
  const issues = [];
  
  // Check for Object.hasOwn (ES2022)
  if (typeof Object.hasOwn !== 'function') {
    issues.push('Object.hasOwn');
  }
  
  // Check for optional chaining support (via a simple test)
  try {
    eval('const x = {}; x?.y?.z;');
  } catch (e) {
    issues.push('Optional chaining');
  }
  
  // Check for Promise.allSettled (ES2020)
  if (typeof Promise.allSettled !== 'function') {
    issues.push('Promise.allSettled');
  }
  
  // Check for Array.prototype.at (ES2022)
  if (typeof [].at !== 'function') {
    issues.push('Array.at');
  }
  
  // Check for structuredClone (2022)
  if (typeof structuredClone !== 'function') {
    issues.push('structuredClone');
  }
  
  // Check for ResizeObserver
  if (typeof ResizeObserver !== 'function') {
    issues.push('ResizeObserver');
  }

  return issues;
};

// Detect browser info
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  
  // Check for in-app browsers
  if (ua.includes('BytedanceWebview') || ua.includes('musical_ly')) {
    return { name: 'TikTok Browser', isInApp: true };
  }
  if (ua.includes('Instagram')) {
    return { name: 'Instagram Browser', isInApp: true };
  }
  if (ua.includes('FBAN') || ua.includes('FBAV')) {
    return { name: 'Facebook Browser', isInApp: true };
  }
  if (ua.includes('Snapchat')) {
    return { name: 'Snapchat Browser', isInApp: true };
  }
  if (ua.includes('Twitter') || ua.includes('X-Twitter')) {
    return { name: 'Twitter/X Browser', isInApp: true };
  }
  if (ua.includes('LinkedIn')) {
    return { name: 'LinkedIn Browser', isInApp: true };
  }
  if (ua.includes('HuaweiBrowser') || ua.includes('HMSCore')) {
    return { name: 'Huawei Browser', isInApp: true };
  }
  // Instabridge and other wrapper browsers
  if (ua.includes('Instabridge')) {
    return { name: 'Instabridge Browser', isInApp: true };
  }
  // Generic WebView detection
  if (ua.includes('wv') || ua.includes('WebView')) {
    return { name: 'In-App Browser', isInApp: true };
  }
  
  // Standard browsers - check version for outdated browsers
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    const match = ua.match(/Chrome\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Chrome', 
      version, 
      minVersion: 90, 
      isInApp: false,
      isOutdated: version > 0 && version < 90
    };
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Safari', 
      version, 
      minVersion: 14, 
      isInApp: false,
      isOutdated: version > 0 && version < 14
    };
  }
  if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Firefox', 
      version, 
      minVersion: 88, 
      isInApp: false,
      isOutdated: version > 0 && version < 88
    };
  }
  if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Edge', 
      version, 
      minVersion: 90, 
      isInApp: false,
      isOutdated: version > 0 && version < 90
    };
  }
  // Samsung Internet
  if (ua.includes('SamsungBrowser')) {
    const match = ua.match(/SamsungBrowser\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Samsung Internet', 
      version, 
      minVersion: 14, 
      isInApp: false,
      isOutdated: version > 0 && version < 14
    };
  }
  // UC Browser
  if (ua.includes('UCBrowser')) {
    return { name: 'UC Browser', isInApp: false, isOutdated: true };
  }
  // Opera
  if (ua.includes('OPR') || ua.includes('Opera')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { 
      name: 'Opera', 
      version, 
      minVersion: 76, 
      isInApp: false,
      isOutdated: version > 0 && version < 76
    };
  }
  
  return { name: 'Unknown', isInApp: false };
};

export default function BrowserCompatibilityBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [browserInfo, setBrowserInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem('browser_warning_dismissed')) {
      return;
    }

    const issues = checkBrowserCompatibility();
    const info = getBrowserInfo();
    setBrowserInfo(info);

    // Show banner for compatibility issues, in-app browsers, or outdated browsers
    if (issues.length > 0 || info.isInApp || info.isOutdated) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('browser_warning_dismissed', 'true');
  };

  // Export function to check if TikTok/Instagram browser
  const isInAppBrowser = () => {
    const ua = navigator.userAgent;
    return ua.includes('BytedanceWebview') || 
           ua.includes('musical_ly') || 
           ua.includes('Instagram');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-end mb-2">
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
            <Smartphone className="w-8 h-8 text-purple-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            {browserInfo?.isInApp ? 'Open in Your Browser' : 'Browser Update Needed'}
          </h3>

          <p className="text-sm text-slate-600">
            {browserInfo?.isInApp ? (
              <>For the best experience, open this in your regular browser</>
            ) : browserInfo?.isOutdated ? (
              <>Your browser is outdated. Please update for the best experience.</>
            ) : (
              <>Your browser may not support all features.</>
            )}
          </p>

          {browserInfo?.isInApp && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="bg-white rounded-lg p-2 shadow-sm">
                  <MoreVertical className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Tap the <MoreVertical className="w-3 h-3 inline" /> menu at the top
                </p>
                <p className="text-xs text-slate-600">
                  Then select <strong>"Open in Browser"</strong>
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleDismiss}
            className="w-full py-3 px-4 rounded-xl font-semibold transition-colors bg-purple-600 hover:bg-purple-700 text-white"
          >
            {browserInfo?.isInApp ? 'Continue Anyway' : 'I Understand'}
          </button>

          <p className="text-xs text-slate-400">
            {browserInfo?.isInApp ? 'Your progress will be saved' : 'Some features may not work'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Export helper function for use in other components
export const checkIsInAppBrowser = () => {
  const ua = navigator.userAgent;
  return ua.includes('BytedanceWebview') || 
         ua.includes('musical_ly') || 
         ua.includes('Instagram') ||
         ua.includes('FBAN') || 
         ua.includes('FBAV') ||
         ua.includes('Snapchat') ||
         ua.includes('Twitter') || 
         ua.includes('X-Twitter') ||
         ua.includes('LinkedIn') ||
         (ua.includes('wv') && !ua.includes('Chrome'));
};