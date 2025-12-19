import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Observation, Point, TraverseResult, SavedProject, StationSetup, SetupObservation, TraverseType } from '../types';
import { DEFAULT_START_POINT } from '../constants';
import { SurveyEngine } from '../services/surveyEngine';
import { analyzeSurveyData } from '../services/geminiService';
import SurveyMap from '../components/SurveyMap';
import ReactMarkdown from 'react-markdown';
import { parseAngleInput, isValidAngle, decimalToDms, normalizeAzimuth, azimuth2pt, dist3D } from '../utils/math';

type TabView = 'field-book' | 'points' | 'results';
const LS_PROJECTS_KEY = 'station_one_projects';

// --- Component ---

const TraversePage: React.FC = () => {
  // --- STATE ---
  const [activeView, setActiveView] = useState<TabView>('field-book');
  
  // Project Management State
  const [currentProjectMeta, setCurrentProjectMeta] = useState<{id: string, name: string, folder: string} | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'open' | 'save'>('open');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  
  // Inputs for Save Dialog
  const [saveName, setSaveName] = useState('');
  const [saveFolder, setSaveFolder] = useState('Default');

  // Primary Control Point (Start)
  const [startPoint, setStartPoint] = useState<Point>(DEFAULT_START_POINT);
  // Additional Control Points (e.g. Closing points, Reference Objects)
  const [extraControlPoints, setExtraControlPoints] = useState<Point[]>([]);
  
  // Survey Mode State
  const [traverseType, setTraverseType] = useState<TraverseType>('CLOSED_LOOP');
  
  // Quick Add Point State for Points Tab
  const [newPointInput, setNewPointInput] = useState<Partial<Point>>({ id: '', easting: 0, northing: 0, description: '' });

  const [startAzimuth, setStartAzimuth] = useState<string>("0"); // Input string for Start Az
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  
  // File input ref for CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  // File input ref for Project JSON import
  const projectImportRef = useRef<HTMLInputElement>(null);

  // Setup-based State
  const [setups, setSetups] = useState<StationSetup[]>([
    {
      id: 'setup-1',
      stationId: 'STN1',
      observations: [
        { id: 'obs-1', targetId: 'STN2', angleStr: '90 00 00', distStr: '150.450', isTraverseLeg: true },
        { id: 'obs-1b', targetId: 'TREE1', angleStr: '120 30 00', distStr: '45.200', isTraverseLeg: false }
      ]
    },
    {
      id: 'setup-2',
      stationId: 'STN2',
      observations: [
         { id: 'obs-2', targetId: 'STN1', angleStr: '0 00 00', distStr: '150.450', isTraverseLeg: false }, // Backsight check
         { id: 'obs-2b', targetId: 'STN3', angleStr: '175 30 00', distStr: '210.320', isTraverseLeg: true }
      ]
    },
    {
      id: 'setup-3',
      stationId: 'STN3',
      observations: [
         { id: 'obs-3', targetId: 'STN2', angleStr: '0 00 00', distStr: '210.320', isTraverseLeg: false }, // Backsight check
         { id: 'obs-3b', targetId: 'STN4', angleStr: '190 15 00', distStr: '185.500', isTraverseLeg: true }
      ]
    },
    {
      id: 'setup-4',
      stationId: 'STN4',
      observations: [
         { id: 'obs-4', targetId: 'STN1', angleStr: '84 15 00', distStr: '200.100', isTraverseLeg: true }
      ]
    }
  ]);

  const [result, setResult] = useState<TraverseResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // --- PROJECT MANAGEMENT LOGIC ---

  useEffect(() => {
    refreshProjects();
  }, []);

  const refreshProjects = () => {
    try {
      const raw = localStorage.getItem(LS_PROJECTS_KEY);
      if (raw) {
        setSavedProjects(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  };

  const handleSave = useCallback((asNew: boolean = false) => {
    if (asNew || !currentProjectMeta) {
      setSaveName(currentProjectMeta?.name || `Survey ${new Date().toISOString().split('T')[0]}`);
      setSaveFolder(currentProjectMeta?.folder || 'Default');
      setProjectModalMode('save');
      setIsProjectModalOpen(true);
    } else {
      // Overwrite existing
      saveProjectToStorage(currentProjectMeta.id, currentProjectMeta.name, currentProjectMeta.folder);
    }
  }, [currentProjectMeta, savedProjects, startPoint, extraControlPoints, startAzimuth, setups, traverseType]);

  const saveProjectToStorage = (id: string, name: string, folder: string) => {
    const projectData: SavedProject = {
      id,
      name,
      folder,
      lastModified: Date.now(),
      data: {
        startPoint,
        extraControlPoints,
        startAzimuth,
        setups,
        traverseType // Save the type
      }
    };

    const existing = savedProjects.filter(p => p.id !== id);
    const updatedList = [...existing, projectData];
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updatedList));
    setSavedProjects(updatedList);
    setCurrentProjectMeta({ id, name, folder });
    setIsProjectModalOpen(false);
  };

  // Keyboard shortcut for Save
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSave]);

  // --- FIELD BOOK NAVIGATION ---
  
  const getInputId = (sIdx: number, oIdx: number, field: string) => `field-${sIdx}-${oIdx}-${field}`;

  const focusInput = (sIdx: number, oIdx: number, field: string) => {
     const el = document.getElementById(getInputId(sIdx, oIdx, field));
     if (el) {
       el.focus();
     }
  };

  const navigateGrid = (dir: 'up'|'down'|'left'|'right', sIdx: number, oIdx: number, field: 'targetId' | 'angleStr' | 'distStr') => {
      const fields = ['targetId', 'angleStr', 'distStr'] as const;
      const fIdx = fields.indexOf(field);
      
      if (dir === 'left') {
          if (fIdx > 0) focusInput(sIdx, oIdx, fields[fIdx - 1]);
      } else if (dir === 'right') {
          if (fIdx < fields.length - 1) focusInput(sIdx, oIdx, fields[fIdx + 1]);
      } else if (dir === 'up') {
          if (oIdx > 0) {
              focusInput(sIdx, oIdx - 1, field);
          } else if (sIdx > 0) {
              // Go to last obs of prev setup
              const prevSetup = setups[sIdx - 1];
              focusInput(sIdx - 1, prevSetup.observations.length - 1, field);
          }
      } else if (dir === 'down') {
          const currSetup = setups[sIdx];
          if (oIdx < currSetup.observations.length - 1) {
              focusInput(sIdx, oIdx + 1, field);
          } else if (sIdx < setups.length - 1) {
              // Go to first obs of next setup
              focusInput(sIdx + 1, 0, field);
          }
      }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sIdx: number, oIdx: number, field: 'targetId' | 'angleStr' | 'distStr') => {
    if (e.key === 'Enter') {
        e.preventDefault();
        navigateGrid('down', sIdx, oIdx, field);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateGrid('up', sIdx, oIdx, field);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateGrid('down', sIdx, oIdx, field);
    } else if (e.key === 'ArrowLeft') {
         if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
             // Only navigate if cursor is at start
             e.preventDefault();
             navigateGrid('left', sIdx, oIdx, field);
         }
    } else if (e.key === 'ArrowRight') {
         if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
             // Only navigate if cursor is at end
             e.preventDefault();
             navigateGrid('right', sIdx, oIdx, field);
         }
    }
  };

  const confirmSaveAs = () => {
    const id = Date.now().toString(); // New ID for Save As
    saveProjectToStorage(id, saveName, saveFolder);
  };

  const handleLoad = (project: SavedProject) => {
    setStartPoint(project.data.startPoint);
    setExtraControlPoints(project.data.extraControlPoints || []);
    setStartAzimuth(project.data.startAzimuth);
    setSetups(project.data.setups);
    setTraverseType(project.data.traverseType || 'CLOSED_LOOP');
    setCurrentProjectMeta({ id: project.id, name: project.name, folder: project.folder });
    setIsProjectModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      const updated = savedProjects.filter(p => p.id !== id);
      localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updated));
      setSavedProjects(updated);
      if (currentProjectMeta?.id === id) {
        handleNew();
      }
    }
  };

  const handleNew = () => {
    if (window.confirm("Start new project? Unsaved changes will be lost.")) {
      setStartPoint(DEFAULT_START_POINT);
      setExtraControlPoints([]);
      setStartAzimuth("0");
      setSetups([{
        id: Date.now().toString(),
        stationId: 'STN1',
        observations: [{ id: 'obs-1', targetId: '', angleStr: '', distStr: '', isTraverseLeg: true }]
      }]);
      setTraverseType('CLOSED_LOOP');
      setCurrentProjectMeta(null);
      setResult(null);
    }
  };

  const handleExportJSON = (project?: SavedProject) => {
    const p = project || {
      id: 'current',
      name: currentProjectMeta?.name || 'Untitled',
      folder: currentProjectMeta?.folder || 'Default',
      lastModified: Date.now(),
      data: { startPoint, extraControlPoints, startAzimuth, setups, traverseType }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${p.name}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string) as SavedProject;
        if (json.data && json.data.setups) {
           if (window.confirm(`Load project "${json.name}"? Current workspace will be overwritten.`)) {
             const newId = Date.now().toString(); 
             handleLoad({ ...json, id: newId });
           }
        } else {
          alert("Invalid Project File");
        }
      } catch (err) {
        alert("Error parsing JSON");
      }
      if (projectImportRef.current) projectImportRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- ACTIONS ---

  const handleAddSetup = () => {
    const lastSetup = setups[setups.length - 1];
    const lastTraverseLeg = lastSetup.observations.find(o => o.isTraverseLeg);
    const defaultStationId = lastTraverseLeg ? lastTraverseLeg.targetId : `STN${setups.length + 1}`;
    
    const newSetup: StationSetup = {
      id: Date.now().toString(),
      stationId: defaultStationId,
      observations: [
        { 
          id: Date.now().toString() + '_obs', 
          targetId: '', 
          angleStr: '', 
          distStr: '', 
          isTraverseLeg: true 
        }
      ]
    };
    setSetups([...setups, newSetup]);
  };

  const handleRemoveSetup = (idx: number) => {
    if (setups.length > 1) {
      const newSetups = [...setups];
      newSetups.splice(idx, 1);
      setSetups(newSetups);
    }
  };

  const updateSetupStation = (idx: number, val: string) => {
    const newSetups = [...setups];
    newSetups[idx].stationId = val;
    setSetups(newSetups);
  };

  const handleAddObs = (setupIdx: number) => {
    const newSetups = [...setups];
    newSetups[setupIdx].observations.push({
      id: Date.now().toString(),
      targetId: '',
      angleStr: '',
      distStr: '',
      isTraverseLeg: false
    });
    setSetups(newSetups);
  };

  const updateObs = (setupIdx: number, obsIdx: number, field: keyof SetupObservation, val: any) => {
    const newSetups = [...setups];
    newSetups[setupIdx].observations[obsIdx] = {
      ...newSetups[setupIdx].observations[obsIdx],
      [field]: val
    };
    setSetups(newSetups);
  };

  const removeObs = (setupIdx: number, obsIdx: number) => {
    const newSetups = [...setups];
    if (newSetups[setupIdx].observations.length > 1) {
      newSetups[setupIdx].observations.splice(obsIdx, 1);
      setSetups(newSetups);
    }
  };

  // --- CONTROL POINT LOGIC ---

  const allControlPoints = useMemo(() => {
    return [startPoint, ...extraControlPoints];
  }, [startPoint, extraControlPoints]);

  const getControlPoint = (id: string) => {
    if (!id) return undefined;
    return allControlPoints.find(p => p.id.trim().toLowerCase() === id.trim().toLowerCase());
  };

  const addExtraControlPoint = () => {
    setExtraControlPoints([...extraControlPoints, {
      id: `CP${extraControlPoints.length + 1}`,
      easting: 0,
      northing: 0,
      isControl: true,
      fixed: true
    }]);
  };

  const updateExtraControlPoint = (idx: number, field: keyof Point, val: any) => {
    const newPts = [...extraControlPoints];
    newPts[idx] = { ...newPts[idx], [field]: val };
    setExtraControlPoints(newPts);
  };

  const removeExtraControlPoint = (idx: number) => {
    const newPts = [...extraControlPoints];
    newPts.splice(idx, 1);
    setExtraControlPoints(newPts);
  };

  // Add Point Logic for Points Tab
  const handleQuickAddPoint = () => {
    if (!newPointInput.id) return;
    setExtraControlPoints(prev => [...prev, {
      id: newPointInput.id!,
      easting: newPointInput.easting || 0,
      northing: newPointInput.northing || 0,
      elevation: newPointInput.elevation,
      description: newPointInput.description,
      isControl: true,
      fixed: true
    }]);
    setNewPointInput({ id: '', easting: 0, northing: 0, description: '' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const lines = text.split('\n');
        const newPoints: Point[] = [];
        lines.forEach(line => {
          // Expect format: ID, Easting, Northing
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 3) {
            const id = parts[0];
            const e = parseFloat(parts[1]);
            const n = parseFloat(parts[2]);
            if (id && !isNaN(e) && !isNaN(n)) {
               newPoints.push({
                 id,
                 easting: e,
                 northing: n,
                 isControl: true,
                 fixed: true
               });
            }
          }
        });
        
        if (newPoints.length > 0) {
          setExtraControlPoints(prev => [...prev, ...newPoints]);
        }
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportPointsCSV = () => {
    const headers = "ID,Easting,Northing,Elevation,Description,Type\n";
    const rows = unifiedPoints.map(p => 
      `${p.id},${p.easting.toFixed(4)},${p.northing.toFixed(4)},${p.elevation || ''},${p.description || ''},${p.fixed ? 'FIXED' : 'ADJUSTED'}`
    ).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Points_${currentProjectMeta?.name || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // --- CALCULATION LOGIC ---

  useEffect(() => {
    const flatObs: Observation[] = [];
    
    setups.forEach(setup => {
      setup.observations.forEach(obs => {
        const angle = parseAngleInput(obs.angleStr);
        const dist = parseFloat(obs.distStr);
        
        if (setup.stationId && obs.targetId) {
            if (!isNaN(angle) && !isNaN(dist)) {
                flatObs.push({
                    id: obs.id,
                    fromPointId: setup.stationId,
                    toPointId: obs.targetId,
                    horizontalAngle: angle,
                    horizontalDistance: dist,
                    isTraverseLeg: obs.isTraverseLeg
                });
            }
        }
      });
    });

    if (flatObs.length === 0) {
      setResult(null);
      return;
    }

    const startAz = parseAngleInput(startAzimuth) || 0;
    
    // Pass traverseType to engine
    const res = SurveyEngine.calculateTraverse(startPoint, startAz, flatObs, traverseType);
    setResult(res);

  }, [setups, startPoint, startAzimuth, traverseType]); 

  const runAiAnalysis = async () => {
    if (!result) return;
    setAnalyzing(true);
    const analysis = await analyzeSurveyData(result, `Traverse Type: ${traverseType}. Standard Traverse.`);
    setAiAnalysis(analysis);
    setAnalyzing(false);
  };

  // --- REPORT GENERATION HELPERS ---
  const groupedResults = useMemo(() => {
    if (!result) return [];
    
    // Group legs by Station ID
    const groups: { [key: string]: typeof result.legs } = {};
    result.legs.forEach(leg => {
      if (!groups[leg.from.id]) groups[leg.from.id] = [];
      groups[leg.from.id].push(leg);
    });

    return Object.keys(groups).map(stnId => {
       const legs = groups[stnId];
       
       let orientation = 0;
       let refInfo = "";
       let backsightId = "";

       // 1. Determine Orientation of the Setup
       if (stnId === startPoint.id) {
           // Start Station: Orientation is usually defined by user input (Start Azimuth)
           const val = parseAngleInput(startAzimuth);
           orientation = isNaN(val) ? 0 : val;
           refInfo = "Start Az Input";
       } else {
           // Subsequent Stations:
           // Logic: Orientation = Final Bearing(Backsight) - ObservedAngle(Backsight)
           
           // Find the station we came FROM (Backsight Station)
           // We look for a leg in the Result where 'to' is current station
           const incomingLeg = result.legs.find(l => l.to.id === stnId);
           
           if (incomingLeg) {
               backsightId = incomingLeg.from.id;
               
               // A. Calculate FINAL BEARING (Datum) from Current Station -> Backsight Station
               const currCoords = result.adjustedPoints.get(stnId) || incomingLeg.to;
               const bsCoords = result.adjustedPoints.get(backsightId) || incomingLeg.from;
               
               const finalBackBearing = azimuth2pt(
                   currCoords.easting, currCoords.northing,
                   bsCoords.easting, bsCoords.northing
               );

               // B. Find the OBSERVED ANGLE to the Backsight in the current setup's legs
               const bsObservationLeg = legs.find(l => l.to.id === backsightId);
               
               if (bsObservationLeg) {
                   const obsAngle = bsObservationLeg.obs.horizontalAngle;
                   // Rule: Orientation = Final Bearing - Observed Angle
                   orientation = normalizeAzimuth(finalBackBearing - obsAngle);
                   refInfo = `BS: ${backsightId} (Comp)`;
               } else {
                   // Fallback: If no explicit BS observed, assume perfect propagation from previous leg
                   // Previous Forward Azimuth + 180
                   orientation = normalizeAzimuth(incomingLeg.calcAzimuth + 180);
                   refInfo = `BS: ${backsightId} (Prop)`;
               }
           }
       }

       return {
         stationId: stnId,
         orientation: orientation,
         refInfo: refInfo,
         legs: legs
       };
    });
  }, [result, startPoint, startAzimuth]);

  // Sorted Points for Coordinate Register & Points Tab
  const sortedPoints = useMemo(() => {
    if (!result) return [];
    // Sort logic: numeric first (STN1, STN2, STN10), then alphabetical
    return Array.from(result.adjustedPoints.values()).sort((a: Point, b: Point) => {
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [result]);

  // Unified Point List for Points Tab
  const unifiedPoints = useMemo(() => {
    const map = new Map<string, Point>();

    // 1. Add Explicit Control Points
    [startPoint, ...extraControlPoints].forEach(p => map.set(p.id, p));

    // 2. Add/Merge Calculated Points
    // If a point is calculated but also exists as control (fixed), the control definition usually takes precedence 
    // in terms of "fixed" status, but we might want to see the calculated version if we were doing a comparison.
    // For this view, we primarily want to see the "Project Points".
    // If it's fixed, we show the fixed coords. If it's adjusted, we show adjusted.
    if (result) {
       result.adjustedPoints.forEach(p => {
          if (!map.has(p.id)) {
             map.set(p.id, p);
          } else {
             // It exists as control. Ensure we mark it as fixed/control in list if not already
             const existing = map.get(p.id)!;
             if (!existing.fixed) {
                // If the map had it as non-fixed but result says... well, control points input are always fixed.
             }
          }
       });
    }
    
    // Sort
    return Array.from(map.values()).sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

  }, [startPoint, extraControlPoints, result]);


  // Folder Logic
  const folders = useMemo(() => {
    const list = new Set<string>();
    list.add('Default');
    savedProjects.forEach(p => {
       if (p.folder) list.add(p.folder);
    });
    return Array.from(list).sort();
  }, [savedProjects]);

  const [activeFolder, setActiveFolder] = useState('Default');

  return (
    <div className="flex flex-col h-full font-sans relative">

      {/* --- PROJECT MANAGER MODAL --- */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {projectModalMode === 'save' ? 'Save Project' : 'Project Manager'}
              </h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {projectModalMode === 'save' ? (
              <div className="p-8 flex flex-col gap-6 max-w-lg mx-auto w-full">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Project Name</label>
                   <input 
                     value={saveName}
                     onChange={(e) => setSaveName(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-3 text-white focus:border-survey-500 outline-none"
                     placeholder="e.g. Site Survey A"
                     autoFocus
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Folder / Category</label>
                   <div className="relative">
                      <input 
                        value={saveFolder}
                        onChange={(e) => setSaveFolder(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-3 text-white focus:border-survey-500 outline-none"
                        placeholder="Default"
                        list="folder-options"
                      />
                      <datalist id="folder-options">
                        {folders.map(f => <option key={f} value={f} />)}
                      </datalist>
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 mt-4">
                   <button onClick={() => setIsProjectModalOpen(false)} className="px-6 py-2 text-slate-400 hover:text-white">Cancel</button>
                   <button 
                     onClick={confirmSaveAs}
                     className="px-6 py-2 bg-survey-600 hover:bg-survey-500 text-white rounded font-bold"
                   >
                     Save Project
                   </button>
                 </div>
              </div>
            ) : (
              // OPEN / MANAGE MODE
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Folders */}
                <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto">
                   <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Folders</h4>
                   <div className="space-y-1">
                     <button 
                       onClick={() => setActiveFolder('ALL')} 
                       className={`w-full text-left px-3 py-2 rounded text-sm ${activeFolder === 'ALL' ? 'bg-survey-900 text-white' : 'text-slate-400 hover:bg-slate-900'}`}
                     >
                       All Projects
                     </button>
                     {folders.map(f => (
                       <button 
                         key={f}
                         onClick={() => setActiveFolder(f)}
                         className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${activeFolder === f ? 'bg-survey-900 text-white' : 'text-slate-400 hover:bg-slate-900'}`}
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                         {f}
                       </button>
                     ))}
                   </div>
                   
                   <div className="mt-8 pt-6 border-t border-slate-800">
                     <input type="file" ref={projectImportRef} accept=".json" className="hidden" onChange={handleImportJSON} />
                     <button 
                       onClick={() => projectImportRef.current?.click()}
                       className="w-full py-2 border border-dashed border-slate-700 text-slate-500 hover:text-white rounded text-xs uppercase font-bold flex items-center justify-center gap-2"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                       Import JSON
                     </button>
                   </div>
                </div>

                {/* Main List */}
                <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {savedProjects.filter(p => activeFolder === 'ALL' || p.folder === activeFolder).length === 0 && (
                       <div className="col-span-full text-center py-20 text-slate-600">
                         No projects in this folder.
                       </div>
                     )}
                     
                     {savedProjects
                       .filter(p => activeFolder === 'ALL' || p.folder === activeFolder)
                       .sort((a,b) => b.lastModified - a.lastModified)
                       .map(project => (
                       <div key={project.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-survey-500 transition-all group relative">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded bg-survey-900 flex items-center justify-center text-survey-400">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                               </div>
                               <div>
                                 <h5 className="font-bold text-white text-sm truncate max-w-[120px]">{project.name}</h5>
                                 <span className="text-[10px] text-slate-500">{new Date(project.lastModified).toLocaleDateString()}</span>
                               </div>
                             </div>
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={() => handleExportJSON(project)} title="Download JSON" className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                                <button onClick={() => handleDelete(project.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 rounded">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                             </div>
                          </div>
                          <div className="text-[10px] text-slate-500 mb-4 bg-slate-900/50 p-1 rounded">
                            {project.data.setups.length} Setups • Start: {project.data.startPoint.id}
                          </div>
                          <button 
                            onClick={() => handleLoad(project)}
                            className="w-full py-2 bg-survey-600 hover:bg-survey-500 text-white rounded text-xs font-bold"
                          >
                            Open Project
                          </button>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CONTROL POINTS MODAL --- */}
      {isControlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Control & Datum Points
              </h3>
              <button onClick={() => setIsControlModalOpen(false)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-400 mb-6">
                Define known coordinates (Datum) for stations and targets. The app will automatically calculate inverse distances and bearings between these points in the field book.
              </p>

              <div className="space-y-4">
                {/* Start Point (Read Only here mostly, or editable but synced) */}
                <div className="bg-slate-950 border border-blue-900/50 rounded-lg p-4 relative">
                  <div className="absolute top-2 right-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest border border-blue-900 rounded px-1">Start Point</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Point ID</label>
                      <input 
                        value={startPoint.id}
                        onChange={(e) => setStartPoint({...startPoint, id: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Easting</label>
                      <input 
                        type="number"
                        value={startPoint.easting}
                        onChange={(e) => setStartPoint({...startPoint, easting: parseFloat(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Northing</label>
                      <input 
                        type="number"
                        value={startPoint.northing}
                        onChange={(e) => setStartPoint({...startPoint, northing: parseFloat(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Extra Points */}
                {extraControlPoints.map((pt, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 relative group">
                    <button onClick={() => removeExtraControlPoint(idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Point ID</label>
                        <input 
                          value={pt.id}
                          onChange={(e) => updateExtraControlPoint(idx, 'id', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Easting</label>
                        <input 
                          type="number"
                          value={pt.easting}
                          onChange={(e) => updateExtraControlPoint(idx, 'easting', parseFloat(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Northing</label>
                        <input 
                          type="number"
                          value={pt.northing}
                          onChange={(e) => updateExtraControlPoint(idx, 'northing', parseFloat(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex gap-4">
                 <button 
                  onClick={addExtraControlPoint}
                  className="flex-1 py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <span>+</span> Add Control Point
                </button>
                
                <input 
                   type="file" 
                   accept=".csv,.txt" 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 hover:border-slate-500 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                   Import CSV
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2 text-center">CSV Format: ID, Easting, Northing</p>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button 
                onClick={() => setIsControlModalOpen(false)}
                className="px-6 py-2 bg-survey-600 hover:bg-survey-500 text-white rounded font-bold text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* --- TOP BAR: File & Global Settings --- */}
      <div className="bg-slate-900 border-b border-slate-800 shrink-0 z-10">
        
        {/* FILE MENU BAR */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 px-3 border-r border-slate-800 mr-2">
             <div className="w-6 h-6 bg-survey-600 rounded flex items-center justify-center font-bold text-white text-xs">P</div>
             <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Project</span>
               <span className="text-xs font-bold text-white max-w-[150px] truncate">{currentProjectMeta ? currentProjectMeta.name : 'Unsaved Project'}</span>
             </div>
          </div>

          <button onClick={handleNew} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            New
          </button>
          <button onClick={() => { setProjectModalMode('open'); setIsProjectModalOpen(true); }} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            Open...
          </button>
          <button onClick={() => handleSave(false)} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            Save
          </button>
          <button onClick={() => handleSave(true)} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            Save As...
          </button>
           <button onClick={() => handleExportJSON()} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            Export
          </button>
          <div className="h-4 w-px bg-slate-800 mx-2"></div>
           <button onClick={() => setIsControlModalOpen(true)} className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-white hover:bg-emerald-900/30 rounded flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Points
          </button>
        </div>

        {/* INPUTS ROW */}
        <div className="grid grid-cols-12 gap-6 items-end p-6">
          {/* Start Point & Azimuth Inputs */}
          <div className="col-span-12 xl:col-span-8 grid grid-cols-4 gap-4">
            <div>
               <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 block">Start Station</label>
               <input 
                 value={startPoint.id}
                 onChange={(e) => setStartPoint({...startPoint, id: e.target.value})}
                 className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white font-mono focus:border-survey-500 focus:outline-none"
               />
            </div>
            <div>
               <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 block">Easting (m)</label>
               <input 
                 type="number"
                 value={startPoint.easting}
                 onChange={(e) => setStartPoint({...startPoint, easting: parseFloat(e.target.value)})}
                 className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white font-mono focus:border-survey-500 focus:outline-none"
               />
            </div>
            <div>
               <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 block">Northing (m)</label>
               <input 
                 type="number"
                 value={startPoint.northing}
                 onChange={(e) => setStartPoint({...startPoint, northing: parseFloat(e.target.value)})}
                 className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white font-mono focus:border-survey-500 focus:outline-none"
               />
            </div>
            <div className="flex gap-2 items-end">
               <div className="flex-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold text-survey-300 tracking-wider mb-1 block">Start Azimuth</label>
                 <div className="flex gap-2">
                   <input 
                     value={startAzimuth}
                     onChange={(e) => setStartAzimuth(e.target.value)}
                     placeholder="DDD MM SS"
                     className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-survey-300 font-mono focus:border-survey-500 focus:outline-none"
                   />
                   <select
                     value={traverseType}
                     onChange={(e) => setTraverseType(e.target.value as TraverseType)}
                     className="bg-slate-900 border border-slate-700 text-xs text-white rounded-md px-2 focus:outline-none focus:border-survey-500 font-bold"
                     title="Survey Mode"
                   >
                     <option value="CLOSED_LOOP">Closed Loop</option>
                     <option value="OPEN">Open Traverse</option>
                   </select>
                 </div>
               </div>
               <button 
                 onClick={() => setIsControlModalOpen(true)}
                 className="h-[38px] px-3 bg-slate-800 border border-slate-700 rounded-md text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                 title="Manage Datum / Control Points"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
               </button>
            </div>
          </div>

          {/* View Toggles */}
          <div className="col-span-12 xl:col-span-4 flex justify-end">
             <div className="flex bg-slate-950 p-1.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setActiveView('field-book')}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${activeView === 'field-book' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Field Book
                </button>
                 <button
                  onClick={() => setActiveView('points')}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${activeView === 'points' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Points
                </button>
                <button
                  onClick={() => setActiveView('results')}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${activeView === 'results' ? 'bg-survey-600 text-white shadow-lg shadow-survey-900/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Results & Map
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        
        {/* VIEW 1: FIELD BOOK */}
        {activeView === 'field-book' && (
          <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {setups.map((setup, sIdx) => {
              // Check if setup station is a known datum point
              const setupIsDatum = !!getControlPoint(setup.stationId);

              return (
              <div key={setup.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
                <div className="bg-slate-800/50 p-3 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-survey-900 border border-survey-600 flex items-center justify-center text-xs font-mono text-survey-300">
                      {sIdx + 1}
                    </span>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-500 uppercase font-bold leading-none">Occupied Station (@)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          value={setup.stationId}
                          onChange={(e) => updateSetupStation(sIdx, e.target.value)}
                          className="bg-transparent text-white font-bold font-mono focus:outline-none focus:border-b border-survey-500 w-32"
                        />
                        {setupIsDatum && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 text-[9px] border border-blue-800 uppercase font-bold tracking-wider">DATUM</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveSetup(sIdx)} className="text-slate-600 hover:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <div className="p-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/50">
                      <tr>
                        <th className="p-2 w-32">Target Point</th>
                        <th className="p-2 w-32">Angle (DMS)</th>
                        <th className="p-2 w-32">Dist (m)</th>
                        <th className="p-2 w-24 text-center">Next Stn?</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-mono">
                      {setup.observations.map((obs, oIdx) => {
                         const angleValid = isValidAngle(obs.angleStr) || obs.angleStr === '';
                         const distValid = !isNaN(parseFloat(obs.distStr)) && parseFloat(obs.distStr) >= 0 || obs.distStr === '';
                         
                         // Inverse Check
                         const p1 = getControlPoint(setup.stationId);
                         const p2 = getControlPoint(obs.targetId);
                         let datumDist: number | null = null;
                         if (p1 && p2) {
                           datumDist = dist3D(p1.easting, p1.northing, p2.easting, p2.northing);
                         }

                         return (
                          <tr key={obs.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="p-2 align-top">
                              <input 
                                id={getInputId(sIdx, oIdx, 'targetId')}
                                value={obs.targetId} 
                                onChange={(e) => updateObs(sIdx, oIdx, 'targetId', e.target.value)}
                                onKeyDown={(e) => handleFieldKeyDown(e, sIdx, oIdx, 'targetId')}
                                placeholder="Target ID"
                                className="w-full bg-slate-950/50 border border-slate-800 rounded px-2 py-1 focus:border-survey-500 text-white"
                              />
                            </td>
                            <td className="p-2 align-top">
                              <input 
                                id={getInputId(sIdx, oIdx, 'angleStr')}
                                value={obs.angleStr} 
                                onChange={(e) => updateObs(sIdx, oIdx, 'angleStr', e.target.value)}
                                onKeyDown={(e) => handleFieldKeyDown(e, sIdx, oIdx, 'angleStr')}
                                placeholder="DDD MM SS"
                                className={`w-full bg-slate-950/50 border rounded px-2 py-1 ${!angleValid ? 'border-red-500 text-red-200' : 'border-slate-800 focus:border-survey-500 text-survey-200'}`}
                              />
                            </td>
                            <td className="p-2 align-top">
                              <div className="relative">
                                <input 
                                  id={getInputId(sIdx, oIdx, 'distStr')}
                                  type="text"
                                  value={obs.distStr} 
                                  onChange={(e) => updateObs(sIdx, oIdx, 'distStr', e.target.value)}
                                  onKeyDown={(e) => handleFieldKeyDown(e, sIdx, oIdx, 'distStr')}
                                  placeholder="0.000"
                                  className={`w-full bg-slate-950/50 border rounded px-2 py-1 ${!distValid ? 'border-red-500 text-red-200' : 'border-slate-800 focus:border-survey-500 text-emerald-200'}`}
                                />
                                {datumDist !== null && (
                                  <div className="mt-1 flex items-center justify-between text-[10px] text-blue-400 bg-blue-900/10 border border-blue-900/30 rounded px-1.5 py-0.5">
                                    <span>Datum: {datumDist.toFixed(3)}</span>
                                    <button 
                                      onClick={() => updateObs(sIdx, oIdx, 'distStr', datumDist?.toFixed(3))}
                                      className="ml-2 hover:text-white font-bold"
                                      title="Use Datum Distance"
                                    >
                                      USE
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-center align-top pt-3">
                              <input 
                                type="checkbox"
                                checked={obs.isTraverseLeg}
                                onChange={(e) => updateObs(sIdx, oIdx, 'isTraverseLeg', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-survey-600 focus:ring-survey-500"
                              />
                            </td>
                            <td className="p-2 text-center align-top pt-2">
                              <button onClick={() => removeObs(sIdx, oIdx)} className="text-slate-600 hover:text-red-400">×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-900/50 p-2 flex justify-center border-t border-slate-800">
                   <button 
                     onClick={() => handleAddObs(sIdx)}
                     className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-survey-400 hover:text-white hover:bg-survey-600/20 rounded transition-all border border-dashed border-slate-700 hover:border-survey-500"
                   >
                     <span className="text-lg font-bold leading-none">+</span> Add Observation to @{setup.stationId}
                   </button>
                </div>
              </div>
            );
            })}

            <button 
              onClick={handleAddSetup}
              className="w-full py-4 border-2 border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:border-slate-500 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-2"
            >
              <span className="text-2xl">+</span>
              <span className="text-sm font-bold uppercase tracking-wider">Add Next Station Setup</span>
            </button>
          </div>
        )}

        {/* VIEW 2: POINTS MANAGER */}
        {activeView === 'points' && (
          <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-white">Project Points</h2>
              <button onClick={handleExportPointsCSV} className="px-3 py-2 bg-slate-800 text-slate-300 hover:text-white rounded text-xs font-bold flex items-center gap-2 border border-slate-700">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                 Export CSV
              </button>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm font-mono">
                  <thead className="bg-slate-950 text-slate-500 uppercase border-b border-slate-800 text-xs">
                    <tr>
                      <th className="p-4 w-20 text-center">Status</th>
                      <th className="p-4">Point ID</th>
                      <th className="p-4">Easting</th>
                      <th className="p-4">Northing</th>
                      <th className="p-4">Elevation</th>
                      <th className="p-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {unifiedPoints.map((pt) => (
                      <tr key={pt.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-center">
                          {pt.fixed ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 text-[10px] border border-blue-800 font-bold">FIXED</span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 text-[10px] border border-emerald-800 font-bold">ADJ</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-white">{pt.id}</td>
                        <td className="p-4 text-slate-300">{pt.easting.toFixed(4)}</td>
                        <td className="p-4 text-slate-300">{pt.northing.toFixed(4)}</td>
                        <td className="p-4 text-slate-400">{pt.elevation !== undefined ? pt.elevation.toFixed(3) : '-'}</td>
                        <td className="p-4 text-slate-500 italic">{pt.description || ''}</td>
                      </tr>
                    ))}
                    {unifiedPoints.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-600 italic">No points in project. Add setups or import control points.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Add Point Form */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Add Control Point</h3>
               <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Point ID</label>
                    <input 
                      value={newPointInput.id} 
                      onChange={(e) => setNewPointInput({...newPointInput, id: e.target.value})}
                      placeholder="e.g. STN5"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Easting</label>
                    <input 
                      type="number"
                      value={newPointInput.easting} 
                      onChange={(e) => setNewPointInput({...newPointInput, easting: parseFloat(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Northing</label>
                    <input 
                      type="number"
                      value={newPointInput.northing} 
                      onChange={(e) => setNewPointInput({...newPointInput, northing: parseFloat(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white text-sm"
                    />
                  </div>
                   <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Description</label>
                    <input 
                      value={newPointInput.description} 
                      onChange={(e) => setNewPointInput({...newPointInput, description: e.target.value})}
                      placeholder="Optional"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleQuickAddPoint}
                    className="h-[38px] bg-survey-600 hover:bg-survey-500 text-white rounded font-bold text-xs"
                  >
                    ADD POINT
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* VIEW 3: RESULTS & MAP */}
        {activeView === 'results' && (
          <div className="space-y-8 pb-20">
            
            <div className="grid grid-cols-12 gap-8">
               {/* MAP AREA */}
               <div className="col-span-12 lg:col-span-7">
                  <div className="h-[400px] w-full">
                    <SurveyMap legs={result?.legs || []} startPoint={startPoint} height={400} />
                  </div>
               </div>

               {/* STATS AREA */}
               <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
                  
                  {/* Precision & Dist Card */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                     <div className="flex justify-between items-end">
                       <div>
                         <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Linear Precision</p>
                         <p className={`text-3xl font-bold font-mono ${traverseType === 'OPEN' ? 'text-slate-500' : (result && result.precision > 10000 ? 'text-field-success' : 'text-field-warning')}`}>
                           {traverseType === 'OPEN' 
                              ? 'N/A (Open)' 
                              : (result ? `1:${Math.round(result.precision).toLocaleString()}` : '1:--')
                           }
                         </p>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Total Dist</p>
                         <p className="text-3xl font-bold font-mono text-white">
                           {result?.totalLength.toFixed(2) || '0.00'}<span className="text-lg text-slate-500 ml-1">m</span>
                         </p>
                       </div>
                     </div>
                  </div>

                  {/* Misclosure Card */}
                  <div className={`bg-slate-900 border border-slate-700 rounded-lg p-6 ${traverseType === 'OPEN' ? 'opacity-50' : ''}`}>
                     <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Misclosure Vector</p>
                     {traverseType === 'OPEN' ? (
                        <p className="text-sm text-slate-500 italic">Not applicable for Open Traverse</p>
                     ) : (
                       <>
                         <p className="text-2xl font-bold font-mono text-white flex items-baseline gap-2">
                           {result?.misclosureDist.toFixed(4) || '0.0000'}m 
                           <span className="text-sm text-slate-500">@ {result ? decimalToDms(result.misclosureAzimuth) : '0°00\'00"'}</span>
                         </p>
                         <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs font-mono text-slate-400">
                           <div className="flex justify-between"><span>dE:</span> <span>{result?.deltaE.toFixed(4) || '0.0000'}</span></div>
                           <div className="flex justify-between"><span>dN:</span> <span>{result?.deltaN.toFixed(4) || '0.0000'}</span></div>
                         </div>
                       </>
                     )}
                  </div>

                  {/* AI Analysis */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex-1 flex flex-col min-h-[150px]">
                     <div className="flex justify-between items-center mb-4">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Smart Error Analysis</h3>
                       <button 
                         onClick={runAiAnalysis}
                         disabled={analyzing || !result}
                         className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {analyzing ? 'Analyzing...' : 'Analyze'}
                       </button>
                     </div>
                     <div className="flex-1 bg-slate-950/30 rounded border border-slate-800/50 p-3 text-sm text-slate-300 overflow-y-auto max-h-[150px]">
                       {aiAnalysis ? <ReactMarkdown>{aiAnalysis}</ReactMarkdown> : <p className="text-slate-600 italic text-center text-xs mt-2">Run analysis for AI insights.</p>}
                     </div>
                  </div>
               </div>
            </div>

            {/* --- FINAL OUTPUT REPORT TABLE --- */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl mt-8">
               <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Final Field Reduction Report
                  </h3>
                  <div className="flex gap-4">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Adj: {traverseType === 'OPEN' ? 'None (Raw)' : 'Bowditch'}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Proj: Plane</span>
                  </div>
               </div>
               
               <div className="p-6">
                  {/* IF NO DATA */}
                  {(!groupedResults || groupedResults.length === 0) && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg">
                      <p className="text-slate-500 font-mono mb-2">Table is ready.</p>
                      <p className="text-xs text-slate-600">Enter survey data in the "Field Book" tab to populate this report.</p>
                      
                      {/* Placeholder Header to show structure */}
                      <div className="mt-8 overflow-x-auto max-w-4xl mx-auto opacity-50">
                        <table className="w-full text-left text-xs font-mono">
                           <thead className="bg-slate-950 text-slate-500 uppercase border-b border-slate-800">
                             <tr>
                               <th className="p-3">Station</th>
                               <th className="p-3">Target</th>
                               <th className="p-3">Obs Dir</th>
                               <th className="p-3">Orientation</th>
                               <th className="p-3">Fwd Bearing</th>
                               <th className="p-3">Back Bearing</th>
                               <th className="p-3">Final Bearing</th>
                               <th className="p-3">Distance</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr><td colSpan={8} className="p-4 text-center text-slate-700 italic">Waiting for data...</td></tr>
                           </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* DATA TABLE GROUPS */}
                  {groupedResults.map((group, gIdx) => (
                    <div key={gIdx} className="border border-slate-700 rounded-lg overflow-hidden mb-8 shadow-md">
                      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                         <div className="font-mono font-bold text-white flex items-center gap-2">
                           <span className="px-2 py-0.5 rounded bg-survey-900 text-survey-300 text-xs border border-survey-700">STATION</span>
                           @{group.stationId}
                         </div>
                         <div className="text-xs text-slate-400 font-mono">
                            <span className="text-slate-500 mr-2">Reference:</span>
                            {group.refInfo}
                         </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono whitespace-nowrap">
                           <thead className="bg-slate-950 text-slate-500 uppercase border-b border-slate-800">
                             <tr>
                               <th className="p-3 min-w-[100px]">Target Stn</th>
                               <th className="p-3 min-w-[120px]">Observed Dir</th>
                               <th className="p-3 min-w-[120px] text-slate-300">Orientation</th>
                               <th className="p-3 min-w-[120px] text-slate-400">Fwd Bearing</th>
                               <th className="p-3 min-w-[120px] text-slate-400">Back Bearing</th>
                               <th className="p-3 min-w-[120px] text-emerald-500 bg-emerald-950/10">Final Bearing</th>
                               <th className="p-3 min-w-[100px]">Final Dist</th>
                               <th className="p-3 text-right">Adjusted Coords (E, N)</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                             {group.legs.map((leg, lIdx) => {
                               const rawAngle = leg.obs.horizontalAngle;
                               
                               // Calculate Forward Bearing based on Observation + Orientation
                               const computedFwdBearing = normalizeAzimuth(rawAngle + group.orientation);
                               const computedBackBearing = normalizeAzimuth(computedFwdBearing + 180);
                               
                               // Consistent Final Bearing using Adjusted Coordinates
                               const adjFrom = result?.adjustedPoints.get(leg.from.id) || leg.from;
                               const adjTo = result?.adjustedPoints.get(leg.to.id) || leg.to;
                               
                               const finalBearing = azimuth2pt(
                                 adjFrom.easting, adjFrom.northing,
                                 adjTo.easting, adjTo.northing
                               );
                               
                               const finalDist = dist3D(
                                 adjFrom.easting, adjFrom.northing,
                                 adjTo.easting, adjTo.northing
                               );
                               
                               return (
                                 <tr key={lIdx} className="hover:bg-slate-800/80 transition-colors">
                                   <td className="p-3 font-bold text-white border-r border-slate-800">
                                     {leg.to.id} 
                                     {leg.isSideShot && <span className="ml-2 inline-block text-[9px] text-slate-500 font-normal px-1 border border-slate-700 rounded">SS</span>}
                                   </td>
                                   <td className="p-3 text-slate-300">{decimalToDms(rawAngle)}</td>
                                   <td className="p-3 text-slate-400">{decimalToDms(group.orientation)}</td>
                                   <td className="p-3 text-slate-500">{decimalToDms(computedFwdBearing)}</td>
                                   <td className="p-3 text-slate-500">{decimalToDms(computedBackBearing)}</td>
                                   <td className="p-3 text-emerald-400 font-bold bg-emerald-950/10 border-l border-slate-800 border-r">{decimalToDms(finalBearing)}</td>
                                   <td className="p-3 text-white">{finalDist.toFixed(3)}m</td>
                                   <td className="p-3 text-slate-400 text-right">
                                     <span className="mr-2">E: {adjTo.easting.toFixed(3)}</span>
                                     <span>N: {adjTo.northing.toFixed(3)}</span>
                                   </td>
                                 </tr>
                               );
                             })}
                           </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* --- NEW: STATION COORDINATE REGISTER --- */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl mb-12">
               <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    Station Coordinate Register
                  </h3>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                    System: Grid
                  </div>
               </div>
               
               <div className="p-0">
                 {sortedPoints.length === 0 && (
                   <div className="p-8 text-center text-slate-600 text-sm font-mono italic">
                     No stations calculated.
                   </div>
                 )}
                 
                 {sortedPoints.length > 0 && (
                   <table className="w-full text-left text-sm font-mono">
                      <thead className="bg-slate-950 text-slate-500 uppercase border-b border-slate-800 text-xs">
                        <tr>
                          <th className="p-4 w-32">Station ID</th>
                          <th className="p-4 text-emerald-400">Easting (m)</th>
                          <th className="p-4 text-emerald-400">Northing (m)</th>
                          <th className="p-4 w-32 text-center">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900">
                         {sortedPoints.map((pt) => (
                           <tr key={pt.id} className="hover:bg-slate-800/50 transition-colors">
                             <td className="p-4 font-bold text-white">{pt.id}</td>
                             <td className="p-4 text-slate-300">{pt.easting.toFixed(4)}</td>
                             <td className="p-4 text-slate-300">{pt.northing.toFixed(4)}</td>
                             <td className="p-4 text-center">
                               {pt.id === startPoint.id ? (
                                 <span className="px-2 py-1 rounded-full bg-blue-900/30 text-blue-400 text-[10px] border border-blue-800">FIXED</span>
                               ) : (
                                 <span className="px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 text-[10px] border border-emerald-800">ADJUSTED</span>
                               )}
                             </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                 )}
               </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default TraversePage;