export type ObstacleType = "VELUX" | "SCHOUW" | "DAKDOORVOER" | "ANDERS";

export type Obstacle = {
  id: string;
  type: ObstacleType;
  x_m: number;
  y_m: number;
  w_m: number;
  h_m: number;
  buffer_m: number;
};

export type RoofAzimuth = "O" | "ZO" | "Z" | "ZW" | "W" | "NO" | "N" | "NW";

export type RoofInput = {
  roofWidth_m: number;
  slopedLength_m: number;
  margin_m: number;
  rafterSpacing_m: number;
  rafterOffset_m: number;
  azimuth: RoofAzimuth;
};

export type PanelOrientationMode = "auto" | "portrait" | "landscape";

export type PanelInput = {
  panelW_m: number;
  panelH_m: number;
  orientationMode: PanelOrientationMode;
  gap_m: number;
  wp: number;
  voc: number;
};

export type InverterInput = {
  brand: string;
  model: string;
  vocMin: number;
  vocMax: number;
  mpptCount?: number;
  stringsPerMppt?: number;
  mpptMinV?: number;
  mpptMaxV?: number;
  acPowerW?: number;
  maxDcPowerW?: number;
};

export type MountingInput = {
  railsPerRow: number;
  railEdgeMargin_m: number;
  maxHookSpacing_m: number;
  maxEndDist_m: number;
  snapTol_m: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type Rail = { x1: number; y1: number; x2: number; y2: number };

export type Hook = {
  x: number;
  y: number;
  snapped: boolean;
  rafterX: number | null;
  rafterIndex: number | null;
};

export type LayoutResult = {
  keepouts: Rect[];
  panels: Rect[];
  rowsCount: number;
  rails: Rail[];
  hooks: Hook[];
};
