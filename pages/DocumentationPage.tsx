import React from 'react';

const DocumentationPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Station One Field Guide</h1>
        <p className="text-slate-400">Comprehensive Operating Procedures & Computation Guide</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">1</span>
          Safety & Preparation
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300 space-y-4">
          <p>Before commencing any survey operations, ensure standard PPE is worn (High-vis vest, safety boots). Check equipment calibration status.</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Ensure battery levels are > 80% for Total Stations.</li>
            <li>Acquire known control point coordinates (E, N, Z).</li>
            <li>Plan the traverse route to avoid obstacles and ensure Line of Sight (LoS).</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
           <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">2</span>
           Traverse Surveying (Step-by-Step)
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300 space-y-4">
          <h3 className="font-bold text-white">A. Field Procedure</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong className="text-white">Setup at Start Point (STN1):</strong> Center and level the instrument over the known control point. Measure Instrument Height (HI).</li>
            <li><strong className="text-white">Orientation:</strong> Backsight to a known reference object (RO) or Magnetic North to establish the initial azimuth.</li>
            <li><strong className="text-white">Observation:</strong> Measure Horizontal Angle and Horizontal Distance to the next station (STN2). Record in field book.</li>
            <li><strong className="text-white">Move Ahead:</strong> Move instrument to STN2. Backsight STN1. Foresight STN3. Repeat until closing onto STN1 or another known control point.</li>
          </ol>
          
          <h3 className="font-bold text-white mt-4">B. Using Station One App</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Select <strong>Traverse Mode</strong> in the top toggle.</li>
            <li>Enter the <strong>Start Point Coordinates</strong> in the top left panel.</li>
            <li>Input observations row by row.
              <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-emerald-400">
                 TIP: You can enter angles as "120 30 15" (DMS) or "120.504" (Decimal). 
                 The system automatically converts them.
              </div>
            </li>
            <li>The <strong>Misclosure</strong> and <strong>Precision</strong> (e.g., 1:50,000) update automatically.</li>
            <li>If precision is acceptable (> 1:10,000), use the Adjusted Coordinates for drafting.</li>
          </ul>
        </div>
      </section>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
           <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">3</span>
           Control Points & Datum Calculations
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300 space-y-4">
          <p>
            The app allows you to define multiple <strong>Control (Datum) Points</strong>. This is essential for detecting known points in the field and automatically calculating inverse distances.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Click the icon next to the <strong>Start Azimuth</strong> input to open the <strong>Control Point Manager</strong>.</li>
            <li>Add coordinates for any known stations (e.g., Backsights, Closing Stations).</li>
            <li>In the Field Book, if both the Occupied Station and the Target Point match a known Control Point ID:
                <ul className="list-disc pl-5 mt-1 text-slate-400">
                    <li>The system detects the match.</li>
                    <li>The <strong>Datum Distance</strong> is calculated automatically.</li>
                    <li>A "USE" button appears, allowing you to quickly populate the distance field with the calculated value.</li>
                </ul>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
           <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">4</span>
           Radiation / Side Shots
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300 space-y-4">
          <p>Used for detailing features (trees, corners, poles) from a single setup.</p>
          <ol className="list-decimal pl-5 space-y-2">
             <li>Switch the App Mode to <strong>Radiation (Radial)</strong>.</li>
             <li>Define your occupied station coordinates.</li>
             <li>Enter the target ID (e.g., T1, T2) and the Azimuth/Distance to each.</li>
             <li>The app calculates coordinates for all targets simultaneously based on the single station setup.</li>
          </ol>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
           <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">5</span>
           Coordinate & Bearing Derivation
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300 space-y-4">
          <h3 className="font-bold text-white">Inverse Computation</h3>
          <p>
            The <strong>Final Bearing</strong> displayed in the Field Reduction Report is computed mathematically using the final adjusted coordinates of the <em>From</em> and <em>To</em> stations. This provides a geometric check on the traverse.
          </p>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded font-mono text-xs space-y-2">
            <p className="text-emerald-400">// Algorithm used (azimuth2pt):</p>
            <p>dE = Easting_To - Easting_From</p>
            <p>dN = Northing_To - Northing_From</p>
            <p className="text-blue-300">Bearing = atan2(dE, dN)</p>
            <p className="text-slate-500">// Returns angle relative to North (Y-axis)</p>
          </div>
          <p>
            The <strong>Station Coordinate Register</strong> table (located below the Field Report) provides the final adjusted Northings and Eastings for all calculated points, including side shots.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-survey-400 flex items-center gap-2">
           <span className="w-6 h-6 rounded bg-survey-900 border border-survey-700 flex items-center justify-center text-xs">6</span>
           Troubleshooting
        </h2>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
               <span className="text-red-400 font-bold">!</span>
               <span><strong>Input Error:</strong> If a field turns red, check for negative distances or invalid angle formats (Minutes/Seconds must be &lt; 60).</span>
            </li>
            <li className="flex items-start gap-2">
               <span className="text-red-400 font-bold">!</span>
               <span><strong>Poor Precision:</strong> If precision is &lt; 1:5000, check for gross errors in distance measurement or angle reading (e.g., transposing digits). Use the Gemini AI Assistant to help diagnose.</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DocumentationPage;