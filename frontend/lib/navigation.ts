import type { SelectedNode } from "./summa-full";

export const SLUG_TO_PART_ID: Record<string, string> = {
  "1":   "prima-pars",
  "1-2": "prima-secundae",
  "2-2": "secunda-secundae",
  "3":   "tertia-pars",
};

export const PART_ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_PART_ID).map(([k, v]) => [v, k])
);

export const PART_ABBR_TO_PART_ID: Record<string, string> = {
  "ST I":    "prima-pars",
  "ST I-II": "prima-secundae",
  "ST II-II": "secunda-secundae",
  "ST III":  "tertia-pars",
};

export const API_ABBR_TO_SLUG: Record<string, string> = {
  I:       "1",
  "I-II":  "1-2",
  "II-II": "2-2",
  III:     "3",
};

export function nodeUrl(node: SelectedNode): string {
  const slug = PART_ID_TO_SLUG[node.partId];
  return node.articleN !== undefined
    ? `/${slug}/${node.questionN}/${node.articleN}`
    : `/${slug}/${node.questionN}`;
}
