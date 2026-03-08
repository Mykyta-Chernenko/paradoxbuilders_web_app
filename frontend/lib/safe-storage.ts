const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string): void {
  try {
    const encoded = encodeURIComponent(value);
    const secure = isSecure ? ";Secure" : "";
    document.cookie = `${name}=${encoded};path=/;max-age=86400;SameSite=Strict${secure}`;
  } catch {
  }
}

function removeCookie(name: string): void {
  try {
    const secure = isSecure ? ";Secure" : "";
    document.cookie = `${name}=;path=/;max-age=0;SameSite=Strict${secure}`;
  } catch {
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    return getCookie(key);
  },

  setItem(key: string, value: string): void {
    setCookie(key, value);
  },

  removeItem(key: string): void {
    removeCookie(key);
  },
};
