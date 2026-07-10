import React, { useState } from "react";
import { useGetAdminDashboard, useListOffices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from '@/lib/auth';
import { 
  Users, Package, CheckCircle2, AlertCircle, RefreshCw, 
  MapPin, Loader2, ArrowUpRight,
  Badge
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function Dashboard() {
  const user = getUser();
  const officeId = user?.officeIds?.[0]; // Assume office admin is assigned to one office primarily
  
  const { data: dashboard, isLoading } = useGetAdminDashboard(officeId ? { officeId } : {}, {
    query: { enabled: !!officeId, queryKey: ["adminDashboard", officeId] }
  });

  const { data: offices } = useListOffices();
  const officeName = offices?.find(o => o.id === officeId)?.name || dashboard?.officeName;

  if (isLoading || !dashboard) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const deliveryRate = dashboard.totalArticles > 0 
    ? Math.round((dashboard.deliveredArticles / dashboard.totalArticles) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Today's Operations</h2>
          <p className="text-muted-foreground">
            {officeName ? `${officeName} | ` : ""}{new Date(dashboard.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Field Staff</p>
                <h3 className="text-3xl font-bold mt-2">{dashboard.activeOperators} <span className="text-lg text-muted-foreground font-normal">/ {dashboard.totalOperators}</span></h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Articles</p>
                <h3 className="text-3xl font-bold mt-2">{dashboard.totalArticles}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                <h3 className="text-3xl font-bold mt-2">{deliveryRate}%</h3>
                <p className="text-xs text-muted-foreground mt-1">{dashboard.deliveredArticles} delivered successfully</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending / Returned</p>
                <h3 className="text-3xl font-bold mt-2">{dashboard.pendingArticles} <span className="text-lg text-muted-foreground font-normal">/ {dashboard.returnedArticles}</span></h3>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">7-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {dashboard.dailyTrend && dashboard.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { weekday: 'short' })}
                      className="text-xs"
                    />
                    <YAxis axisLine={false} tickLine={false} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                    />
                    <Line type="monotone" dataKey="delivered" name="Delivered" stroke="hsl(var(--primary))" strokeWidth={3} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="visits" name="Total Visits" stroke="hsl(var(--chart-3))" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No trend data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Field Operators
              <Badge variant="secondary" className="font-normal">{dashboard.operatorSummaries?.length || 0} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="space-y-0 divide-y max-h-[300px] overflow-y-auto">
              {dashboard.operatorSummaries?.map(op => (
                <div key={op.operatorId} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {op.operatorName.substring(0, 2).toUpperCase()}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${op.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{op.operatorName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {op.visits} visits today
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{op.delivered} <span className="text-xs font-normal text-muted-foreground">del</span></p>
                    <p className="text-xs text-amber-600 font-medium">{op.pending} pending</p>
                  </div>
                </div>
              ))}
              
              {(!dashboard.operatorSummaries || dashboard.operatorSummaries.length === 0) && (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No operators active today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
