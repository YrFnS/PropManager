'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  CreditCard,
  Wrench,
  MessageSquare,
  Settings,
  Plus,
  UserPlus,
  DollarSign,
  ClipboardList,
  BarChart3,
  Search,
} from 'lucide-react';

type Section = 'dashboard' | 'properties' | 'units' | 'tenants' | 'leases' | 'payments' | 'maintenance' | 'messages' | 'reports' | 'settings';

interface NavItem {
  key: Section;
  icon: React.ComponentType<{ className?: string }>;
}

interface ActionItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  section: Section;
  labelKey: string;
}

interface SearchResultItem {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  section: string;
}

interface SearchResults {
  properties: SearchResultItem[];
  tenants: SearchResultItem[];
  units: SearchResultItem[];
  leases: SearchResultItem[];
  payments: SearchResultItem[];
  maintenance: SearchResultItem[];
  messages: SearchResultItem[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'properties', icon: Building2 },
  { key: 'units', icon: DoorOpen },
  { key: 'tenants', icon: Users },
  { key: 'leases', icon: FileText },
  { key: 'payments', icon: CreditCard },
  { key: 'maintenance', icon: Wrench },
  { key: 'messages', icon: MessageSquare },
  { key: 'reports', icon: BarChart3 },
  { key: 'settings', icon: Settings },
];

const actionItems: ActionItem[] = [
  { key: 'addProperty', icon: Plus, section: 'properties', labelKey: 'addProperty' },
  { key: 'addTenant', icon: UserPlus, section: 'tenants', labelKey: 'addTenant' },
  { key: 'recordPayment', icon: DollarSign, section: 'payments', labelKey: 'addPayment' },
  { key: 'newMaintenanceRequest', icon: ClipboardList, section: 'maintenance', labelKey: 'addRequest' },
];

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  property: Building2,
  tenant: Users,
  unit: DoorOpen,
  lease: FileText,
  payment: CreditCard,
  maintenance: Wrench,
  message: MessageSquare,
};

const typeGroupOrder = ['properties', 'tenants', 'units', 'leases', 'payments', 'maintenance', 'messages'];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore();
  const router = useRouter();
  const tc = useTranslations('common');
  const tNav = useTranslations('nav');
  const tProps = useTranslations('properties');
  const tTenants = useTranslations('tenants');
  const tPayments = useTranslations('payments');
  const tMaintenance = useTranslations('maintenance');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Debounced search + reset on close
  useEffect(() => {
    if (!commandPaletteOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('');
      setSearchResults(null);
      return;
    }

    if (searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, commandPaletteOpen]);

  const handleNavSelect = (key: Section) => {
    router.push(key);
    setCommandPaletteOpen(false);
  };

  const handleActionSelect = (action: ActionItem) => {
    router.push(action.section);
    setCommandPaletteOpen(false);
    window.dispatchEvent(new CustomEvent('command-palette-action', { detail: { action: action.key } }));
  };

  const handleSearchResultSelect = (item: SearchResultItem) => {
    router.push(item.section as Section);
    setCommandPaletteOpen(false);
  };

  const getActionLabel = (action: ActionItem): string => {
    switch (action.key) {
      case 'addProperty': return tProps(action.labelKey);
      case 'addTenant': return tTenants(action.labelKey);
      case 'recordPayment': return tPayments(action.labelKey);
      case 'newMaintenanceRequest': return tMaintenance(action.labelKey);
      default: return action.labelKey;
    }
  };

  const hasSearchResults = searchResults && typeGroupOrder.some(key => searchResults[key as keyof SearchResults]?.length > 0);

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title={tc('commandPalette')}
      description={tc('searchCommands')}
      className="sm:max-w-lg"
    >
      <CommandInput
        placeholder={tc('searchCommands')}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>{searchLoading ? tc('loading') : tc('noSearchResults')}</CommandEmpty>

        {/* Search Results Group - shown above Navigation when there's a search query */}
        {hasSearchResults && (
          <>
            {typeGroupOrder.map(groupKey => {
              const items = searchResults[groupKey as keyof SearchResults];
              if (!items || items.length === 0) return null;
              return (
                <CommandGroup key={groupKey} heading={groupKey === 'properties' ? tNav('properties') : groupKey === 'tenants' ? tNav('tenants') : groupKey === 'units' ? tNav('units') : groupKey === 'leases' ? tNav('leases') : groupKey === 'payments' ? tNav('payments') : groupKey === 'maintenance' ? tNav('maintenance') : tNav('messages')}>
                  {items.map(item => {
                    const IconComp = typeIcons[item.type] || Search;
                    return (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        value={`${item.type}-${item.label}`}
                        onSelect={() => handleSearchResultSelect(item)}
                        className="cursor-pointer"
                      >
                        <IconComp className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <span className="truncate block">{item.label}</span>
                          {item.sublabel && (
                            <span className="text-xs text-muted-foreground truncate block">{item.sublabel}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
          </>
        )}

        {/* Navigation Group */}
        <CommandGroup heading={tc('navigation')}>
          {navItems.map((item) => (
            <CommandItem
              key={item.key}
              value={item.key}
              onSelect={() => handleNavSelect(item.key)}
              className="cursor-pointer"
            >
              <item.icon className="size-4" />
              <span>{tNav(item.key)}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Actions Group */}
        <CommandGroup heading={tc('actions')}>
          {actionItems.map((action) => (
            <CommandItem
              key={action.key}
              value={action.key}
              onSelect={() => handleActionSelect(action)}
              className="cursor-pointer"
            >
              <action.icon className="size-4" />
              <span>{getActionLabel(action)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
