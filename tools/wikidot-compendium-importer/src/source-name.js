import { safeSegment } from "./paths.js";

export function publicationFolder(publication) {
  return publication ? safeSegment(publication) : "_unknown-source";
}
