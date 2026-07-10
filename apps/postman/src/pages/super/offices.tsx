import React, { useEffect, useState } from "react";
import { useListOffices, useCreateOffice, useSetOfficeStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Building2, Plus, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { getListOfficesQueryKey } from "@workspace/api-client-react";

export default function SuperOffices() {
  const queryClient = useQueryClient();
  const { data: offices, isLoading } = useListOffices();
  const createOffice = useCreateOffice();
  const setStatus = useSetOfficeStatus();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "", code: "", address: "", district: "", state: "", pincode: "", phone: ""
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createOffice.mutate({ data: formData }, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ name: "", code: "", address: "", district: "", state: "", pincode: "", phone: "" });
        queryClient.invalidateQueries({ queryKey: getListOfficesQueryKey() });
      }
    });
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    setStatus.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOfficesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Post Offices</h2>
          <p className="text-muted-foreground">Manage administrative postal divisions.</p>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Office
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Post Office</SheetTitle>
              <SheetDescription>Register a new postal operating unit.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Office Name</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Office Code</Label>
                <Input id="code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createOffice.isPending}>
                {createOffice.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Office
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offices?.map(office => (
            <Card key={office.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{office.name}</CardTitle>
                  </div>
                  <Badge variant={office.isActive ? "default" : "secondary"}>
                    {office.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-sm font-mono text-muted-foreground mt-1">Code: {office.code}</div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-sm space-y-1 mb-4">
                  <p>{office.district}, {office.state} {office.pincode}</p>
                  <p className="text-muted-foreground">Operators: {office.operatorCount} | Beats: {office.beatCount}</p>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={office.isActive} 
                      onCheckedChange={(c) => handleToggleStatus(office.id, c)} 
                    />
                    <span className="text-xs font-medium">{office.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <Link href={`/super/offices/${office.id}`}>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                      Manage <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
