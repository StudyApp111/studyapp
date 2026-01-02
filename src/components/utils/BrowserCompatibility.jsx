import React, { useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";

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
  
  // Standard browsers
  if (ua.includes('Chrome')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return { name: 'Chrome', version: match ? parseInt(match[1]) : 0, minVersion: 93, isInApp: false };
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return { name: 'Safari', version: match ? parseInt(match[1]) : 0, minVersion: 15, isInApp: false };
  }
  if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return { name: 'Firefox', version: match ? parseInt(match[1]) : 0, minVersion: 91, isInApp: false };
  }
  if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/(\d+)/);
    return { name: 'Edge', version: match ? parseInt(match[1]) : 0, minVersion: 93, isInApp: false };
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

    // Show banner for compatibility issues OR in-app browsers (which cause cross-origin script errors)
    if (issues.length > 0 || info.isInApp) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('browser_warning_dismissed', 'true');
  };

  const handleOpenInBrowser = () => {
    // Try to open in external browser
    const url = window.location.href;
    
    // For Android
    if (navigator.userAgent.includes('Android')) {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    }
    // For iOS - suggest copying link
    else {
      navigator.clipboard?.writeText(url);
      alert('Link copied! Please paste it in Safari or Chrome.');
    }
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {browserInfo?.isInApp ? 'Open in Browser' : 'Browser Update Needed'}
        </h3>

        <p className="text-sm text-slate-600 mb-4">
          {browserInfo?.isInApp ? (
            <>
              You're using <strong>{browserInfo.name}</strong> which may not work properly with StudyApp. 
              For the best experience, please open this page in Chrome, Safari, or your regular browser.
            </>
          ) : (
            <>
              Your browser version is outdated and may not support all features. 
              Please update to the latest version for the best experience.
            </>
          )}
        </p>

        <div className="space-y-2">
          {browserInfo?.isInApp && (
            <button
              onClick={handleOpenInBrowser}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </button>
          )}
          
          <button
            onClick={handleDismiss}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
              browserInfo?.isInApp 
                ? 'text-slate-600 hover:bg-slate-100' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {browserInfo?.isInApp ? 'Continue Anyway' : 'I Understand'}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Some features may not work correctly
        </p>
      </div>
    </div>
  );
}