import { base44 } from "@/api/base44Client";
import { detectDeviceInfo } from "./userTracking";

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('study_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('study_session_id', sessionId);
  }
  return sessionId;
};

// Track any user event
export const trackEvent = async (eventType, eventName, metadata = {}) => {
  try {
    const user = await base44.auth.me();
    if (!user) return;

    const deviceInfo = detectDeviceInfo();
    const currentPage = window.location.pathname;

    await base44.entities.UserEvent.create({
      user_email: user.email,
      event_type: eventType,
      event_name: eventName,
      page: currentPage,
      metadata: {
        ...metadata,
        url: window.location.href
      },
      session_id: getSessionId(),
      device_type: deviceInfo.device_type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Silent fail - don't disrupt user experience
    console.error('Event tracking error:', error);
  }
};

// Convenience methods
export const trackPageView = (pageName) => trackEvent('page_view', pageName);

export const trackButtonClick = (buttonName, metadata = {}) => 
  trackEvent('button_click', buttonName, metadata);

export const trackFeatureUse = (featureName, metadata = {}) => 
  trackEvent('feature_use', featureName, metadata);

export const trackFormSubmit = (formName, metadata = {}) => 
  trackEvent('form_submit', formName, metadata);

export const trackNavigation = (from, to) => 
  trackEvent('navigation', `${from}_to_${to}`, { from, to });

export const trackAppClose = () => {
  // Use sendBeacon for reliability on page close
  const user = JSON.parse(localStorage.getItem('study_user_cache') || '{}');
  if (!user.email) return;
  
  trackEvent('app_close', 'app_closed', {
    session_duration: Date.now() - parseInt(sessionStorage.getItem('session_start') || Date.now())
  });
};

// Initialize tracking
export const initEventTracking = () => {
  sessionStorage.setItem('session_start', Date.now().toString());
  
  // Track app close
  window.addEventListener('beforeunload', trackAppClose);
  window.addEventListener('pagehide', trackAppClose);
  
  return () => {
    window.removeEventListener('beforeunload', trackAppClose);
    window.removeEventListener('pagehide', trackAppClose);
  };
};