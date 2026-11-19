/**
 * Legacy TaskMarket services (escrow auto-release, FBR seller reports) are off
 * unless explicitly re-enabled. They belong to the retired services marketplace.
 */
export function legacyTaskMarketEnabled() {
  return process.env.LEGACY_TASKMARKET_ENABLED === "true";
}

export function legacyDisabledResponse() {
  return Response.json({ error: "This legacy TaskMarket endpoint has been retired." }, { status: 410 });
}
