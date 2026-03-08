import ReactGA from "react-ga4";
import { IS_DEV } from "@/lib/constants";

interface GAEventParams {
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  value?: number | string;
  currency?: string;
  discount?: boolean;
  num_items?: number;
  transaction_id?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  const urlParams = new URLSearchParams(window.location.search);
  for (const key of UTM_KEYS) {
    const value = urlParams.get(key);
    if (value) {
      localStorage.setItem(key, value);
    }
  }
}

export function getUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};
  const params: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      params[key] = value;
    }
  }
  return params;
}

export function getGclid(): string | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("gclid") || urlParams.has("wbraid")) {
    const gclid = urlParams.get("gclid") || urlParams.get("wbraid");
    if (gclid) {
      localStorage.setItem("gclid", gclid);
      return gclid;
    }
  }

  const storedGclid = localStorage.getItem("gclid");
  if (storedGclid) {
    return storedGclid;
  }

  return null;
}

class GoogleTracking {
  private initialized = false;

  private getGclid(): string | null {
    return getGclid();
  }

  hasGclid(): boolean {
    return !!this.getGclid();
  }

  initialize(measurementId: string): void {
    if (IS_DEV) {
      console.log("[GA Dev] Initialize called with:", measurementId);
      this.initialized = true;
      return;
    }

    if (this.initialized) {
      return;
    }

    try {
      ReactGA.initialize(measurementId);
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Google Analytics:", error);
    }
  }

  initGA(): void {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (measurementId) {
      this.initialize(measurementId);
    }
  }

  track(eventName: string, eventData?: GAEventParams): void {
    if (IS_DEV) {
      console.log(`[GA Dev] ${eventName}`, eventData);
      return;
    }

    if (!this.initialized) {
      console.warn("Google Analytics not initialized");
      return;
    }

    try {
      ReactGA.event(eventName, eventData);
    } catch (error) {
      console.error("Failed to track GA event:", error);
    }
  }

  trackPageView(contentName: string): void {
    this.track("page_view", {
      content_name: contentName,
      content_type: "product",
    });
  }

  trackAddToCart(contentName: string): void {
    this.track("add_to_cart", {
      content_name: contentName,
    });
  }

  trackAddToWishlist(contentName: string): void {
    this.track("add_to_wishlist", {
      content_name: contentName,
      content_type: "product",
    });
  }

  trackLevelAchieved(level: string): void {
    this.track("level_achieved", {
      level: level,
    });
  }

  trackInitiateCheckout(
    contentName: string,
    value: string | number,
    discount: boolean = false
  ): void {
    this.track("begin_checkout", {
      content_name: contentName,
      content_type: "product",
      num_items: 1,
      currency: "USD",
      value: value,
      discount: discount,
    });
  }

  trackPurchase(
    contentName: string,
    productId: string,
    value: string | number,
    discount: boolean = false
  ): void {
    this.track("purchase", {
      transaction_id: `${Date.now()}_${productId}`,
      content_name: contentName,
      content_type: "product",
      content_ids: [productId],
      value: value,
      currency: "USD",
      discount: discount,
    });
  }
}

export const googleTracking = new GoogleTracking();
