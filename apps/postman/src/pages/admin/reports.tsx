import React, { useState } from "react";
import { useGetSummaryReport } from "@workspace/api-client-react";
import { FileBox, Download, Loader2, Calendar, TrendingUp, MapPin, Package, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getUser } from '@/lib/auth';

export default function Reports() {
  const officeId = getUser()?.officeIds?.[0] || "";
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");

  const { data: report, isLoading } = useGetSummaryReport(
    { officeId, period }, 
    { query: { enabled: !!officeId, queryKey: ["summaryReport", officeId, period] } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics & Reports</h2>
          <p className="text-muted-foreground">Performance metrics and historical data.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] bg-card">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Articles</p>
                    <h3 className="text-2xl font-bold mt-1">{report.totalArticles}</h3>
                  </div>
                  <div className="p-2 bg-muted rounded-md"><Package className="w-4 h-4" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                    <h3 className="text-2xl font-bold mt-1">{report.totalVisits}</h3>
                  </div>
                  <div className="p-2 bg-muted rounded-md"><MapPin className="w-4 h-4" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overall Delivery Rate</p>
                    <h3 className="text-2xl font-bold mt-1">{report.deliveryRate}%</h3>
                  </div>
                  <div className="p-2 bg-muted rounded-md"><TrendingUp className="w-4 h-4" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Delivery Volume Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {report.dailyBreakdown && report.dailyBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={report.dailyBreakdown} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} className="text-xs" axisLine={false} tickLine={false} />
                        <YAxis className="text-xs" axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="delivered" name="Delivered" stroke="hsl(var(--primary))" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">No data</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {report.topOperators && report.topOperators.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.topOperators} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                        <XAxis type="number" className="text-xs" axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="operatorName" className="text-xs" axisLine={false} tickLine={false} width={100} />
                        <Tooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="totalDeliveries" name="Deliveries" radius={[0, 4, 4, 0]} barSize={24}>
                          {report.topOperators.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">No data</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-lg border border-dashed">
          Report data unavailable.
        </div>
      )}
    </div>
  );
}
