import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteTrades, useAddSiteTrade } from '@/hooks/useSiteTrades';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface TradeComboboxProps {
  siteId: string | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
}

// A trade added here is scoped to this site only (see add_site_trade / the
// site_trades RLS policies) - it will not show up on any other site's
// dropdown, by design, so there's no cross-site "did someone already add
// this" concern to handle here.
export function TradeCombobox({ siteId, value, onChange }: TradeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: trades = [], isLoading } = useSiteTrades(siteId);
  const addTrade = useAddSiteTrade(siteId);

  const query = search.trim();
  const exactMatch = trades.some((t) => t.name.toLowerCase() === query.toLowerCase());
  const showAddOption = query.length > 0 && !exactMatch;

  const handleAdd = async () => {
    try {
      await addTrade.mutateAsync(query);
      onChange(query);
      setSearch('');
      setOpen(false);
    } catch (err) {
      toast.error('Could not add trade', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal border-input"
        >
          <span className={cn(!value && 'text-muted-foreground')}>{value || 'Select a trade...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search trades..." value={search} onValueChange={setSearch} />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {query ? 'No matching trade.' : 'No trades yet.'}
                </CommandEmpty>
                <CommandGroup>
                  {trades
                    .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
                    .map((trade) => (
                      <CommandItem
                        key={trade.id}
                        value={trade.name}
                        onSelect={() => {
                          onChange(trade.name);
                          setSearch('');
                          setOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', value === trade.name ? 'opacity-100' : 'opacity-0')} />
                        {trade.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
                {showAddOption && (
                  <CommandGroup>
                    <CommandItem onSelect={handleAdd} disabled={addTrade.isPending} className="text-primary">
                      {addTrade.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Add "{query}" as a new trade
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
