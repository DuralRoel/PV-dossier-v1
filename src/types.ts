export type ObstacleType = "VELUX" | "SCHOUW" | "DAKDOORVOER" | "ANDERS";

export type Obstacle = {
  id: string;
  type: ObstacleType;
  x_m: number; // vanaf linksonder dakvlak
  y_m: number;
  w_m: number;
  h_m: number;
  buffer_m: number; // keep-out extra rondom
};

export type RoofInput = {
  roofWidth_m: number;      // breedte onderaan
  slopedLength_m: number;   // planhoogte (v1/v2.3)
  margin_m: number;         // vrije rand (brandstrook/loopstrook)
  rafterSpacing_m: number;  // keperafstand
  rafterOffset_m: number;   // keper-offset vanaf linkerrand
};

export type PanelInput = {
  panelW_m: number;
  panelH_m: number;
  orientation: "portrait" | "landscape";
  gap_m: number;
};

export type MountingInput = {
  railsPerRow: number;       // typisch 2
  railEdgeMargin_m: number;  // rail uitsteek links/rechts t.o.v. veld
  maxHookSpacing_m: number;  // ~1.0m
  maxEndDist_m: number;      // 0.20m
  snapTol_m: number;         // tolerantie om naar dichtste keper te snappen
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
