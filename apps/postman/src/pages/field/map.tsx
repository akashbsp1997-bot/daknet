import React, { useEffect, useState } from "react";
import { useGetDailyReport, useListBeats, useGetOffice } from "@workspace/api-client-react";
import { Loader2, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClickableMap, Polygon, Marker, Popup, convertGeoJsonToPoints, customIcon } from "@/components/MapComponents";
import { getUser } from '@/lib/auth';

export default function FieldMap() {
  const user = getUser();
  const operatorId = user?.id || "";
  const officeId = user?.officeIds?.[0] || "";

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        console.error,
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const { data: report, isLoading: isLoadingReport } = useGetDailyReport(
    { officeId, operatorId, date: new Date().toISOString().split('T')[0] },
    { query: { enabled: !!officeId && !!operatorId } }
  );

  const { data: beats } = useListBeats({ officeId }, { query: { enabled: !!officeId } });
  const { data: office } = useGetOffice(officeId, { query: { enabled: !!officeId } });

  const assignedBeat = beats?.find(b => b.id === user?.beatId);
  const beatPolygon = assignedBeat?.polygonGeoJson ? convertGeoJsonToPoints(assignedBeat.polygonGeoJson) : [];
  const officePolygon = office?.polygonGeoJson ? convertGeoJsonToPoints(office.polygonGeoJson) : [];

  const center: [number, number] = currentLocation || (beatPolygon.length > 0 ? beatPolygon[0] : [20.5937, 78.9629]);
  const zoom = currentLocation || beatPolygon.length > 0 ? 15 : 5;

  if (isLoadingReport) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col pt-14 pb-16 fixed inset-0 w-full z-0">
      <div className="absolute top-16 left-4 z-[1000] pointer-events-none">
        <h2 className="text-lg font-bold bg-background/80 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm">My Beat Map</h2>
      </div>

      <div className="flex-1 bg-muted relative z-0">
        <ClickableMap center={center} zoom={zoom} zoomControl={false}>
          {/* Office Boundary */}
          {officePolygon.length > 0 && (
            <Polygon 
              positions={officePolygon} 
              pathOptions={{ color: 'hsl(var(--primary))', fillOpacity: 0, weight: 2, dashArray: '5, 10' }} 
            />
          )}

          {/* Beat Boundary */}
          {beatPolygon.length > 0 && (
            <Polygon 
              positions={beatPolygon} 
              pathOptions={{ color: 'hsl(var(--chart-2))', fillOpacity: 0.1, weight: 2 }} 
            />
          )}

          {/* Current Location */}
          {currentLocation && (
            <Marker position={currentLocation} icon={customIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {/* Visited Route/Points */}
          {report?.gpsRoute && report.gpsRoute.length > 0 && report.gpsRoute.map((pt, i) => (
            <Marker key={i} position={[pt[0], pt[1]] as [number, number]} icon={customIcon}>
              <Popup>Visit #{i + 1}</Popup>
            </Marker>
          ))}
        </ClickableMap>
      </div>

      <div className="absolute bottom-20 left-4 right-4 z-[1000] flex gap-2">
        <Card className="flex-1 bg-background/90 backdrop-blur shadow-lg border-primary/20">
          <div className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assigned Beat</p>
              <p className="font-bold text-sm truncate">{assignedBeat?.name || "Unassigned"}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
