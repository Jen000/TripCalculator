import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (initialized || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
  });
  initialized = true;
}

export function identify(userSub: string, props?: { firstName?: string | null }) {
  if (!initialized) return;
  posthog.identify(userSub, props?.firstName ? { firstName: props.firstName } : undefined);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export function trackPageview(path: string) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.href, path });
}
