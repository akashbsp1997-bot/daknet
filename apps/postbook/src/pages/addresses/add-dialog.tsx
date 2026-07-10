import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAddress, type Address, type CreateAddressInput } from "@/lib/addresses-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import { ClickableMap, Marker, customIcon } from "@/components/MapComponents";
import { useToast } from "@/hooks/use-toast";

const ADDRESS_TYPES = ["residential", "commercial", "government", "institutional"] as const;

export function AddAddressDialog({
  mode,
  officeId,
  onClose,
  onAdded,
}: {
  mode: "form" | "map";
  officeId: string;
  onClose: () => void;
  onAdded: (address: Address) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"pick" | "details">(mode === "map" ? "pick" : "details");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("residential");
  const [fullAddress, setFullAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const create = useMutation({
    mutationFn: (data: CreateAddressInput) => createAddress(data),
    onSuccess: (address) => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onAdded(address);
    },
    onError: (err) => {
      toast({
        title: "Couldn't add address",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGpsLat(pos.coords.latitude);
      setGpsLng(pos.coords.longitude);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gpsLat === null || gpsLng === null || !name || !fullAddress) return;
    create.mutate({
      name,
      type,
      gpsLat,
      gpsLng,
      fullAddress,
      contactPerson: contactPerson || undefined,
      contactNumber: contactNumber || undefined,
      officeId,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === "pick" ? "Tap the location" : "Address details"}</DialogTitle>
        </DialogHeader>

        {step === "pick" ? (
          <div className="space-y-3">
            <div className="h-72 rounded-lg overflow-hidden border">
              <ClickableMap
                zoom={14}
                onMapClick={(e: { latlng: { lat: number; lng: number } }) => {
                  setGpsLat(e.latlng.lat);
                  setGpsLng(e.latlng.lng);
                }}
              >
                {gpsLat !== null && gpsLng !== null && <Marker position={[gpsLat, gpsLng]} icon={customIcon} />}
              </ClickableMap>
            </div>
            <p className="text-sm text-muted-foreground">
              {gpsLat !== null ? `${gpsLat.toFixed(6)}, ${gpsLng!.toFixed(6)}` : "Tap anywhere on the map to drop a pin."}
            </p>
            <Button className="w-full" disabled={gpsLat === null} onClick={() => setStep("details")}>
              Continue
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {gpsLat === null ? (
              <Button type="button" variant="outline" className="w-full" onClick={useCurrentLocation}>
                <MapPin className="w-4 h-4 mr-1.5" /> Use my current location
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">{gpsLat.toFixed(6)}, {gpsLng!.toFixed(6)}</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ADDRESS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullAddress">Full address</Label>
              <Input id="fullAddress" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Contact person (optional)</Label>
              <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactNumber">Contact number (optional)</Label>
              <Input id="contactNumber" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </div>

            <Button type="submit" className="w-full" disabled={create.isPending || gpsLat === null}>
              {create.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Save Address
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
