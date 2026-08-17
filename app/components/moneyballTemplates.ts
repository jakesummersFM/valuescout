// moneyballTemplates.ts

export type PositionKey =
  | "GK"
  | "CB"
  | "RBLB"
  | "DM"
  | "CM"
  | "CAM"
  | "LWRW"
  | "ST";

export const BASE_COLUMNS = [
  "Player",
  "Age",
  "Nation",
  "Club",
  "Position",
  "Rating",
  "Transfer Value",
  "Wage",
  "Expires",
  "Minutes",
] as const;

export const MONEYBALL_TEMPLATES: Record<PositionKey, string[]> = {
  GK: [
    ...BASE_COLUMNS,
    "xGP",
    "xGP/90",
    "xSv %",
    "Clean Sheets",
    "Cln/90",
    "Sv %",
    "Saves/90",
    "Pens Saved",
    "Pas %",
  ],

  CB: [
    ...BASE_COLUMNS,
    "Hdr %",
    "Aer A/90",
    "Tck R",
    "K Tck/90",
    "Int/90",
    "Blk/90",
    "Clr/90",
    "Poss Won/90",
    "Pas %",
    "Pr passes/90",
    "Dist/90",
  ],

  RBLB: [
    ...BASE_COLUMNS,
    "Tck R",
    "Int/90",
    "Poss Won/90",
    "Blk/90",
    "Clr/90",
    "Pas %",
    "Pr passes/90",
    "Dist/90",
    "xA/90",
    "KP/90",
    "Cr C/A",
    "Cr C/90",
    "Drb/90",
  ],

  DM: [
    ...BASE_COLUMNS,
    "Tck R",
    "Int/90",
    "Poss Won/90",
    "Blk/90",
    "Pas %",
    "Pr passes/90",
    "Dist/90",
    "Fouls Made",
    "KP/90",
    "xA/90",
  ],

  CM: [
    ...BASE_COLUMNS,
    "Tck R",
    "Int/90",
    "Poss Won/90",
    "Pas %",
    "Pr passes/90",
    "Dist/90",
    "KP/90",
    "xA/90",
    "Drb/90",
    "CCC",
    "Goals per 90 minutes",
  ],

  CAM: [
    ...BASE_COLUMNS,
    "xA/90",
    "KP/90",
    "OP-KP/90",
    "CCC",
    "Ch C/90",
    "Pas %",
    "Pr passes/90",
    "Drb/90",
    "Goals per 90 minutes",
    "Shots From Outside The Box Per 90 minutes",
    "Dist/90",
  ],

  LWRW: [
    ...BASE_COLUMNS,
    "xA/90",
    "KP/90",
    "Cr C/A",
    "Cr C/90",
    "Drb/90",
    "CCC",
    "Goals per 90 minutes",
    "Pas %",
    "Dist/90",
    "Tck R",
    "Int/90",
  ],

  ST: [
    ...BASE_COLUMNS,
    "Goals per 90 minutes",
    "xG",
    "Goals",
    "Shots",
    "Shot %",
    "xG/shot",
    "NP-xG/90",
    "NP-xG",
    "xG/90",
    "Shot/90",
    "Mins/Gl",
    "Conv %",
    "Off",
    "xA/90",
    "KP/90",
  ],
};

// Helper to get columns for a position
export function getColumnsForPosition(position: PositionKey): string[] {
  return MONEYBALL_TEMPLATES[position] ?? [...BASE_COLUMNS];
}
