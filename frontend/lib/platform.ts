export const isAndroid = (): boolean => {
  if (!navigator) return false;

  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('android');
};

export const isIOS = (): boolean => {
  if (!navigator) return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
  return isIOSDevice;
};

export const isMobile = (): boolean => {
  return isAndroid() || isIOS();
};
