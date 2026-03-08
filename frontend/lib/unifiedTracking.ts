"use client";

import { useEffect } from "react";
import { fbTracking } from "./fbTracking";
import { googleTracking, captureUtmParams } from "./googleTracking";

class UnifiedTracking {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    googleTracking.initGA();
    fbTracking.initialize();
    captureUtmParams();
    this.initialized = true;
  }

  private hasFbc(): boolean {
    return true;
  }

  private hasGclid(): boolean {
    return true;
  }

  trackViewContent(contentName: string): void {
    if (this.hasFbc()) {
      fbTracking.trackViewContent(contentName);
    }
    if (this.hasGclid()) {
      googleTracking.trackPageView(contentName);
    }
  }

  trackAddToCart(contentName: string): void {
    if (this.hasFbc()) {
      fbTracking.trackAddToCart(contentName);
    }
    if (this.hasGclid()) {
      googleTracking.trackAddToCart(contentName);
    }
  }

  trackAddToWishlist(contentName: string): void {
    if (this.hasFbc()) {
      fbTracking.trackAddToWishlist(contentName);
    }
    if (this.hasGclid()) {
      googleTracking.trackAddToWishlist(contentName);
    }
  }

  trackLevelAchieved(level: string): void {
    if (this.hasFbc()) {
      fbTracking.trackLevelAchieved(level);
    }
    if (this.hasGclid()) {
      googleTracking.trackLevelAchieved(level);
    }
  }

  trackInitiateCheckout(
    contentName: string,
    value: string | number,
    discount: boolean = false
  ): void {
    if (this.hasFbc()) {
      fbTracking.trackInitiateCheckout(contentName, value, discount);
    }
    if (this.hasGclid()) {
      googleTracking.trackInitiateCheckout(contentName, value, discount);
    }
  }

  trackPurchase(
    contentName: string,
    productId: string,
    value: string | number,
    discount: boolean = false
  ): void {
    if (this.hasFbc()) {
      fbTracking.trackPurchase(contentName, productId, value, discount);
    }
    if (this.hasGclid()) {
      googleTracking.trackPurchase(contentName, productId, value, discount);
    }
  }
}

export const unifiedTracking = new UnifiedTracking();

export function UnifiedTrackingInitializer() {
  useEffect(() => {
    unifiedTracking.initialize();
  }, []);

  return null;
}
