interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  icon: string;
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Browser detection
  let browser = 'Unknown Browser';
  let icon = '🌐';

  if (ua.includes('edg/') || ua.includes('edge')) {
    browser = 'Edge';
    icon = '🔵';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
    icon = '🟢';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    icon = '🦊';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
    icon = '🍎';
  } else if (ua.includes('opera')) {
    browser = 'Opera';
    icon = '🌐';
  }

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('linux') || ua.includes('ubuntu') || ua.includes('debian')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }

  // Device detection
  let device = 'Desktop';
  if (ua.includes('mobile')) {
    device = 'Mobile';
  } else if (ua.includes('tablet')) {
    device = 'Tablet';
  }
  
  // Bot detection
  if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider')) {
    browser = 'Bot';
    device = 'Bot';
    icon = '🤖';
  }

  return { browser, os, device, icon };
} 
