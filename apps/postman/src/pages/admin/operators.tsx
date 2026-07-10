import React, { useState } from "react";
import { useListUsers, useCreateUser, useSetUserStatus } from "@workspace/api-client-react";
import { Users, Plus, Loader2, ShieldCheck, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";
import { getUser } from '@/lib/auth';

export default function Operators() {
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const officeId = currentUser?.officeIds?.[0] || "";

  const { data: users, isLoading } = useListUsers({ role: "field_operator", officeId });
  const createUser = useCreateUser();
  const setStatus = useSetUserStatus();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "", password: "", fullName: "", role: "field_operator", phone: "", employeeId: "", officeIds: [officeId]
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // @ts-ignore
    createUser.mutate({ data: formData }, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ ...formData, username: "", password: "", fullName: "", phone: "", employeeId: "" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({ role: "field_operator", officeId }) });
      }
    });
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    setStatus.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({ role: "field_operator", officeId }) });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Field Operators</h2>
          <p className="text-muted-foreground">Manage delivery staff for this office.</p>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Operator
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Register Field Operator</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input id="employeeId" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              
              <Button type="submit" className="w-full mt-4" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Register Operator
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users?.map(user => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {user.fullName.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold leading-none">{user.fullName}</h3>
                      <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                  <div className="flex justify-between border-b pb-2">
                    <span>Phone:</span>
                    <span className="font-medium text-foreground">{user.phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span>Employee ID:</span>
                    <span className="font-medium text-foreground">{user.employeeId || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span>Assigned Beat:</span>
                    <span className="font-medium text-foreground">{user.beatId ? "Assigned" : "Unassigned"}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 mt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={user.isActive} 
                      onCheckedChange={(c) => handleToggleStatus(user.id, c)} 
                    />
                    <span className="text-xs font-medium">
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!users || users.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-lg border border-dashed">
              No field operators found. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
