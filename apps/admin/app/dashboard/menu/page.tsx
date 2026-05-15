'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Card,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button,
  TextInput,
  Select,
  SelectItem,
  Badge,
} from '@tremor/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useSession } from 'next-auth/react';
import { RoleGate } from '@/components/RoleGate';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MenuItem {
  id: string;
  name: string;
  basePriceCents: number;
  description?: string;
  isAvailable: boolean;
  locationId: string;
  location?: { name: string };
}

interface Location {
  id: string;
  name: string;
  type: 'truck' | 'brick_and_mortar';
  isActive: boolean;
  timezone: string;
  maxCateringCap: number;
}

export default function MenuPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;

  const { data: itemsData, mutate: mutateItems } = useSWR<{ data: MenuItem[] }>(
    '/api/admin/menu/items',
    fetcher
  );

  const { data: locationsData, mutate: mutateLocations } = useSWR<{ data: Location[] }>(
    '/api/admin/menu/locations',
    fetcher
  );

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  const [itemForm, setItemForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    locationId: '',
  });

  const [locationForm, setLocationForm] = useState({
    id: '',
    name: '',
    type: 'truck' as 'truck' | 'brick_and_mortar',
    timezone: 'America/New_York',
    maxCateringCap: '100',
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const resetItemForm = () => {
    setItemForm({ id: '', name: '', description: '', price: '', locationId: '' });
  };

  const resetLocationForm = () => {
    setLocationForm({
      id: '',
      name: '',
      type: 'truck',
      timezone: 'America/New_York',
      maxCateringCap: '100',
    });
  };

  const openCreateItemDialog = () => {
    resetItemForm();
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (item: MenuItem) => {
    setItemForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: (item.basePriceCents / 100).toFixed(2),
      locationId: item.locationId,
    });
    setItemDialogOpen(true);
  };

  const openCreateLocationDialog = () => {
    resetLocationForm();
    setLocationDialogOpen(true);
  };

  const openEditLocationDialog = (location: Location) => {
    setLocationForm({
      id: location.id,
      name: location.name,
      type: location.type,
      timezone: location.timezone,
      maxCateringCap: String(location.maxCateringCap),
    });
    setLocationDialogOpen(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.locationId || !itemForm.price.trim()) return;

    const basePriceCents = Math.round(Number(itemForm.price) * 100);
    if (!Number.isFinite(basePriceCents) || basePriceCents < 0) return;

    setItemSaving(true);
    try {
      if (itemForm.id) {
        await fetch(`/api/admin/menu/items/${itemForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: itemForm.name,
            description: itemForm.description || null,
            basePriceCents,
          }),
        });
      } else {
        await fetch('/api/admin/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId: itemForm.locationId,
            name: itemForm.name,
            description: itemForm.description || null,
            basePriceCents,
            isAvailable: true,
          }),
        });
      }

      await mutateItems();
      setItemDialogOpen(false);
      resetItemForm();
    } catch (error) {
      console.error('Failed to save menu item:', error);
    } finally {
      setItemSaving(false);
    }
  };

  const saveLocation = async () => {
    if (!locationForm.name.trim() || !locationForm.timezone.trim()) return;

    const maxCateringCap = Math.max(1, Math.round(Number(locationForm.maxCateringCap)));
    if (!Number.isFinite(maxCateringCap)) return;

    setLocationSaving(true);
    try {
      if (locationForm.id) {
        await fetch(`/api/admin/menu/locations/${locationForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: locationForm.name,
            type: locationForm.type,
            timezone: locationForm.timezone,
            maxCateringCap,
          }),
        });
      } else {
        await fetch('/api/admin/menu/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: locationForm.name,
            type: locationForm.type,
            timezone: locationForm.timezone,
            maxCateringCap,
            isActive: true,
          }),
        });
      }

      await mutateLocations();
      setLocationDialogOpen(false);
      resetLocationForm();
    } catch (error) {
      console.error('Failed to save location:', error);
    } finally {
      setLocationSaving(false);
    }
  };

  const handleToggleItemAvailability = async (itemId: string, currentState: boolean) => {
    try {
      await fetch(`/api/admin/menu/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentState }),
      });
      await mutateItems();
    } catch (error) {
      console.error('Failed to toggle item availability:', error);
    }
  };

  const handleToggleLocationActive = async (locationId: string, currentState: boolean) => {
    try {
      await fetch(`/api/admin/menu/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState }),
      });
      await mutateLocations();
    } catch (error) {
      console.error('Failed to toggle location:', error);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
    <div className="p-6">
      <PageHeader
        title="Menu Management"
        subtitle="Manage menu items and locations"
      />

      <Card>
        <TabGroup>
          <TabList>
            <Tab>Menu Items</Tab>
            <Tab>Locations</Tab>
          </TabList>
          <TabPanels>
            {/* Menu Items Tab */}
            <TabPanel>
              <div className="mb-4">
                <Button size="sm" color="orange" onClick={openCreateItemDialog}>
                  Add Menu Item
                </Button>
              </div>
              <DataTable
                columns={[
                  { header: 'Name', accessor: (row: MenuItem) => row.name },
                  {
                    header: 'Price',
                    accessor: (row: MenuItem) => formatCurrency(row.basePriceCents),
                  },
                  {
                    header: 'Location',
                    accessor: (row: MenuItem) => row.location?.name ?? 'N/A',
                  },
                  {
                    header: 'Available',
                    accessor: (row: MenuItem) => (
                      <Badge color={row.isAvailable ? 'green' : 'red'}>
                        {row.isAvailable ? 'Yes' : 'No'}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Actions',
                    accessor: (row: MenuItem) => (
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => handleToggleItemAvailability(row.id, row.isAvailable)}
                        >
                          Toggle
                        </Button>
                        <Button size="xs" variant="secondary" onClick={() => openEditItemDialog(row)}>
                          Edit
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={itemsData?.data ?? []}
              />
            </TabPanel>

            {/* Locations Tab */}
            <TabPanel>
              {userRole === 'owner' && (
                <div className="mb-4">
                  <Button size="sm" color="orange" onClick={openCreateLocationDialog}>
                    Add Location
                  </Button>
                </div>
              )}
              <DataTable
                columns={[
                  { header: 'Name', accessor: (row: Location) => row.name },
                  {
                    header: 'Type',
                    accessor: (row: Location) => (
                      <Badge>{row.type.toUpperCase()}</Badge>
                    ),
                  },
                  { header: 'Timezone', accessor: (row: Location) => row.timezone },
                  {
                    header: 'Active',
                    accessor: (row: Location) => (
                      <Badge color={row.isActive ? 'green' : 'red'}>
                        {row.isActive ? 'Yes' : 'No'}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Actions',
                    accessor: (row: Location) => (
                      <div className="flex gap-2">
                        {(userRole === 'owner' || userRole === 'admin') && (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => handleToggleLocationActive(row.id, row.isActive)}
                          >
                            Toggle
                          </Button>
                        )}
                        {userRole === 'owner' && (
                          <Button size="xs" variant="secondary" onClick={() => openEditLocationDialog(row)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={locationsData?.data ?? []}
              />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>

      {itemDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl space-y-4">
            <h3 className="text-lg font-semibold text-bbq-light">
              {itemForm.id ? 'Edit Menu Item' : 'Add Menu Item'}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextInput
                placeholder="Item name"
                value={itemForm.name}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, name: value }))}
              />
              <TextInput
                placeholder="Price (e.g. 12.99)"
                value={itemForm.price}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, price: value }))}
              />
              <TextInput
                placeholder="Description"
                value={itemForm.description}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, description: value }))}
              />
              <Select
                value={itemForm.locationId}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, locationId: value }))}
              >
                <SelectItem value="">Select Location</SelectItem>
                {(locationsData?.data ?? []).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setItemDialogOpen(false);
                  resetItemForm();
                }}
              >
                Cancel
              </Button>
              <Button size="sm" color="orange" onClick={saveItem} loading={itemSaving}>
                {itemForm.id ? 'Save Changes' : 'Create Item'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {locationDialogOpen && userRole === 'owner' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl space-y-4">
            <h3 className="text-lg font-semibold text-bbq-light">
              {locationForm.id ? 'Edit Location' : 'Add Location'}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextInput
                placeholder="Location name"
                value={locationForm.name}
                onValueChange={(value) => setLocationForm((prev) => ({ ...prev, name: value }))}
              />
              <Select
                value={locationForm.type}
                onValueChange={(value) =>
                  setLocationForm((prev) => ({ ...prev, type: value as 'truck' | 'brick_and_mortar' }))
                }
              >
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="brick_and_mortar">Brick and Mortar</SelectItem>
              </Select>
              <TextInput
                placeholder="Timezone"
                value={locationForm.timezone}
                onValueChange={(value) => setLocationForm((prev) => ({ ...prev, timezone: value }))}
              />
              <TextInput
                placeholder="Max Catering Capacity"
                value={locationForm.maxCateringCap}
                onValueChange={(value) => setLocationForm((prev) => ({ ...prev, maxCateringCap: value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setLocationDialogOpen(false);
                  resetLocationForm();
                }}
              >
                Cancel
              </Button>
              <Button size="sm" color="orange" onClick={saveLocation} loading={locationSaving}>
                {locationForm.id ? 'Save Changes' : 'Create Location'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
    </RoleGate>
  );
}
