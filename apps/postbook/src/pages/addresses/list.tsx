import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { listAddresses, type Address } from "@/lib/addresses-api";
import { getUser } from "@/lib/auth";
import { Search, Plus, MapPinned, ChevronRight, ShieldCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddAddressDialog } from "./add-dialog";

export default function AddressList() {
  const [, setLocation] = useLocation();
  const user = getUser();
  const officeId = user?.officeIds?.[0];

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<Address[]>([]);
  const [addDialogMode, setAddDialogMode] = useState<"closed" | "form" | "map">("closed");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Search/query changes reset the list rather than append to it.
  React.useEffect(() => {
    setCursor(undefined);
    setAllItems([]);
  }, [debouncedSearch]);

  const query = useQuery({
    queryKey: ["addresses", officeId, debouncedSearch, cursor],
    queryFn: () => listAddresses({ officeId, q: debouncedSearch || undefined, cursor, limit: 50 }),
    enabled: !!officeId,
  });

  React.useEffect(() => {
    if (query.data) {
      setAllItems((prev) => (cursor ? [...prev, ...query.data.items] : query.data.items));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const handleAdded = (address: Address) => {
    setAddDialogMode("closed");
    setLocation(`/addresses/${address.id}`, { state: { address } });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, address, or DIGIPIN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setAddDialogMode("map")}>
          <MapPinned className="w-4 h-4 mr-1.5" /> Pin on Map
        </Button>
        <Button className="flex-1" onClick={() => setAddDialogMode("form")}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Address
        </Button>
      </div>

      {!officeId && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Your account has no assigned office — contact an admin to get one linked.
        </p>
      )}

      {query.isLoading && !cursor && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-destructive text-center py-8">
          {query.error instanceof Error ? query.error.message : "Failed to load addresses"}
        </p>
      )}

      <ul className="space-y-1">
        {allItems.map((address) => (
          <li key={address.id}>
            <button
              onClick={() => setLocation(`/addresses/${address.id}`, { state: { address } })}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 text-left transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{address.name}</span>
                  {address.digilockerVerified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-label="DigiLocker verified" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{address.fullAddress}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {address.digipin && (
                    <Badge variant="outline" className="text-xs font-mono">{address.digipin}</Badge>
                  )}
                  <Badge
                    variant={address.verificationStatus === "verified" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {address.verificationStatus}
                  </Badge>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {!query.isLoading && allItems.length === 0 && officeId && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {debouncedSearch ? "No addresses match your search." : "No addresses yet — add the first one."}
        </p>
      )}

      {query.data?.nextCursor && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setCursor(query.data!.nextCursor!)}
          disabled={query.isFetching}
        >
          {query.isFetching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
          Load more
        </Button>
      )}

      {addDialogMode !== "closed" && officeId && (
        <AddAddressDialog
          mode={addDialogMode}
          officeId={officeId}
          onClose={() => setAddDialogMode("closed")}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
