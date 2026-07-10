import React from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetOffice } from "@workspace/api-client-react";
import { getAddress, verifyAddress, verifyDigilocker, getPossibleDuplicates, type Address } from "@/lib/addresses-api";
import { getRole, getUser } from "@/lib/auth";
import { ClickableMap, Marker, Polygon, customIcon, convertGeoJsonToPoints } from "@/components/MapComponents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldCheck, ShieldAlert, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AddressDetail() {
  const [, params] = useRoute("/addresses/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params?.id ?? "";
  const role = getRole();
  const officeId = getUser()?.officeIds?.[0];
  const canVerify = role === "office_admin" || role === "super_admin";

  const addressQuery = useQuery({
    queryKey: ["address", id],
    queryFn: () => getAddress(id),
    enabled: !!id,
  });

  const officeQuery = useGetOffice(officeId ?? "", { query: { enabled: !!officeId } });

  const duplicatesQuery = useQuery({
    queryKey: ["address-duplicates", id],
    queryFn: () => getPossibleDuplicates(id),
    enabled: !!id && !!addressQuery.data?.digilockerVerified,
  });

  const invalidate = (address: Address) => queryClient.setQueryData(["address", id], address);

  const adminVerify = useMutation({
    mutationFn: (status: "verified" | "rejected") => verifyAddress(id, status),
    onSuccess: invalidate,
    onError: (err) =>
      toast({ title: "Verification failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const digilockerVerify = useMutation({
    mutationFn: () => verifyDigilocker(id),
    onSuccess: invalidate,
    onError: (err) =>
      toast({ title: "DigiLocker verification failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  if (addressQuery.isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (addressQuery.isError || !addressQuery.data) {
    return (
      <div className="p-4 text-center space-y-3">
        <p className="text-sm text-destructive">Couldn't load this address.</p>
        <Button variant="outline" onClick={() => setLocation("/addresses")}>Back to list</Button>
      </div>
    );
  }

  const address = addressQuery.data;
  const officePolygon = officeQuery.data?.polygonGeoJson ? convertGeoJsonToPoints(officeQuery.data.polygonGeoJson) : [];

  return (
    <div className="pb-8">
      <div className="p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/addresses")} aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-bold truncate">{address.name}</h1>
      </div>

      <div className="h-64 mx-4 rounded-lg overflow-hidden border">
        <ClickableMap center={[address.gpsLat, address.gpsLng]} zoom={16}>
          {officePolygon.length > 0 && (
            <Polygon positions={officePolygon} pathOptions={{ color: "hsl(var(--primary))", fillOpacity: 0.05, weight: 2 }} />
          )}
          <Marker position={[address.gpsLat, address.gpsLng]} icon={customIcon} />
        </ClickableMap>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={address.verificationStatus === "verified" ? "default" : "secondary"}>
            {address.verificationStatus}
          </Badge>
          {address.digilockerVerified && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> DigiLocker verified
            </Badge>
          )}
          {address.digipin && <Badge variant="outline" className="font-mono">{address.digipin}</Badge>}
        </div>

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">{address.fullAddress}</p>
          <p className="text-xs text-muted-foreground font-mono">{address.gpsLat.toFixed(6)}, {address.gpsLng.toFixed(6)}</p>
        </div>

        {(address.contactPerson || address.contactNumber) && (
          <>
            <Separator />
            <div className="text-sm space-y-0.5">
              {address.contactPerson && <p><span className="text-muted-foreground">Contact: </span>{address.contactPerson}</p>}
              {address.contactNumber && <p><span className="text-muted-foreground">Phone: </span>{address.contactNumber}</p>}
              {address.digilockerVerified && address.digilockerVerifiedName && (
                <p className="text-xs text-emerald-700">Verified as {address.digilockerVerifiedName} · {address.digilockerVerifiedMobile}</p>
              )}
            </div>
          </>
        )}

        {duplicatesQuery.data && duplicatesQuery.data.length > 0 && (
          <>
            <Separator />
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5 text-amber-900">
                <Users className="w-4 h-4" /> Possible duplicate — same verified identity found at {duplicatesQuery.data.length} other address{duplicatesQuery.data.length > 1 ? "es" : ""}
              </p>
              {duplicatesQuery.data.map((dup) => (
                <button
                  key={dup.id}
                  onClick={() => setLocation(`/addresses/${dup.id}`)}
                  className="block w-full text-left text-sm text-amber-900 underline underline-offset-2"
                >
                  {dup.name} — {dup.fullAddress}
                </button>
              ))}
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-2">
          {!address.digilockerVerified && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => digilockerVerify.mutate()}
              disabled={digilockerVerify.isPending}
            >
              {digilockerVerify.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
              Verify DigiLocker
            </Button>
          )}

          {canVerify && address.verificationStatus === "pending" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => adminVerify.mutate("rejected")}
                disabled={adminVerify.isPending}
              >
                <ShieldAlert className="w-4 h-4 mr-1.5" /> Reject
              </Button>
              <Button className="flex-1" onClick={() => adminVerify.mutate("verified")} disabled={adminVerify.isPending}>
                {adminVerify.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                Verify Address
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
