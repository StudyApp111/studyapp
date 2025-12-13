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
  
  return {
    device_type: deviceType,
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
    const now = new Date().toISOString();
    
    const updateData = {
      ...deviceInfo,
      last_active_date: now,
      session_count: (user.session_count || 0) + 1,
      total_logins: (user.total_logins || 0) + 1
    };
    
    // Set first visit if not set
    if (!user.first_visit_date) {
      updateData.first_visit_date = now;
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