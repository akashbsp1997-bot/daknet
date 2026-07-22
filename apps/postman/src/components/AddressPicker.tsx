import React, { useEffect, useState } from "react";
import { useListAddresses } from "@workspace/api-client-react";
import { Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export interface AddressPickerValue {
  id: string;
  name: string;
}

export function AddressPicker({
  officeId,
  value,
  onChange,
}: {
  officeId: string;
  value: AddressPickerValue | null;
  onChange: (address: AddressPickerValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useListAddresses(
    { officeId, q: debouncedQuery || undefined, limit: 10 },
    { query: { enabled: open && !!officeId } }
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between h-12 font-normal"
        >
          <span className="truncate">{value ? value.name : "Search address (optional)"}</span>
          <Search className="w-4 h-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name or address..." value={query} onValueChange={setQuery} />
          <CommandList>
            {isFetching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
            {!isFetching && <CommandEmpty>No address found.</CommandEmpty>}
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false); }}>
                  Clear selection
                </CommandItem>
              )}
              {data?.items.map((addr) => (
                <CommandItem
                  key={addr.id}
                  value={addr.id}
                  onSelect={() => { onChange({ id: addr.id, name: addr.name }); setOpen(false); }}
                >
                  {value?.id === addr.id && <Check className="w-4 h-4 mr-1" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{addr.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{addr.fullAddress}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
