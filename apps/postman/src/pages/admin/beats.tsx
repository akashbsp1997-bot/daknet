import React, { useState } from "react";
import { useListBeats, useCreateBeat, useUpdateBeat, useListUsers, useAssignBeat } from "@workspace/api-client-react";
import { Plus, Loader2, MapPin, Search } from "lucide-react";
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
    </div>
  );
}
