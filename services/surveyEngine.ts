/**
 * STATION ONE ENGINE
 * Note: In the production architecture, this module interfaces with the 
 * C++ WASM Core via 'engine_cpp/bindings'. 
 * For this implementation, we use a high-performance TypeScript emulation.
 */

import { Point, Observation, TraverseLeg, TraverseResult, AdjustmentMethod, TraverseType } from '../types';
import { toRadians, normalizeAzimuth, dist3D } from '../utils/math';

export class SurveyEngine {
  
  /**
   * Calculates a traverse with potential side shots.
   * Only observations marked as 'isTraverseLeg' (or all if none marked) are used for misclosure/adjustment.
   * Side shots are computed from the adjusted station coordinates.
   */
  public static calculateTraverse(
    startPoint: Point,
    startAzimuth: number,
    allObservations: Observation[],
    traverseType: TraverseType = 'CLOSED_LOOP',
    endPoint?: Point
  ): TraverseResult {
    // 1. Separate Chain vs Side Shots
    // If no legs are explicitly marked, assume it's a simple chain for backward compatibility
    const hasExplicitLegs = allObservations.some(o => o.isTraverseLeg);
    const chainObs = hasExplicitLegs 
      ? allObservations.filter(o => o.isTraverseLeg)
      : allObservations;

    // 2. Compute the Main Traverse Chain (Bowditch)
    const chainLegs: TraverseLeg[] = [];
    const targetPoint = endPoint || startPoint;
    
    let currentE = startPoint.easting;
    let currentN = startPoint.northing;
    let currentAz = startAzimuth; 
    
    let totalLength = 0;
    const adjustedPointsMap = new Map<string, Point>();
    adjustedPointsMap.set(startPoint.id, startPoint);

    // -- Forward Computation (Unadjusted) --
    for (const obs of chainObs) {
      const legAzimuth = normalizeAzimuth(obs.horizontalAngle);
      
      const dE = obs.horizontalDistance * Math.sin(toRadians(legAzimuth));
      const dN = obs.horizontalDistance * Math.cos(toRadians(legAzimuth));
      
      const legStart: Point = { 
        id: obs.fromPointId, 
        easting: currentE, 
        northing: currentN, 
        isControl: false 
      };

      currentE += dE;
      currentN += dN;
      totalLength += obs.horizontalDistance;

      const legEnd: Point = {
        id: obs.toPointId,
        easting: currentE,
        northing: currentN,
        isControl: false
      };

      chainLegs.push({
        from: legStart,
        to: legEnd,
        obs: obs,
        calcAzimuth: legAzimuth,
        calcLat: dN,
        calcDep: dE,
        adjLat: 0,
        adjDep: 0,
        adjEasting: 0,
        adjNorthing: 0,
        isSideShot: false
      });
    }

    // -- Misclosure Logic --
    // If OPEN traverse, we assume no misclosure (we accept the raw end point)
    let deltaE = 0;
    let deltaN = 0;
    let misclosureDist = 0;
    let misclosureAzimuth = 0;
    let precision = 0;

    if (traverseType === 'CLOSED_LOOP') {
        const calculatedEndE = currentE;
        const calculatedEndN = currentN;
        deltaE = targetPoint.easting - calculatedEndE;
        deltaN = targetPoint.northing - calculatedEndN;
        misclosureDist = Math.sqrt(deltaE*deltaE + deltaN*deltaN);
        misclosureAzimuth = normalizeAzimuth(Math.atan2(deltaE, deltaN) * (180/Math.PI));
        precision = misclosureDist > 0 ? totalLength / misclosureDist : 999999;
    }

    // -- Adjustment (Bowditch) --
    // If OPEN, deltaE/deltaN are 0, so correction is 0, effectively skipping adjustment.
    let accumulatedAdjE = startPoint.easting;
    let accumulatedAdjN = startPoint.northing;

    const adjustedChainLegs = chainLegs.map(leg => {
      const dist = leg.obs.horizontalDistance;
      const corrE = (totalLength > 0 && traverseType === 'CLOSED_LOOP') ? deltaE * (dist / totalLength) : 0;
      const corrN = (totalLength > 0 && traverseType === 'CLOSED_LOOP') ? deltaN * (dist / totalLength) : 0;
      
      const adjLat = leg.calcLat + corrN;
      const adjDep = leg.calcDep + corrE;
      
      accumulatedAdjE += adjDep;
      accumulatedAdjN += adjLat;

      const adjPoint = {
        id: leg.to.id,
        easting: accumulatedAdjE,
        northing: accumulatedAdjN,
        isControl: false
      };
      
      adjustedPointsMap.set(adjPoint.id, adjPoint);

      return {
        ...leg,
        adjLat,
        adjDep,
        adjEasting: accumulatedAdjE,
        adjNorthing: accumulatedAdjN
      };
    });

    // 3. Compute Side Shots (Radiation) based on Adjusted Chain Stations
    const sideLegs: TraverseLeg[] = [];
    const sideObs = hasExplicitLegs ? allObservations.filter(o => !o.isTraverseLeg) : [];

    for (const obs of sideObs) {
      // Find the adjusted coordinates of the station we are observing FROM
      const stationPt = adjustedPointsMap.get(obs.fromPointId);
      
      if (stationPt) {
        const az = normalizeAzimuth(obs.horizontalAngle);
        const dE = obs.horizontalDistance * Math.sin(toRadians(az));
        const dN = obs.horizontalDistance * Math.cos(toRadians(az));
        
        const ptE = stationPt.easting + dE;
        const ptN = stationPt.northing + dN;
        
        adjustedPointsMap.set(obs.toPointId, { id: obs.toPointId, easting: ptE, northing: ptN, isControl: false });

        sideLegs.push({
          from: stationPt,
          to: { id: obs.toPointId, easting: ptE, northing: ptN, isControl: false },
          obs: obs,
          calcAzimuth: az,
          calcLat: dN,
          calcDep: dE,
          adjLat: dN,
          adjDep: dE,
          adjEasting: ptE,
          adjNorthing: ptN,
          isSideShot: true
        });
      }
    }

    return {
      legs: [...adjustedChainLegs, ...sideLegs],
      misclosureDist,
      misclosureAzimuth,
      precision,
      totalLength,
      deltaE,
      deltaN,
      isValid: true,
      adjustedPoints: adjustedPointsMap,
      traverseType
    };
  }

  /**
   * Calculates points based on radiation (side shots) from a single station.
   */
  public static calculateRadiation(
    stationPoint: Point,
    observations: Observation[]
  ): TraverseResult {
    const legs: TraverseLeg[] = [];
    const ptMap = new Map<string, Point>();
    ptMap.set(stationPoint.id, stationPoint);

    observations.forEach(obs => {
      const legAzimuth = normalizeAzimuth(obs.horizontalAngle);
      const dE = obs.horizontalDistance * Math.sin(toRadians(legAzimuth));
      const dN = obs.horizontalDistance * Math.cos(toRadians(legAzimuth));

      const targetE = stationPoint.easting + dE;
      const targetN = stationPoint.northing + dN;

      legs.push({
        from: { ...stationPoint },
        to: { id: obs.toPointId, easting: targetE, northing: targetN, isControl: false },
        obs: obs,
        calcAzimuth: legAzimuth,
        calcLat: dN,
        calcDep: dE,
        adjLat: dN,
        adjDep: dE,
        adjEasting: targetE,
        adjNorthing: targetN,
        isSideShot: true
      });
    });

    return {
      legs,
      misclosureDist: 0,
      misclosureAzimuth: 0,
      precision: 0,
      totalLength: observations.reduce((acc, curr) => acc + curr.horizontalDistance, 0),
      deltaE: 0,
      deltaN: 0,
      isValid: true,
      adjustedPoints: ptMap,
      traverseType: 'OPEN'
    };
  }
}