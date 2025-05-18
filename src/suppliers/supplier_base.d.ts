/**
 * Represents a serialized response from a supplier with content type and optional content.
 * This type is used to standardize the format of responses across different supplier implementations.
 */
export type SerializedResponse = {
  /** The MIME type of the content (e.g., 'application/json', 'text/html') */
  contentType: string;
  /** The serialized content of the response. Optional as some responses may not have content. */
  content?: string;
};
