import React from "react";
import type { Obstacle, ObstacleType } from "../types";

const TYPES: ObstacleType[] = ["VELUX", "SCHOUW", "DAKDOORVOER", "ANDERS"];

export default function ObstaclesTable(props: {
  obstacles: Obstacle[];
  onChange: (obs: Obstacle[]) => void;
}) {
  const { obstacles, onChange } = props;

  const add = () => {
    const id = `obs${obstacles.length + 1}`;
    onChange([
      ...obstacles,
      { id, type: "VELUX", x_m: 2, y_m: 1, w_m: 0.78, h_m: 1.18, buffer_m: 0.2 },
    ]);
  };

  const update = (i: number, patch: Partial<Obstacle>) => {
    onChange(obstacles.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  };

  const remove = (i: number) => onChange(obstacles.filter((_, idx) => idx !== i));

  return (
    <div className="card">
      <div className="row">
        <h3>Obstakels</h3>
        <button className="btn" onClick={add}>+ Voeg toe</button>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Type</th><th>x</th><th>y</th><th>w</th><th>h</th><th>buffer</th><th></th>
            </tr>
          </thead>
          <tbody>
            {obstacles.map((o, i) => (
              <tr key={o.id}>
                <td><input value={o.id} onChange={e => update(i, { id: e.target.value })} /></td>
                <td>
                  <select value={o.type} onChange={e => update(i, { type: e.target.value as any })}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={o.x_m} onChange={e => update(i, { x_m: +e.target.value })} /></td>
                <td><input type="number" step="0.01" value={o.y_m} onChange={e => update(i, { y_m: +e.target.value })} /></td>
                <td><input type="number" step="0.01" value={o.w_m} onChange={e => update(i, { w_m: +e.target.value })} /></td>
                <td><input type="number" step="0.01" value={o.h_m} onChange={e => update(i, { h_m: +e.target.value })} /></td>
                <td><input type="number" step="0.01" value={o.buffer_m} onChange={e => update(i, { buffer_m: +e.target.value })} /></td>
                <td><button className="btnGhost" onClick={() => remove(i)}>Verwijder</button></td>
              </tr>
            ))}
            {obstacles.length === 0 && (
              <tr><td colSpan={8} className="muted">Geen obstakels toegevoegd.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Coördinaten zijn vanaf linksonder van het dakvlak. Buffer = vrije zone rond obstakel (keep-out).
      </p>
    </div>
  );
}
