import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInventory } from '@/hooks/useMaterials';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MaterialComboboxProps {
  siteId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Suggests material names already used on this site (via material_inventory,
// which every delivery/usage already upserts into) but still lets the user
// enter a material that's never been logged before - that requires an
// explicit "Add new material" click rather than accepting arbitrary typed
// text on blur, so a typo doesn't silently create a near-duplicate material
// (e.g. "Cement" vs "cement " vs "Cemet").
export function MaterialCombobox({ siteId, value, onChange, placeholder }: MaterialComboboxProps) {
  const { data: inventory } = useInventory(siteId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const names = Array.from(new Set((inventory ?? []).map((item) => item.material_name))).sort();
  const filtered = names.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()));
  const trimmedSearch = search.trim();
  const hasExactMatch = names.some((name) => name.toLowerCase() === trimmedSearch.toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder || 'Select material'}</span>
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or type a new material..." value={search} onValueChange={setSearch} />
          <CommandList>
            {filtered.length === 0 && !trimmedSearch && <CommandEmpty>No materials logged for this site yet.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => select(name)}>
                  <Check className={cn('w-4 h-4', value === name ? 'opacity-100' : 'opacity-0')} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmedSearch && !hasExactMatch && (
              <CommandGroup>
                <CommandItem value={`__add_new__${trimmedSearch}`} onSelect={() => select(trimmedSearch)}>
                  <Plus className="w-4 h-4" />
                  Add "{trimmedSearch}" as a new material
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
