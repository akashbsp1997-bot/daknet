import React, { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export const customIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export const operatorIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export function ClickableMap({ onMapClick, children, center = [20.5937, 78.9629] as [number, number], zoom = 5, ...props }: any) {
  function MapEvents() {
    useMapEvents({
      click(e) {
        if (onMapClick) onMapClick(e);
      },
    });
    return null;
  }

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 10 }} {...props}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents />
      {children}
    </MapContainer>
  );
}

export function convertGeoJsonToPoints(geoJson: any): [number, number][] {
  if (!geoJson || !geoJson.coordinates || !geoJson.coordinates[0]) return [];
  // GeoJSON is [lng, lat], Leaflet wants [lat, lng]
  return geoJson.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
}

export function convertPointsToGeoJson(points: [number, number][]): any {
  if (points.length < 3) return null;
  // Close the polygon
  const coords = [...points, points[0]].map(p => [p[1], p[0]]);
  return {
    type: "Polygon",
    coordinates: [coords]
  };
}

export { MapContainer, TileLayer, Polygon, Marker, Popup };
