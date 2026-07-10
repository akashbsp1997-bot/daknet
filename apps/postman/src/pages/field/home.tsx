import React, { useState } from "react";
import { useGetOperatorDashboard, useListArticles } from "@workspace/api-client-react";
import { Package, MapPin, CheckCircle2, ChevronRight, ScanLine, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { getUser } from '@/lib/auth';
import { Button } from "react-day-picker";

export default function FieldHome() {
  const user = getUser();
  const operatorId = user?.id;

  const { data: dashboard, isLoading } = useGetOperatorDashboard({ operatorId: operatorId || "" }, {
    query: { enabled: !!operatorId, queryKey: ["operatorDashboard", operatorId] }
  });

  if (isLoading || !dashboard) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const { articles } = dashboard;
  const pendingList = articles.filter(a => a.status === 'pending');

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="mb-2">
        <h2 className="text-xl font-bold">Good morning, {user?.fullName?.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">{new Date(dashboard.date).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-4">
            <Package className="w-5 h-5 mb-2 opacity-80" />
            <h3 className="text-3xl font-bold">{dashboard.pendingArticles}</h3>
            <p className="text-xs font-medium opacity-80 mt-1">Pending Delivery</p>
          </CardContent>
        </Card>
        
        <div className="grid grid-rows-2 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center justify-between h-full">
              <div>
                <h3 className="text-xl font-bold">{dashboard.deliveredToday}</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Delivered</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center justify-between h-full">
              <div>
                <h3 className="text-xl font-bold">{dashboard.visitsToday}</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Visits</p>
              </div>
              <MapPin className="w-5 h-5 text-amber-500" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/field/articles" className="flex-1">
          <Button size="lg" className="w-full h-14 text-base font-bold shadow-md">
            <ScanLine className="w-5 h-5 mr-2" />
            Scan Article
          </Button>
        </Link>
        <Link href="/field/visits" className="flex-1">
          <Button variant="secondary" size="lg" className="w-full h-14 text-base font-bold shadow-sm">
            <MapPin className="w-5 h-5 mr-2" />
            Record Visit
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Next Deliveries</h3>
          <Link href="/field/articles" className="text-xs text-primary font-medium flex items-center">
            View All <ChevronRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
        
        {pendingList.slice(0, 3).map(article => (
          <Card key={article.id} className="active-elevate">
            <Link href={`/field/articles?id=${article.id}`}>
              <CardContent className="p-4 flex items-center justify-between cursor-pointer">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold truncate text-sm">{article.addressee}</h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{article.deliveryAddress}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 -mr-2">
                  <ArrowRight className="w-4 h-4 text-primary" />
                </Button>
              </CardContent>
            </Link>
          </Card>
        ))}

        {pendingList.length === 0 && (
          <div className="p-8 text-center bg-muted/50 rounded-xl border border-dashed">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">All caught up for today!</p>
          </div>
        )}
      </div>
    </div>
  );
}
