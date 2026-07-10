import React, { useEffect, useState } from "react";
import { useListOperatorLocations, useGetOffice, useListBeats } from "@workspace/api-client-react";
import { Loader2, Map as MapIcon, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClickableMap, Polygon, Marker, Popup, convertGeoJsonToPoints, customIcon, operatorIcon } from "@/components/MapComponents";
import { getUser } from '@/lib/auth';

export default function AdminMap() {
  const officeId = getUser()?.officeIds?.[0] || "";

  const { data: office, isLoading: isLoadingOffice } = useGetOffice(officeId, { query: { enabled: !!officeId } });
  const { data: locations, isLoading: isLoadingLocs } = useListOperatorLocations({ officeId }, { query: { refetchInterval: 30000, enabled: !!officeId } });
  const { data: beats } = useListBeats({ officeId }, { query: { enabled: !!officeId } });

  const officePolygon = office?.polygonGeoJson ? convertGeoJsonToPoints(office.polygonGeoJson) : [];

  const center: [number, number] = officePolygon.length > 0 ? officePolygon[0] : [20.5937, 78.9629];
  const zoom = officePolygon.length > 0 ? 13 : 5;

  if (isLoadingOffice || isLoadingLocs) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Operations Map</h2>
          <p className="text-muted-foreground">Track operator locations in real-time.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Online
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="w-3 h-3 rounded-full bg-muted-foreground"></div> Offline
          </div>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden relative z-0">
        <ClickableMap center={center} zoom={zoom}>
          {/* Office Boundary */}
          {officePolygon.length > 0 && (
            <Polygon 
              positions={officePolygon} 
              pathOptions={{ color: 'hsl(var(--primary))', fillOpacity: 0.05, weight: 2 }} 
            />
          )}

          {/* Beat Boundaries */}
          {beats?.filter(b => b.polygonGeoJson).map(beat => {
            const points = convertGeoJsonToPoints(beat.polygonGeoJson);
            return (
              <Polygon 
                key={beat.id}
                positions={points} 
                pathOptions={{ color: 'hsl(var(--chart-2))', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' }} 
              >
                <Popup>{beat.name}</Popup>
              </Polygon>
            );
          })}

          {/* Operator Locations */}
          {locations?.map(loc => (
            <Marker 
              key={loc.operatorId} 
              position={[loc.gpsLat, loc.gpsLng]}
              icon={operatorIcon}
            >
              <Popup className="min-w-[150px]">
                <div className="font-sans">
                  <h4 className="font-bold flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${loc.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                    {loc.operatorName}
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {loc.batteryLevel !== undefined && <p>Battery: {loc.batteryLevel}%</p>}
                    <p>Last seen: {new Date(loc.lastSeen).toLocaleTimeString()}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </ClickableMap>
      </Card>
    </div>
  );
}
