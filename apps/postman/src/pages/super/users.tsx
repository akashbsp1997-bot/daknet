import React, { useState } from "react";
import { useListUsers, useCreateUser, useSetUserStatus, useListOffices, useAssignOfficesToUser } from "@workspace/api-client-react";
import { Users, Plus, Loader2, ShieldCheck, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";

export default function SuperUsers() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const { data: offices } = useListOffices();
  
  const createUser = useCreateUser();
  const setStatus = useSetUserStatus();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "", password: "", fullName: "", role: "office_admin", phone: "", employeeId: "", officeId: ""
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, officeIds: formData.officeId ? [formData.officeId] : [] };
    // @ts-ignore - typing expects UserRole literal
    createUser.mutate({ data: payload }, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ username: "", password: "", fullName: "", role: "office_admin", phone: "", employeeId: "", officeId: "" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    setStatus.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Users</h2>
          <p className="text-muted-foreground">Manage admins and operators globally.</p>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New User
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create User</SheetTitle>
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
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office_admin">Office Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="field_operator">Field Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.role !== "super_admin" && (
                <div className="space-y-2">
                  <Label htmlFor="office">Assign Office</Label>
                  <Select value={formData.officeId} onValueChange={(v) => setFormData({...formData, officeId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID (opt)</Label>
                  <Input id="employeeId" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (opt)</Label>
                  <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              
              <Button type="submit" className="w-full mt-4" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users?.map(user => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold leading-none">{user.fullName}</h3>
                      <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    user.role === 'super_admin' ? 'bg-primary/10 text-primary border-primary/20' : 
                    user.role === 'office_admin' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : ''
                  }>
                    {user.role.replace('_', ' ')}
                  </Badge>
                </div>
                
                {user.officeIds && user.officeIds.length > 0 && (
                  <div className="text-sm flex items-center gap-1.5 text-muted-foreground mb-4 bg-muted/50 p-2 rounded-md">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">
                      {offices?.find(o => o.id === user.officeIds[0])?.name || "Assigned to office"}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={user.isActive} 
                      onCheckedChange={(c) => handleToggleStatus(user.id, c)} 
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {user.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  
                  {user.employeeId && <div className="text-xs font-mono">{user.employeeId}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
