import React, { useState, useEffect } from "react";
import { Smartphone, MoreVertical, ExternalLink, X } from "lucide-react";

// Check for required browser features
const checkBrowserCompatibility = () => {
  const issues = [];
  
  if (typeof Object.hasOwn !== 'function') issues.push('Object.hasOwn');
  try { eval('const x = {}; x?.y?.z;'); } catch (e) { issues.push('Optional chaining'); }
  if (typeof Promise.allSettled !== 'function') issues.push('Promise.allSettled');
  if (typeof [].at !== 'function') issues.push('Array.at');
  if (typeof structuredClone !== 'function') issues.push('structuredClone');
  if (typeof ResizeObserver !== 'function') issues.push('ResizeObserver');

  return issues;
};

// Detect browser info
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  
  if (ua.includes('BytedanceWebview') || ua.includes('musical_ly')) return { name: 'TikTok Browser', isInApp: true };
  if (ua.includes('Instagram')) return { name: 'Instagram Browser', isInApp: true };
  if (ua.includes('FBAN') || ua.includes('FBAV')) return { name: 'Facebook Browser', isInApp: true };
  if (ua.includes('Snapchat')) return { name: 'Snapchat Browser', isInApp: true };
  if (ua.includes('Twitter') || ua.includes('X-Twitter')) return { name: 'Twitter/X Browser', isInApp: true };
  if (ua.includes('LinkedIn')) return { name: 'LinkedIn Browser', isInApp: true };
  if (ua.includes('HuaweiBrowser') || ua.includes('HMSCore')) return { name: 'Huawei Browser', isInApp: true };
  if (ua.includes('Instabridge')) return { name: 'Instabridge Browser', isInApp: true };
  if (ua.includes('wv') || ua.includes('WebView')) return { name: 'In-App Browser', isInApp: true };
  
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    const match = ua.match(/Chrome\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Chrome', version, minVersion: 90, isInApp: false, isOutdated: version > 0 && version < 90 };
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Safari', version, minVersion: 14, isInApp: false, isOutdated: version > 0 && version < 14 };
  }
  if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Firefox', version, minVersion: 88, isInApp: false, isOutdated: version > 0 && version < 88 };
  }
  if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Edge', version, minVersion: 90, isInApp: false, isOutdated: version > 0 && version < 90 };
  }
  if (ua.includes('SamsungBrowser')) {
    const match = ua.match(/SamsungBrowser\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Samsung Internet', version, minVersion: 14, isInApp: false, isOutdated: version > 0 && version < 14 };
  }
  if (ua.includes('UCBrowser')) return { name: 'UC Browser', isInApp: false, isOutdated: true };
  if (ua.includes('OPR') || ua.includes('Opera')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    const version = match ? parseInt(match[1]) : 0;
    return { name: 'Opera', version, minVersion: 76, isInApp: false, isOutdated: version > 0 && version < 76 };
  }
  
  return { name: 'Unknown', isInApp: false };
};

export default function BrowserCompatibilityBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [browserInfo, setBrowserInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('browser_warning_dismissed')) return;
    const issues = checkBrowserCompatibility();
    const info = getBrowserInfo();
    setBrowserInfo(info);
    if (issues.length > 0 || info.isInApp || info.isOutdated) setShowBanner(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('browser_warning_dismissed', 'true');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-end mb-2">
          <button onClick={handleDismiss} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
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
            {browserInfo?.isInApp ? <>For the best experience, open this in your regular browser</> :
             browserInfo?.isOutdated ? <>Your browser is outdated. Please update for the best experience.</> :
             <>Your browser may not support all features.</>}
          </p>
          {browserInfo?.isInApp && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="bg-white rounded-lg p-2 shadow-sm"><MoreVertical className="w-6 h-6 text-purple-600" /></div>
                <p className="text-sm text-slate-700 font-medium">Tap the <MoreVertical className="w-3 h-3 inline" /> menu at the top</p>
                <p className="text-xs text-slate-600">Then select <strong>"Open in Browser"</strong></p>
              </div>
            </div>
          )}
          <button onClick={handleDismiss} className="w-full py-3 px-4 rounded-xl font-semibold transition-colors bg-purple-600 hover:bg-purple-700 text-white">
            {browserInfo?.isInApp ? 'Continue Anyway' : 'I Understand'}
          </button>
          <p className="text-xs text-slate-400">{browserInfo?.isInApp ? 'Your progress will be saved' : 'Some features may not work'}</p>
        </div>
      </div>
    </div>
  );
}

// Check if TikTok/Instagram/etc in-app browser
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

// Specifically detect TikTok and Instagram in-app browsers
// These browsers CANNOT do OAuth at all — auth buttons must be completely hidden
export const checkIsSocialInAppBrowser = () => {
  const ua = navigator.userAgent;
  return ua.includes('BytedanceWebview') || 
         ua.includes('musical_ly') || 
         ua.includes('Instagram') ||
         ua.includes('FBAN') || 
         ua.includes('FBAV');
};

// Detect if user is on a mobile device (used for guest preview availability)
export const checkIsMobile = () => {
  // Primary check: touch support + screen width
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth <= 768;
  
  // UA-based check as backup
  const ua = navigator.userAgent;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  
  // iPad detection (iPadOS reports as Mac)
  const isIPad = /Macintosh/i.test(ua) && hasTouchScreen;
  
  return (hasTouchScreen && isNarrowScreen) || mobileUA || isIPad;
};