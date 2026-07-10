import React, { useState, useEffect } from "react";
import { useCreateVisit } from "@workspace/api-client-react";
import { MapPin, Loader2, Building2, UserCircle, Briefcase, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getUser } from '@/lib/auth';

export default function FieldVisits() {
  const { toast } = useToast();
  const createVisit = useCreateVisit();
  const user = getUser();

  const [visitType, setVisitType] = useState<string>("delivery");
  const [notes, setNotes] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocating(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      toast({ title: "Location required", description: "GPS location is required to record a visit.", variant: "destructive" });
      return;
    }

    createVisit.mutate({
      data: {
        visitType: visitType as any,
        gpsLat: location.lat,
        gpsLng: location.lng,
        timestamp: new Date().toISOString(),
        notes,
        contactNumber,
        beatId: user?.beatId || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Visit recorded successfully" });
        setNotes("");
        setContactNumber("");
        setVisitType("delivery");
      }
    });
  };

  const types = [
    { id: "delivery", label: "Delivery", icon: <Building2 className="w-5 h-5 mb-1" /> },
    { id: "enquiry", label: "Enquiry", icon: <UserCircle className="w-5 h-5 mb-1" /> },
    { id: "lead", label: "New Lead", icon: <Briefcase className="w-5 h-5 mb-1" /> },
    { id: "other", label: "Other Work", icon: <FileText className="w-5 h-5 mb-1" /> },
  ];

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="mb-2">
        <h2 className="text-xl font-bold">Record Visit</h2>
        <p className="text-sm text-muted-foreground">Log an ad-hoc field visit or activity.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <Label>Activity Type</Label>
          <div className="grid grid-cols-2 gap-3">
            {types.map(t => (
              <div 
                key={t.id}
                onClick={() => setVisitType(t.id)}
                className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                  ${visitType === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                {t.icon}
                <span className="text-sm font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Contact Number (Optional)</Label>
          <Input 
            type="tel" 
            placeholder="10-digit number" 
            value={contactNumber} 
            onChange={e => setContactNumber(e.target.value)}
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <Label>Notes</Label>
          <Textarea 
            placeholder="Details about the visit..." 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            className="min-h-24 resize-none"
          />
        </div>

        <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" /> GPS Location
          </div>
          {locating ? (
            <span className="flex items-center gap-1 text-primary text-xs font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Locating...</span>
          ) : location ? (
            <span className="text-emerald-600 font-mono text-xs font-medium">Acquired ✓</span>
          ) : (
            <span className="text-destructive font-medium text-xs">Failed</span>
          )}
        </div>

        <Button 
          type="submit" 
          size="lg" 
          className="w-full h-14 font-bold text-base mt-4 shadow-md"
          disabled={createVisit.isPending || !location || locating}
        >
          {createVisit.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
          Record Visit
        </Button>
      </form>
    </div>
  );
}
