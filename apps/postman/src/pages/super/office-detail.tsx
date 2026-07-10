import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetOffice, useUpdateOffice } from "@workspace/api-client-react";
import { ArrowLeft, MapPin, Save, Trash2, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClickableMap, convertGeoJsonToPoints, convertPointsToGeoJson, Polygon, Marker } from "@/components/MapComponents";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOfficeQueryKey } from "@workspace/api-client-react";

export default function SuperOfficeDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: office, isLoading } = useGetOffice(id);
  const updateOffice = useUpdateOffice();

  const [formData, setFormData] = useState({
    name: "", address: "", district: "", state: "", pincode: "", phone: ""
  });
  
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (office) {
      setFormData({
        name: office.name || "",
        address: office.address || "",
        district: office.district || "",
        state: office.state || "",
        pincode: office.pincode || "",
        phone: office.phone || "",
      });
      if (office.polygonGeoJson) {
        setPolygonPoints(convertGeoJsonToPoints(office.polygonGeoJson));
      }
    }
  }, [office]);

  if (isLoading || !office) {
    return <div className="flex p-12 justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    updateOffice.mutate({ id, data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOfficeQueryKey(id) });
      }
    });
  };

  const handleMapClick = (e: any) => {
    setPolygonPoints([...polygonPoints, [e.latlng.lat, e.latlng.lng]]);
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
  };

  const handleSavePolygon = () => {
    const geoJson = convertPointsToGeoJson(polygonPoints);
    updateOffice.mutate({ id, data: { polygonGeoJson: geoJson || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOfficeQueryKey(id) });
      }
    });
  };

  // calculate center of polygon if exists, else India center
  const center = polygonPoints.length > 0 
    ? polygonPoints[0] 
    : [20.5937, 78.9629] as [number, number];
  const zoom = polygonPoints.length > 0 ? 12 : 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/super/offices")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            {office.name}
          </h2>
          <p className="text-muted-foreground text-sm font-mono">Code: {office.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Office Details</CardTitle>
            <CardDescription>Update general information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Office Name</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Input id="district" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <Button type="submit" className="w-full mt-4" disabled={updateOffice.isPending}>
                {updateOffice.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Details
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-2 overflow-hidden flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4 bg-muted/30">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> 
                Service Boundary
              </CardTitle>
              <CardDescription>Click on map to draw the operational polygon.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearPolygon}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
              <Button size="sm" onClick={handleSavePolygon} disabled={updateOffice.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save Boundary
              </Button>
            </div>
          </CardHeader>
          <div className="flex-1 relative bg-muted z-0">
            <ClickableMap center={center} zoom={zoom} onMapClick={handleMapClick}>
              {polygonPoints.length > 0 && (
                <Polygon positions={polygonPoints} pathOptions={{ color: 'hsl(var(--primary))', fillColor: 'hsl(var(--primary))', fillOpacity: 0.2 }} />
              )}
            </ClickableMap>
            <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur text-xs p-2 rounded-md border shadow-sm z-[1000] pointer-events-none">
              {polygonPoints.length} points
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
