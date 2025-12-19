export enum SurveyMode {
  TRAVERSE = 'TRAVERSE',
  CONTROL_NETWORK = 'CONTROL_NETWORK',
  POINT_DETERMINATION = 'POINT_DETERMINATION'
}

export type TraverseType = 'CLOSED_LOOP' | 'OPEN';

export enum AngleFormat {
  DMS = 'DMS',
  DECIMAL = 'DECIMAL',
  GRADS = 'GRADS'
}

export enum AdjustmentMethod {
  BOWDITCH = 'BOWDITCH',
  TRANSIT = 'TRANSIT',
  LEAST_SQUARES = 'LEAST_SQUARES'
}

export interface Point {
  id: string;
  easting: number;
  northing: number;
  elevation?: number;
  isControl: boolean;
  description?: string;
  fixed?: boolean;
}

export interface Observation {
  id: string;
  fromPointId: string;
  toPointId: string;
  horizontalAngle: number; // Stored as decimal degrees internally
  horizontalDistance: number;
  verticalAngle?: number;
  targetHeight?: number;
  instrumentHeight?: number;
  isTraverseLeg?: boolean; // Determines if this obs is part of the main chain
}

export interface SetupObservation {
  id: string;
  targetId: string;
  angleStr: string;
  distStr: string;
  isTraverseLeg: boolean;
}

export interface StationSetup {
  id: string;
  stationId: string; // The occupied station
  observations: SetupObservation[];
}

export interface TraverseLeg {
  from: Point;
  to: Point;
  obs: Observation;
  calcAzimuth: number;
  calcLat: number; // dN
  calcDep: number; // dE
  adjLat: number;
  adjDep: number;
  adjEasting: number;
  adjNorthing: number;
  isSideShot?: boolean;
}

export interface TraverseResult {
  legs: TraverseLeg[];
  misclosureDist: number;
  misclosureAzimuth: number;
  precision: number; // 1:X
  totalLength: number;
  deltaE: number;
  deltaN: number;
  isValid: boolean;
  adjustedPoints: Map<string, Point>; // Helper for fast lookups
  traverseType: TraverseType;
}

export interface ProjectMetadata {
  name: string;
  surveyor: string;
  date: string;
  projection: string;
  units: 'METERS' | 'FEET';
}

export interface SavedProject {
  id: string;
  name: string;
  folder: string;
  lastModified: number;
  data: {
    startPoint: Point;
    extraControlPoints: Point[];
    startAzimuth: string;
    setups: StationSetup[];
    traverseType?: TraverseType;
  }
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  relatedTool?: string;
}