import { base44 } from "@/api/base44Client";

export const detectDeviceInfo = () => {
  const ua = navigator.userAgent;
  
  // Device type detection
  const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);
  
  let deviceType = 'desktop';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';
  
  // Operating System detection
  let os = 'Unknown';
  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Mac') !== -1) os = 'MacOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';
  
  // Browser detection
  let browser = 'Unknown';
  let browserVersion = '';
  
  if (ua.indexOf('Firefox') !== -1) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/([0-9.]+)/)?.[1] || '';
  } else if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/([0-9.]+)/)?.[1] || '';
  } else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([0-9.]+)/)?.[1] || '';
  } else if (ua.indexOf('Edg') !== -1) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/([0-9.]+)/)?.[1] || '';
  }
  
  // PWA detection
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone === true;
                
  // App type detection
  let appType = 'desktop_web';
  if (window.ReactNativeWebView || window.Capacitor || window.cordova || window.PhoneGap || window.Android) {
    if (/(iPhone|iPod|iPad)/i.test(ua)) appType = 'ios_app';
    else appType = 'android_app';
  } else if (/(iPhone|iPod|iPad)/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|mercury)/i.test(ua)) {
    appType = 'ios_app'; // iOS WebView
  } else if (/wv\)/i.test(ua)) {
    appType = 'android_app'; // Android WebView
  } else if (deviceType === 'mobile' || deviceType === 'tablet') {
    appType = 'mobile_web';
  }
  
  return {
    device_type: deviceType,
    app_type: appType,
    operating_system: os,
    browser: browser,
    browser_version: browserVersion,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: ua,
    language: navigator.language || navigator.userLanguage,
    is_pwa_installed: isPWA,
    referrer: document.referrer || 'direct'
  };
};

export const trackUserSession = async () => {
  try {
    const user = await base44.auth.me();
    if (!user) return;
    
    const deviceInfo = detectDeviceInfo();
    const nowISO = new Date().toISOString();
    const nowTs = Date.now();

    const lastStartTs = user.last_session_start_at ? Date.parse(user.last_session_start_at) : 0;
    const isNewSession = !lastStartTs || (nowTs - lastStartTs) > (30 * 60 * 1000); // 30-min window

    const updateData = {
      ...deviceInfo,
      last_active_date: nowISO,
      last_session_start_at: isNewSession ? nowISO : user.last_session_start_at,
      session_count: isNewSession ? (user.session_count || 0) + 1 : (user.session_count || 0),
    };

    // Only bump total_logins if it's clearly a fresh login (12h+ since last login)
    const lastLoginTs = user.last_login_at ? Date.parse(user.last_login_at) : 0;
    if (!lastLoginTs || (nowTs - lastLoginTs) > (12 * 60 * 60 * 1000)) {
      updateData.total_logins = (user.total_logins || 0) + 1;
      updateData.last_login_at = nowISO;
    }
    
    // Set first visit if not set
    if (!user.first_visit_date) {
      updateData.first_visit_date = nowISO;
    }
    
    await base44.auth.updateMe(updateData);
  } catch (error) {
    console.error('Error tracking user session:', error);
  }
};

export const trackSessionDuration = () => {
  const sessionStart = Date.now();
  
  const updateDuration = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;
      
      const sessionDuration = Math.floor((Date.now() - sessionStart) / 1000);
      const totalSessions = user.session_count || 1;
      const currentAvg = user.average_session_duration || 0;
      
      // Calculate new average
      const newAvg = Math.floor(((currentAvg * (totalSessions - 1)) + sessionDuration) / totalSessions);
      
      await base44.auth.updateMe({
        average_session_duration: newAvg
      });
    } catch (error) {
      console.error('Error tracking session duration:', error);
    }
  };
  
  // Track on page unload
  window.addEventListener('beforeunload', updateDuration);
  
  // Track every 5 minutes as well
  const interval = setInterval(updateDuration, 5 * 60 * 1000);
  
  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', updateDuration);
  };
};