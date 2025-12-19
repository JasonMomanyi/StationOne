import React, { useMemo } from 'react';
import { TraverseLeg, Point } from '../types';

interface SurveyMapProps {
  legs: TraverseLeg[];
  startPoint: Point;
  width?: number;
  height?: number;
}

const SurveyMap: React.FC<SurveyMapProps> = ({ legs, startPoint, width = 600, height = 400 }) => {
  // Calculate bounds to auto-scale the SVG
  const { minE, maxE, minN, maxN } = useMemo(() => {
    let minE = startPoint.easting;
    let maxE = startPoint.easting;
    let minN = startPoint.northing;
    let maxN = startPoint.northing;

    legs.forEach(leg => {
      // Use adjusted if available, else raw
      const e = leg.adjEasting || leg.from.easting + leg.calcDep;
      const n = leg.adjNorthing || leg.from.northing + leg.calcLat;
      
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    });

    // Add padding (10%)
    const spanE = maxE - minE || 10;
    const spanN = maxN - minN || 10;
    const padE = spanE * 0.1;
    const padN = spanN * 0.1;

    return {
      minE: minE - padE,
      maxE: maxE + padE,
      minN: minN - padN,
      maxN: maxN + padN,
    };
  }, [legs, startPoint]);

  const mapToSVG = (e: number, n: number) => {
    const rangeE = maxE - minE;
    const rangeN = maxN - minN;
    
    // Scale preserving aspect ratio? For now stretch to fit.
    // Ideally we want isotropic scaling (same scale for E and N).
    // Let's implement isotropic.
    
    const svgAspect = width / height;
    const dataAspect = rangeE / rangeN;
    
    let scale;
    let offsetX = 0;
    let offsetY = 0;

    if (dataAspect > svgAspect) {
      // Data is wider than screen. Fit width.
      scale = width / rangeE;
      offsetY = (height - (rangeN * scale)) / 2;
    } else {
      // Data is taller. Fit height.
      scale = height / rangeN;
      offsetX = (width - (rangeE * scale)) / 2;
    }

    // Survey coords: N is UP (decrease Y in SVG), E is RIGHT (increase X in SVG)
    const x = (e - minE) * scale + offsetX;
    const y = height - ((n - minN) * scale) - offsetY;

    return { x, y };
  };

  const points = useMemo(() => {
    const pts = [];
    // Start Point
    pts.push({ ...startPoint, ...mapToSVG(startPoint.easting, startPoint.northing) });
    
    // Legs
    legs.forEach(leg => {
      const pt = {
        id: leg.to.id,
        easting: leg.adjEasting,
        northing: leg.adjNorthing,
        ...mapToSVG(leg.adjEasting, leg.adjNorthing)
      };
      pts.push(pt);
    });
    return pts;
  }, [legs, startPoint, minE, maxE, minN, maxN]); // Re-calc if bounds change

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-inner relative overflow-hidden group">
      <div className="absolute top-2 right-2 bg-slate-800/80 px-2 py-1 rounded text-xs text-slate-400 font-mono pointer-events-none">
        Scale: Auto-Fit
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Grid Lines (Optional - could add dynamic grid) */}
        
        {/* Plot Lines */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#4884cc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-lg"
        />

        {/* Plot Points */}
        {points.map((p, idx) => (
          <g key={idx} className="group/point hover:cursor-crosshair">
            <circle cx={p.x} cy={p.y} r="4" fill={idx === 0 ? "#10b981" : "#38bdf8"} stroke="#0f172a" strokeWidth="2" />
            
            {/* Tooltip on hover */}
            <g className="opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none">
              <rect x={p.x + 8} y={p.y - 30} width="120" height="50" rx="4" fill="#1e293b" fillOpacity="0.95" />
              <text x={p.x + 16} y={p.y - 14} fill="#e2e8f0" fontSize="10" fontWeight="bold">{p.id}</text>
              <text x={p.x + 16} y={p.y - 2} fill="#94a3b8" fontSize="9" fontFamily="monospace">E: {p.easting.toFixed(3)}</text>
              <text x={p.x + 16} y={p.y + 10} fill="#94a3b8" fontSize="9" fontFamily="monospace">N: {p.northing.toFixed(3)}</text>
            </g>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 left-2 text-[10px] text-slate-600 font-mono">
        Projection: Plane Grid (No Scaling)
      </div>
    </div>
  );
};

export default SurveyMap;
