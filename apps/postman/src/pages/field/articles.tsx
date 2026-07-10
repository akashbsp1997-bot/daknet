import React, { useState } from "react";
import { useGetOperatorDashboard, useUpdateArticle, useScanArticle } from "@workspace/api-client-react";
import { Package, ScanLine, Loader2, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOperatorDashboardQueryKey } from "@workspace/api-client-react";
import { getUser } from '@/lib/auth';

export default function FieldArticles() {
  const queryClient = useQueryClient();
  const operatorId = getUser()?.id || "";

  const { data: dashboard, isLoading } = useGetOperatorDashboard({ operatorId }, {
    query: { enabled: !!operatorId, queryKey: ["operatorDashboard", operatorId] }
  });

  const scanArticle = useScanArticle();
  const updateArticle = useUpdateArticle();

  const [scanMode, setScanMode] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string>("delivered");
  const [deliveryReason, setDeliveryReason] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScanResult = (barcode: string) => {
    setScanMode(false);
    scanArticle.mutate({ data: { barcode, operatorId } }, {
      onSuccess: (article) => {
        setSelectedArticle(article);
      },
      onError: () => {
        // Fallback to local search
        const found = dashboard?.articles.find(a => a.barcode === barcode);
        if (found) setSelectedArticle(found);
      }
    });
  };

  const submitStatus = () => {
    if (!selectedArticle) return;
    setIsProcessing(true);
    
    // GPS placeholder (in real app, use geolocation API)
    const gpsLat = 20.0; 
    const gpsLng = 78.0;

    updateArticle.mutate({ 
      id: selectedArticle.id, 
      data: { 
        status: deliveryStatus as any, 
        deliveryReason: deliveryStatus !== 'delivered' ? deliveryReason : undefined,
        gpsLat, gpsLng
      } 
    }, {
      onSuccess: () => {
        setIsProcessing(false);
        setSelectedArticle(null);
        queryClient.invalidateQueries({ queryKey: getGetOperatorDashboardQueryKey({ operatorId }) });
      },
      onError: () => setIsProcessing(false)
    });
  };

  const getStatusIcon = (status: string) => {
    if (status === 'delivered') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'attempted' || status === 'returned') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Package className="w-4 h-4 text-amber-500" />;
  };

  if (isLoading || !dashboard) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      {!scanMode && !selectedArticle && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Articles</h2>
            <Button onClick={() => setScanMode(true)} size="sm">
              <ScanLine className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </div>

          <div className="space-y-3">
            {dashboard.articles.map(article => (
              <Card key={article.id} className="active-elevate" onClick={() => setSelectedArticle(article)}>
                <CardContent className="p-4 flex gap-3 cursor-pointer">
                  <div className="mt-1">{getStatusIcon(article.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold truncate text-sm">{article.addressee}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{article.deliveryAddress}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{article.articleNumber}</span>
                      {article.isCod && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">COD: ₹{article.codAmount}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {dashboard.articles.length === 0 && (
              <div className="p-8 text-center bg-muted/50 rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">No articles assigned today.</p>
              </div>
            )}
          </div>
        </>
      )}

      {scanMode && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="h-14 flex items-center px-4 border-b shrink-0 bg-card">
            <Button variant="ghost" size="icon" onClick={() => setScanMode(false)} className="-ml-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h3 className="font-bold ml-2">Scan Barcode</h3>
          </div>
          <div className="flex-1 bg-black flex flex-col justify-center">
            <BarcodeScanner onResult={handleScanResult} />
            <p className="text-white text-center mt-8 text-sm opacity-80">Center barcode in the frame</p>
          </div>
        </div>
      )}

      <Sheet open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 flex flex-col">
          {selectedArticle && (
            <>
              <SheetHeader className="p-4 border-b text-left shrink-0">
                <SheetTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Update Status
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-muted p-4 rounded-xl space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Addressee</p>
                    <p className="font-bold">{selectedArticle.addressee}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm leading-snug">{selectedArticle.deliveryAddress}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <p className="font-mono text-sm">{selectedArticle.articleNumber}</p>
                    {selectedArticle.isCod && <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Collect: ₹{selectedArticle.codAmount}</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Update Status</Label>
                  <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivered">Delivered Successfully</SelectItem>
                      <SelectItem value="attempted">Attempted (Not available)</SelectItem>
                      <SelectItem value="returned">Return to Sender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {deliveryStatus !== 'delivered' && (
                  <div className="space-y-3">
                    <Label>Reason</Label>
                    <Input 
                      placeholder="e.g. Door locked, wrong address" 
                      value={deliveryReason} 
                      onChange={(e) => setDeliveryReason(e.target.value)}
                      className="h-12"
                    />
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-card shrink-0 pb-safe">
                <Button 
                  size="lg" 
                  className="w-full h-14 font-bold text-base" 
                  onClick={submitStatus}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                  Confirm Update
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
