import React, { useState, useEffect } from "react";
import { useListBeats, useCreateBeat, useUpdateBeat, useListUsers, useAssignBeat } from "@workspace/api-client-react";
import { Plus, Loader2, MapPin, Search, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListBeatsQueryKey } from "@workspace/api-client-react";
import { getUser } from '@/lib/auth';
import { Badge } from "@/components/ui/badge";
import { ClickableMap, convertGeoJsonToPoints, convertPointsToGeoJson, Polygon } from "@/components/MapComponents";

export default function Beats() {
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const officeId = currentUser?.officeIds?.[0] || "";

  const { data: beats, isLoading } = useListBeats({ officeId });
  const { data: users } = useListUsers({ role: "field_operator", officeId });
  const createBeat = useCreateBeat();
  const updateBeat = useUpdateBeat();
  const assignBeat = useAssignBeat();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", operatorId: "" });

  const [boundaryBeatId, setBoundaryBeatId] = useState<string | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);

  const boundaryBeat = beats?.find(b => b.id === boundaryBeatId) ?? null;

  useEffect(() => {
    if (boundaryBeat) {
      setPolygonPoints(convertGeoJsonToPoints(boundaryBeat.polygonGeoJson));
    }
  }, [boundaryBeatId]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createBeat.mutate({ data: { name: formData.name, officeId, operatorId: formData.operatorId || undefined } }, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ name: "", operatorId: "" });
        queryClient.invalidateQueries({ queryKey: getListBeatsQueryKey({ officeId }) });
      }
    });
  };

  const handleAssign = (beatId: string, operatorId: string) => {
    assignBeat.mutate({ id: beatId, data: { operatorId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBeatsQueryKey({ officeId }) });
      }
    });
  };

  const handleMapClick = (e: any) => {
    setPolygonPoints(points => [...points, [e.latlng.lat, e.latlng.lng]]);
  };

  const clearPolygon = () => setPolygonPoints([]);

  const handleSavePolygon = () => {
    if (!boundaryBeatId) return;
    const geoJson = convertPointsToGeoJson(polygonPoints);
    updateBeat.mutate({ id: boundaryBeatId, data: { polygonGeoJson: geoJson ?? undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBeatsQueryKey({ officeId }) });
        setBoundaryBeatId(null);
      }
    });
  };

  const mapCenter = polygonPoints.length > 0 ? polygonPoints[0] : [20.5937, 78.9629] as [number, number];
  const mapZoom = polygonPoints.length > 0 ? 14 : 5;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Delivery Beats</h2>
          <p className="text-muted-foreground">Manage geographical delivery zones.</p>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Beat
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[450px]">
            <SheetHeader>
              <SheetTitle>New Beat</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Beat Name / Number</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Beat-01 Central" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operator">Assign Operator (Optional)</Label>
                <Select value={formData.operatorId} onValueChange={v => setFormData({...formData, operatorId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Leave Unassigned</SelectItem>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={createBeat.isPending}>
                {createBeat.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Beat
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {beats?.map(beat => (
            <Card key={beat.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">{beat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {beat.addressCount} addresses
                      </p>
                    </div>
                  </div>
                  <Badge variant={beat.isActive ? "default" : "secondary"}>
                    {beat.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-3 mt-4 pt-4 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assigned Operator</Label>
                    <Select value={beat.operatorId || "unassigned"} onValueChange={(v) => handleAssign(beat.id, v === "unassigned" ? "" : v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setBoundaryBeatId(beat.id)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    {beat.polygonGeoJson ? "Edit Boundary" : "Draw Boundary"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!beats || beats.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-lg border border-dashed">
              No beats configured. Create beats to organize delivery areas.
            </div>
          )}
        </div>
      )}

      <Sheet open={!!boundaryBeatId} onOpenChange={(v) => { if (!v) setBoundaryBeatId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader>
            <SheetTitle>{boundaryBeat ? `${boundaryBeat.name} — Boundary` : "Boundary"}</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={clearPolygon}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear
            </Button>
            <Button size="sm" onClick={handleSavePolygon} disabled={updateBeat.isPending}>
              {updateBeat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Boundary
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{polygonPoints.length} points</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Tap the map to place each corner of this beat's zone.</p>
          <div className="flex-1 relative bg-muted rounded-md overflow-hidden mt-2 min-h-[400px] z-0">
            {boundaryBeatId && (
              <ClickableMap center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick}>
                {polygonPoints.length > 0 && (
                  <Polygon positions={polygonPoints} pathOptions={{ color: 'hsl(var(--secondary))', fillColor: 'hsl(var(--secondary))', fillOpacity: 0.25 }} />
                )}
              </ClickableMap>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
