// Feeds are fetched only on request and cached this long; nothing refreshes them.
export const FEED_TTL_SECS = 20;
export const FEED_TIMEOUT_MS = 3000;
// The bus module as a whole must answer within this, so it can't stall subway queries.
export const BUS_ANSWER_TIMEOUT_MS = 3000;
export const PER_DIR = 2;
export const STALE_SECS = 120;
