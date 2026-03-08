import { IS_DEV } from "@/lib/constants";
import { PostHogClient } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    FB_PIXEL_ID?: string;
    userId?: string;
  }
}

interface FBTrackingEvent {
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  value?: number | string;
  currency?: string;
  discount?: boolean;
  num_items?: number;
}

interface ConversionApiPayload {
  pixel_id: string;
  event_name: string;
  event_id: string;
  event_time: number;
  action_source: string;
  user_data: {
    client_user_agent: string;
    fbc: string | null;
    fbp: string | null;
    external_id?: string;
  };
  custom_data: FBTrackingEvent;
}

function generateEventId(): string {
  return "evt_" + Math.random().toString(36).slice(2) + "_" + Date.now();
}

function constructFbcFromFbclid(fbclidValue: string): string {
  const subdomainIndex = 1;
  const creationTimestampMs = Date.now();
  return `fb.${subdomainIndex}.${creationTimestampMs}.${fbclidValue}`;
}

function getFbc(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined")
    return null;

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf("_fbc=") === 0) {
      const value = cookie.substring(5);
      localStorage.setItem("fbc", value);
      return value;
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("fbclid")) {
    const fbclid = urlParams.get("fbclid");
    if (fbclid) {
      const fbc = constructFbcFromFbclid(fbclid);
      localStorage.setItem("fbc", fbc);
      return fbc;
    }
  }

  const storedFbc =
    localStorage.getItem("fbc") || localStorage.getItem("originalFbc");
  if (storedFbc) {
    return storedFbc;
  }

  return null;
}

function getFbp(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf("_fbp=") === 0) {
      return cookie.substring(5);
    }
  }
  return null;
}

class FBTracking {
  private initialized = false;
  private pixelIds: string[] = [];

  initialize(): void {
    if (this.initialized) return;
    if (typeof window === "undefined") return;

    const pixelIdsEnv = process.env.NEXT_PUBLIC_FB_PIXEL_IDS;
    if (!pixelIdsEnv) {
      console.warn("FB Pixel IDs not configured");
      return;
    }

    this.pixelIds = pixelIdsEnv.split(",").map((id) => id.trim());
    if (this.pixelIds.length === 0) return;

    this.loadFbPixelScript();
    this.initializePixels();
    this.initialized = true;

    const fbc = getFbc();
    if (fbc) {
      this.sendToConversionApi("PageView", {}, generateEventId());
    }
  }

  private loadFbPixelScript(): void {
    if (typeof window === "undefined") return;
    if (window.fbq) return;

    const n = (window.fbq = function (...args: unknown[]) {
      if ((n as { callMethod?: (...args: unknown[]) => void }).callMethod) {
        (n as { callMethod: (...args: unknown[]) => void }).callMethod(
          ...args
        );
      } else {
        (n as { queue: unknown[][] }).queue.push(args);
      }
    }) as unknown as {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      push: typeof Array.prototype.push;
      loaded: boolean;
      version: string;
    };

    if (!window._fbq) window._fbq = window.fbq;
    n.push = n.push;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }

  private initializePixels(): void {
    if (!window.fbq || this.pixelIds.length === 0) return;

    window.FB_PIXEL_ID = this.pixelIds[0];
    this.pixelIds.forEach((id) => window.fbq?.("init", id));
  }

  hasFbc(): boolean {
    return !!getFbc();
  }

  private sendToConversionApi(
    eventName: string,
    eventData: FBTrackingEvent,
    eventId: string
  ): void {
    if (!this.pixelIds[0]) return;

    const userData: ConversionApiPayload["user_data"] = {
      client_user_agent: navigator.userAgent,
      fbc: getFbc(),
      fbp: getFbp(),
    };

    const posthogId = PostHogClient?.get_distinct_id?.();
    if (posthogId) {
      userData.external_id = posthogId;
    } else if (window.userId) {
      userData.external_id = window.userId;
    }

    const payload: ConversionApiPayload = {
      pixel_id: this.pixelIds[0],
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: userData,
      custom_data: eventData,
    };

    if (IS_DEV) {
      console.log("[FB CAPI Dev] payload", payload);
      return;
    }
  }

  private trackWithConversionApi(
    eventName: string,
    eventData: FBTrackingEvent
  ): void {
    if (typeof window === "undefined") return;
    if (window.location?.hostname === "localhost") return;

    const eventId = generateEventId();

    if (window.fbq) {
      window.fbq("track", eventName, eventData, { eventID: eventId });
    }

    this.sendToConversionApi(eventName, eventData, eventId);
  }

  track(eventName: string, eventData?: FBTrackingEvent): void {
    if (IS_DEV) {
      console.log(`[FB Pixel Dev] ${eventName}`, eventData);
      return;
    }

    if (!this.initialized) {
      console.warn("Facebook Pixel not initialized");
      return;
    }

    this.trackWithConversionApi(eventName, eventData || {});
  }

  trackViewContent(contentName: string): void {
    this.track("ViewContent", {
      content_name: contentName,
      content_type: "product",
    });
  }

  trackAddToCart(contentName: string): void {
    this.track("AddToCart", {
      content_name: contentName,
    });
  }

  trackAddToWishlist(contentName: string): void {
    this.track("AddToWishlist", {
      content_name: contentName,
      content_type: "product",
    });
  }

  trackInitiateCheckout(
    contentName: string,
    value: string | number,
    discount: boolean = false
  ): void {
    this.track("InitiateCheckout", {
      content_name: contentName,
      content_type: "product",
      num_items: 1,
      currency: "USD",
      value: value,
      discount: discount,
    });
  }

  trackLevelAchieved(level: string): void {
    this.track("LevelAchieved", {
      value: level,
    });
  }

  trackPurchase(
    contentName: string,
    productId: string,
    value: string | number,
    discount: boolean = false
  ): void {
    this.track("Purchase", {
      content_name: contentName,
      content_type: "product",
      content_ids: [productId],
      value: value,
      currency: "USD",
      discount: discount,
    });
  }
}

export const fbTracking = new FBTracking();
export { getFbc };
