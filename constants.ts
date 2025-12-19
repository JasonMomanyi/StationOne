import { AngleFormat } from './types';

export const APP_NAME = "Station One";
export const APP_VERSION = "0.9.0 Beta";

export const DEFAULT_START_POINT = {
  id: 'STN1',
  easting: 500000.000,
  northing: 2000000.000,
  isControl: true,
  fixed: true
};

export const MOCK_TRAVERSE_DATA = [
  { id: '1', from: 'STN1', to: 'STN2', angle: 90.0000, dist: 150.450 },
  { id: '2', from: 'STN2', to: 'STN3', angle: 175.3000, dist: 210.320 },
  { id: '3', from: 'STN3', to: 'STN4', angle: 190.1500, dist: 185.500 },
  { id: '4', from: 'STN4', to: 'STN1', angle: 84.1500, dist: 200.100 }, // Approx closure
];

export const AI_SYSTEM_INSTRUCTION = `You are the Station One Field Intelligence Assistant, a senior surveying expert. 
Your goal is to assist surveyors with field procedures, error analysis, and traverse geometry validation.
Always be concise, professional, and safety-conscious.
If the user presents a survey misclosure, analyze if it meets standard traverse specifications (e.g., 1:10,000 for standard engineering works).
Provide advice on:
1. Instrument Setup
2. Atmospheric corrections
3. Geometry checks (Strength of Figure)
4. Blunder detection`;
