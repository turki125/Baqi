import { z } from "zod";
import { ListListingsQueryParams } from "@workspace/api-zod";

// Exploded query parameters arrive as a string for one value and an array for
// repeated values. Normalize at the HTTP boundary, leaving generated schemas intact.
const queryTerms = (value: unknown) => typeof value === "string" ? [value] : value;

export const ListingsHttpQuery = ListListingsQueryParams.extend({
  searchTermsEn: z.preprocess(queryTerms, ListListingsQueryParams.shape.searchTermsEn),
  searchTermsAr: z.preprocess(queryTerms, ListListingsQueryParams.shape.searchTermsAr),
  // Boolean coercion treats the string "false" as true. Parse URL booleans explicitly.
  freeOnly: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean().optional(),
  ),
});
