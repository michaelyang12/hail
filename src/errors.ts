import { errorAnswer, type ErrorAnswer } from "./model";

// The only expected failure that is thrown: an upstream feed is down or answered
// badly. Answer builders turn it into an error answer.
export class FeedError extends Error {}

// Resolves to the feed's result, or to the error answer riders see when it's down.
export async function orFeedError<T>(load: Promise<T>): Promise<T | ErrorAnswer> {
  try {
    return await load;
  } catch (e) {
    if (e instanceof FeedError) return errorAnswer(null, e.message);
    throw e;
  }
}
