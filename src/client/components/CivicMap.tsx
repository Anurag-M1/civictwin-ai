import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
// Fix Leaflet's default marker icons in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CivicMapProps {
  hotspots: any[];
  assets?: any[];
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string) => void;
  height?: string;
}

// Controller component to smoothly pan/zoom when selectedHotspotId changes
const MapViewController: React.FC<{ selectedHotspot: any }> = ({ selectedHotspot }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedHotspot && selectedHotspot.centerLat && selectedHotspot.centerLng) {
      map.flyTo([selectedHotspot.centerLat, selectedHotspot.centerLng], 13, {
        duration: 1.2,
      });
    }
  }, [selectedHotspot, map]);
  return null;
};

export const CivicMap: React.FC<CivicMapProps> = ({
  hotspots,
  assets = [],
  selectedHotspotId,
  onSelectHotspot,
  height = '340px',
}) => {
  const selectedHotspot = hotspots.find((h) => h.id === selectedHotspotId) || hotspots[0];

  // Default center: Bengaluru or selected hotspot
  const defaultCenter: [number, number] = selectedHotspot?.centerLat && selectedHotspot?.centerLng
    ? [selectedHotspot.centerLat, selectedHotspot.centerLng]
    : [20.5937, 78.9629]; // Pan-India center
  const defaultZoom = selectedHotspot ? 11 : 5;

  const getPriorityColor = (score: number) => {
    if (score >= 80) return '#b91c1c'; // Critical (Crimson)
    if (score >= 60) return '#d97706'; // High (Amber)
    return '#2563eb'; // Medium (Blue)
  };

  const getAssetColor = (condition: string) => {
    switch (condition) {
      case 'CRITICAL':
        return '#dc2626';
      case 'POOR':
        return '#ea580c';
      case 'FAIR':
        return '#ca8a04';
      case 'GOOD':
      case 'EXCELLENT':
        return '#16a34a';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '4px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <MapViewController selectedHotspot={selectedHotspot} />

        {/* Clean CartoDB Positron / OSM Basemap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Hotspots Overlays */}
        {hotspots.map((h) => {
          if (!h.centerLat || !h.centerLng) return null;
          const isSelected = h.id === selectedHotspotId;
          const color = getPriorityColor(h.prioritySignalScore);

          return (
            <CircleMarker
              key={h.id}
              center={[h.centerLat, h.centerLng]}
              radius={isSelected ? 18 : 13}
              pathOptions={{
                color: isSelected ? '#0f172a' : color,
                weight: isSelected ? 3 : 1.5,
                fillColor: color,
                fillOpacity: isSelected ? 0.85 : 0.6,
              }}
              eventHandlers={{
                click: () => onSelectHotspot(h.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                  {h.hotspotCode} • {h.category}
                  <div style={{ color: getPriorityColor(h.prioritySignalScore), fontWeight: 700 }}>
                    Priority: {h.prioritySignalScore.toFixed(1)}/100
                  </div>
                </div>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: '180px', padding: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>
                    {h.hotspotCode}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    {h.administrativeArea?.name} ({h.administrativeArea?.stateCode})
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <span className="gov-badge badge-medium">{h.category}</span>
                    <span
                      className={`gov-badge ${
                        h.prioritySignalScore >= 80 ? 'badge-critical' : 'badge-high'
                      }`}
                    >
                      Score: {h.prioritySignalScore.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#334155' }}>
                    Citizen Signals: <strong>{h.requestCount}</strong><br />
                    Pop. Signal: <strong>{h.affectedPopulationSignal?.toLocaleString()}</strong><br />
                    Confidence: <strong>{(h.confidenceScore * 100).toFixed(0)}%</strong>
                  </div>
                  <button
                    onClick={() => onSelectHotspot(h.id)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: '#1b3558',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  >
                    Inspect Hotspot Dossier
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Physical Infrastructure Assets Pins */}
        {assets.map((asset) => {
          const lat = asset.location?.latitude;
          const lng = asset.location?.longitude;
          if (!lat || !lng) return null;

          const color = getAssetColor(asset.conditionRating);

          return (
            <CircleMarker
              key={asset.id}
              center={[lat, lng]}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: color,
                fillOpacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -5]}>
                <div style={{ fontSize: '11px' }}>
                  <strong>{asset.name}</strong> ({asset.type})<br />
                  Condition: <span style={{ color, fontWeight: 700 }}>{asset.conditionRating}</span>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          padding: '6px 10px',
          borderRadius: '3px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          fontSize: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>GIS Risk Layer</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#b91c1c' }} />
          <span>Priority &ge; 80 (Critical)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }} />
          <span>Priority 60-79 (High)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
          <span>Priority &lt; 60 (Medium)</span>
        </div>
      </div>
    </div>
  );
};
