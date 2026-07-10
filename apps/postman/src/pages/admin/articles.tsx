import React, { useState } from "react";
import { useListArticles, useCreateArticle, useListUsers } from "@workspace/api-client-react";
import { Plus, Loader2, Package, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { getListArticlesQueryKey } from "@workspace/api-client-react";
import { getUser } from '@/lib/auth';

export default function Articles() {
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const officeId = currentUser?.officeIds?.[0] || "";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: articles, isLoading } = useListArticles({ 
    officeId, 
    status: statusFilter === "all" ? undefined : statusFilter as any,
    date: dateFilter
  });
  const { data: users } = useListUsers({ role: "field_operator", officeId });
  const createArticle = useCreateArticle();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    barcode: "", articleNumber: "", addressee: "", deliveryAddress: "", phone: "", operatorId: "", requiresSignature: false, isCod: false, codAmount: ""
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      officeId,
      codAmount: formData.isCod ? parseFloat(formData.codAmount) : undefined
    };
    // @ts-ignore
    createArticle.mutate({ data: payload }, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ barcode: "", articleNumber: "", addressee: "", deliveryAddress: "", phone: "", operatorId: "", requiresSignature: false, isCod: false, codAmount: "" });
        queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'returned': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'attempted': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Articles</h2>
          <p className="text-muted-foreground">Manage and assign articles for delivery.</p>
        </div>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Issue Article
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Issue New Article</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="articleNumber">Article Num</Label>
                  <Input id="articleNumber" value={formData.articleNumber} onChange={e => setFormData({...formData, articleNumber: e.target.value})} required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="addressee">Addressee Name</Label>
                <Input id="addressee" value={formData.addressee} onChange={e => setFormData({...formData, addressee: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Delivery Address</Label>
                <Input id="deliveryAddress" value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="operator">Assign Operator</Label>
                <Select value={formData.operatorId} onValueChange={v => setFormData({...formData, operatorId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 border p-3 rounded-md">
                  <Switch id="reqSig" checked={formData.requiresSignature} onCheckedChange={c => setFormData({...formData, requiresSignature: c})} />
                  <Label htmlFor="reqSig" className="cursor-pointer">Signature</Label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md">
                  <Switch id="cod" checked={formData.isCod} onCheckedChange={c => setFormData({...formData, isCod: c})} />
                  <Label htmlFor="cod" className="cursor-pointer">COD</Label>
                </div>
              </div>
              
              {formData.isCod && (
                <div className="space-y-2">
                  <Label htmlFor="codAmount">COD Amount (₹)</Label>
                  <Input id="codAmount" type="number" min="0" step="0.01" value={formData.codAmount} onChange={e => setFormData({...formData, codAmount: e.target.value})} required={formData.isCod} />
                </div>
              )}
              
              <Button type="submit" className="w-full mt-4" disabled={createArticle.isPending}>
                {createArticle.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Issue to Operator
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border">
        <div className="flex-1 flex gap-4">
          <div className="w-full sm:w-64">
            <Label className="text-xs mb-1 block">Date</Label>
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
          <div className="w-full sm:w-64">
            <Label className="text-xs mb-1 block">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="attempted">Attempted</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {articles?.map(article => (
            <Card key={article.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold truncate">{article.addressee}</h4>
                      <Badge variant="outline" className={`ml-auto sm:ml-0 uppercase tracking-wider text-[10px] ${getStatusColor(article.status)}`}>
                        {article.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{article.deliveryAddress}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground">
                      <span>{article.articleNumber}</span>
                      {article.isCod && <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">COD: ₹{article.codAmount}</span>}
                      {article.requiresSignature && <span>SIG REQ</span>}
                    </div>
                  </div>
                </div>
                
                <div className="sm:border-l sm:pl-4 sm:w-48 flex flex-col justify-center">
                  <p className="text-xs text-muted-foreground mb-1">Assigned to</p>
                  <p className="font-medium text-sm truncate">
                    {users?.find(u => u.id === article.operatorId)?.fullName || "Unassigned"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {(!articles || articles.length === 0) && (
            <div className="p-12 text-center text-muted-foreground bg-card rounded-lg border border-dashed">
              No articles found matching filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
