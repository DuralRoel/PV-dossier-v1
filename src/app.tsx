
import React, { useState } from "react";

export default function App() {
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(5);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>PV Technisch Dossier V1</h2>

      <label>Dakbreedte (m): </label>
      <input type="number" value={width} onChange={e=>setWidth(+e.target.value)} />
      <br/>
      <label>Schuine zijde (m): </label>
      <input type="number" value={height} onChange={e=>setHeight(+e.target.value)} />

      <svg width="800" height="400" style={{ border: "1px solid #ccc", marginTop:20 }}>
        <rect x="50" y="50" width={width*50} height={height*50} fill="none" stroke="black" strokeWidth="2"/>
        <text x="50" y="40">Breedte: {width}m</text>
        <text x={50+width*50} y="40" textAnchor="end">Schuine zijde: {height}m</text>
      </svg>

      <p style={{ marginTop: 20 }}>Werkende basisversie. We bouwen dit verder uit.</p>
    </div>
  );
}
