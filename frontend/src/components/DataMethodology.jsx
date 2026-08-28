import React from 'react';
import { Database, Globe, Compass, Radio } from 'lucide-react';

export const DataMethodology = ({ summary }) => {
  return (
    <section id="methodology" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Data &amp; Ingestion Standards</div>
        <h2 className="section-title">
          Data Sources &amp; <span className="text-cyan">Geospatial Methodology</span>
        </h2>
        <p className="section-subtitle">
          How satellite infrared measurements and global open spatial data are ingested, cleaned, and synthesized.
        </p>
      </div>

      <div className="methodology-grid">
        <div className="methodology-card">
          <div className="meth-header">
            <Radio size={20} className="text-cyan" />
            <h3 className="meth-title">NASA FIRMS Satellite Feeds</h3>
          </div>
          <p className="meth-desc">
            Ingests Near Real-Time (NRT) thermal anomaly products from <strong>VIIRS (Suomi-NPP / NOAA-20 at 375m resolution)</strong> and <strong>MODIS (Terra / Aqua at 1km resolution)</strong>.
          </p>
          <ul className="meth-bullets">
            <li><strong>Channel I4 / Brightness:</strong> 3.74 &mu;m infrared band capturing hot combustion thermal radiance.</li>
            <li><strong>Fire Radiative Power (MW):</strong> Quantitative physical rate of radiant heat energy release.</li>
            <li><strong>Natural-Key Deduplication:</strong> Prevents duplicate entries on repeated satellite passes.</li>
          </ul>
        </div>

        <div className="methodology-card">
          <div className="meth-header">
            <Globe size={20} className="text-cyan" />
            <h3 className="meth-title">OpenStreetMap Overpass Geometries</h3>
          </div>
          <p className="meth-desc">
            Directly extracts vector boundary polygons for industrial estates, petrochemical zones, and oil storage facilities across the Gujarat Industrial Corridor <code>[69.0&deg;E to 74.0&deg;E, 20.0&deg;N to 24.5&deg;N]</code>.
          </p>
          <ul className="meth-bullets">
            <li><strong>Feature Queries:</strong> <code>landuse=industrial</code>, <code>industrial=*</code>, <code>man_made=flare</code>.</li>
            <li><strong>Geodesic Boundary Calculation:</strong> Exact Haversine distance in meters to the nearest polygon edge.</li>
            <li><strong>Resilient Local Caching:</strong> Multi-mirror fallback ensures 100% offline availability.</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default DataMethodology;
