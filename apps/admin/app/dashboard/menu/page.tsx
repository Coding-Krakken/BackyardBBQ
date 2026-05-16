'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency } from '@/lib/utils';

interface MenuItem {
  id: string;
  locationId: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  imageUrl: string | null;
  category: string;
  sortOrder: number;
  customizations: unknown;
  notes: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  location: { name: string };
}

interface Location {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
}

interface Customization {
  name: string;
  priceCents: number;
}

const CATEGORIES = [
  { value: 'mains', label: 'Mains / Platters' },
  { value: 'sandwiches', label: 'Sandwiches' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'combos', label: 'Combos / Specials' },
  { value: 'kids', label: 'Kids Menu' }
];

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'locations'>('items');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'location'; id: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { addToast } = useToast();

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCategory, setFormCategory] = useState('mains');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formCustomizations, setFormCustomizations] = useState<Customization[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formAvailable, setFormAvailable] = useState(true);
  const [formAddress, setFormAddress] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formLocationId, setFormLocationId] = useState('');

  const { data: itemsData, mutate: mutateItems } = useSWR<{ data: MenuItem[] }>('/api/admin/menu/items', fetcher);
  const { data: locationsData, mutate: mutateLocations } = useSWR<{ data: Location[] }>('/api/admin/menu/locations', fetcher);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormImageUrl('');
    setFormCategory('mains');
    setFormSortOrder('0');
    setFormCustomizations([]);
    setFormNotes('');
    setFormIsFeatured(false);
    setFormAvailable(true);
    setFormAddress('');
    setFormActive(true);
    setFormLocationId('');
    setEditingItem(null);
    setEditingLocation(null);
    setShowDialog(false);
  };

  const openCreateDialog = () => {
    resetForm();
    if (activeTab === 'items' && locationsData?.data?.[0]) {
      setFormLocationId(locationsData.data[0].id);
    }
    setShowDialog(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormLocationId(item.locationId);
    setFormName(item.name);
    setFormDescription(item.description ?? '');
    setFormPrice(String(item.basePriceCents / 100));
    setFormImageUrl(item.imageUrl ?? '');
    setFormCategory(item.category);
    setFormSortOrder(String(item.sortOrder));
    setFormCustomizations(Array.isArray(item.customizations) ? item.customizations as Customization[] : []);
    setFormNotes(item.notes ?? '');
    setFormIsFeatured(item.isFeatured);
    setFormAvailable(item.isAvailable);
    setShowDialog(true);
  };

  const openEditLocation = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormAddress(location.address ?? '');
    setFormActive(location.isActive);
    setShowDialog(true);
  };

  const addCustomization = () => {
    setFormCustomizations([...formCustomizations, { name: '', priceCents: 0 }]);
  };

  const removeCustomization = (index: number) => {
    setFormCustomizations(formCustomizations.filter((_, i) => i !== index));
  };

  const updateCustomization = (index: number, field: 'name' | 'priceCents', value: string | number) => {
    const updated = [...formCustomizations];
    const item = updated[index];
    if (!item) return;
    if (field === 'name') {
      item.name = value as string;
    } else {
      item.priceCents = typeof value === 'string' ? Math.round(parseFloat(value) * 100) : value;
    }
    setFormCustomizations(updated);
  };

  const handleSubmitItem = async () => {
    if (!formName || !formLocationId) {
      addToast({ type: 'error', message: 'Name and location are required' });
      return;
    }

    setIsSubmitting(true);
    const body = {
      locationId: formLocationId,
      name: formName,
      description: formDescription || null,
      basePriceCents: Math.round(parseFloat(formPrice || '0') * 100),
      imageUrl: formImageUrl || null,
      category: formCategory,
      sortOrder: parseInt(formSortOrder || '0'),
      customizations: formCustomizations.length > 0 ? formCustomizations : null,
      notes: formNotes || null,
      isFeatured: formIsFeatured,
      isAvailable: formAvailable,
    };

    try {
      const url = editingItem ? `/api/admin/menu/items/${editingItem.id}` : '/api/admin/menu/items';
      const method = editingItem ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        addToast({ type: 'success', message: `Item ${editingItem ? 'updated' : 'created'} successfully` });
        await mutateItems();
        resetForm();
      } else {
        addToast({ type: 'error', message: 'Failed to save item' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitLocation = async () => {
    setIsSubmitting(true);
    const body = { name: formName, address: formAddress, active: formActive };

    try {
      const url = editingLocation ? `/api/admin/menu/locations/${editingLocation.id}` : '/api/admin/menu/locations';
      const method = editingLocation ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        addToast({ type: 'success', message: `Location ${editingLocation ? 'updated' : 'created'} successfully` });
        await mutateLocations();
        resetForm();
      } else {
        addToast({ type: 'error', message: 'Failed to save location' });
      }
    } catch {
      addToast({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (type: 'item' | 'location', id: string) => {
    try {
      const url = type === 'item' ? `/api/admin/menu/items/${id}` : `/api/admin/menu/locations/${id}`;
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        addToast({ type: 'success', message: `${type === 'item' ? 'Item' : 'Location'} deleted` });
        type === 'item' ? await mutateItems() : await mutateLocations();
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to delete' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredItems = itemsData?.data?.filter(item => 
    categoryFilter === 'all' || item.category === categoryFilter
  ) ?? [];

  return (
    <RoleGate allowedRoles={['owner', 'admin', 'manager']}>
      <AnimatedPage>
        <PageHeader
          title="Menu Management"
          subtitle="Manage menu items and restaurant locations"
          action={
            <button className="btn btn-primary" onClick={openCreateDialog}>
              + New {activeTab === 'items' ? 'Item' : 'Location'}
            </button>
          }
        />

        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'items' ? 'tab-active' : ''}`} onClick={() => setActiveTab('items')}>Menu Items</button>
          <button className={`tab ${activeTab === 'locations' ? 'tab-active' : ''}`} onClick={() => setActiveTab('locations')}>Locations</button>
        </div>

        {activeTab === 'items' && (
          <>
            <div className="panel mb-md" style={{ padding: '1rem' }}>
              <label style={{ marginRight: '1rem' }}>Filter by category:</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select">
                <option value="all">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="panel">
              <DataTable
                columns={[
                  { 
                    header: 'Image', 
                    accessor: (row: MenuItem) => row.imageUrl ? (
                      <Image src={row.imageUrl} alt={row.name} width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px' }} />
                    ) : <div style={{ width: '60px', height: '60px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>No Image</div>
                  },
                  { header: 'Name', accessor: (row: MenuItem) => row.name, sortKey: (row: MenuItem) => row.name },
                  { header: 'Category', accessor: (row: MenuItem) => CATEGORIES.find(c => c.value === row.category)?.label ?? row.category, sortKey: (row: MenuItem) => row.category },
                  { header: 'Price', accessor: (row: MenuItem) => formatCurrency(row.basePriceCents), sortKey: (row: MenuItem) => row.basePriceCents },
                  { header: 'Sort', accessor: (row: MenuItem) => row.sortOrder, sortKey: (row: MenuItem) => row.sortOrder },
                  { header: 'Featured', accessor: (row: MenuItem) => (
                    <span className={`badge ${row.isFeatured ? 'badge-green' : 'badge-gray'}`}>
                      {row.isFeatured ? 'Yes' : 'No'}
                    </span>
                  )},
                  { header: 'Available', accessor: (row: MenuItem) => (
                    <span className={`badge ${row.isAvailable ? 'badge-green' : 'badge-red'}`}>
                      {row.isAvailable ? 'Yes' : 'No'}
                    </span>
                  )},
                  { header: 'Actions', accessor: (row: MenuItem) => (
                    <div className="flex-gap-sm">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEditItem(row)}>Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setDeleteTarget({ type: 'item', id: row.id })}>Delete</button>
                    </div>
                  )},
                ]}
                data={filteredItems}
              />
            </div>
          </>
        )}

        {activeTab === 'locations' && (
          <div className="panel">
            <DataTable
              columns={[
                { header: 'Name', accessor: (row: Location) => row.name, sortKey: (row: Location) => row.name },
                { header: 'Address', accessor: (row: Location) => row.address ?? 'N/A', sortKey: (row: Location) => row.address ?? '' },
                { header: 'Status', accessor: (row: Location) => (
                  <span className={`badge ${row.isActive ? 'badge-green' : 'badge-red'}`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                )},
                { header: 'Actions', accessor: (row: Location) => (
                  <div className="flex-gap-sm">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEditLocation(row)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setDeleteTarget({ type: 'location', id: row.id })}>Delete</button>
                  </div>
                )},
              ]}
              data={locationsData?.data ?? []}
            />
          </div>
        )}

        {/* Create/Edit Dialog */}
        {showDialog && (
          <div className="overlay">
            <div className="overlay-backdrop" onClick={resetForm} />
            <div className="modal" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 className="modal-title">
                {activeTab === 'items'
                  ? editingItem ? 'Edit Menu Item' : 'Create Menu Item'
                  : editingLocation ? 'Edit Location' : 'Create Location'
                }
              </h3>

              {activeTab === 'items' ? (
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Location *</label>
                    <select 
                      className="select" 
                      value={formLocationId} 
                      onChange={(e) => setFormLocationId(e.target.value)}
                    >
                      <option value="">Select location...</option>
                      {locationsData?.data?.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Item name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="textarea" rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL</label>
                    <input className="input" value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://..." />
                    {formImageUrl && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <Image src={formImageUrl} alt="Preview" width={120} height={120} style={{ objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price ($) *</label>
                    <input className="input" type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sort Order</label>
                    <input className="input" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(e.target.value)} placeholder="0" />
                    <small style={{ color: '#888', marginTop: '0.25rem', display: 'block' }}>Lower numbers appear first within the category</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customizations</label>
                    {formCustomizations.map((custom, index) => (
                      <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input 
                          className="input" 
                          placeholder="Name (e.g., Extra Sauce)" 
                          value={custom.name} 
                          onChange={(e) => updateCustomization(index, 'name', e.target.value)}
                          style={{ flex: 2 }}
                        />
                        <input 
                          className="input" 
                          type="number" 
                          step="0.01"
                          placeholder="Price $" 
                          value={custom.priceCents / 100} 
                          onChange={(e) => updateCustomization(index, 'priceCents', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button 
                          type="button"
                          className="btn btn-danger btn-xs" 
                          onClick={() => removeCustomization(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomization}>+ Add Customization</button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Internal Notes</label>
                    <textarea className="textarea" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Private admin notes..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={formIsFeatured} onChange={(e) => setFormIsFeatured(e.target.checked)} />
                      Featured on Homepage
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={formAvailable} onChange={(e) => setFormAvailable(e.target.checked)} />
                      Available for Order
                    </label>
                  </div>
                </div>
              ) : (
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Location name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea className="textarea" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Full address" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} style={{ marginRight: '0.5rem' }} />
                      Active
                    </label>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={resetForm} disabled={isSubmitting}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={activeTab === 'items' ? handleSubmitItem : handleSubmitLocation}
                  disabled={isSubmitting || !formName}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && handleDelete(deleteTarget.type, deleteTarget.id)}
          title={`Delete ${deleteTarget?.type === 'item' ? 'Menu Item' : 'Location'}`}
          message={`Are you sure you want to delete this ${deleteTarget?.type}? This action cannot be undone.`}
          confirmText="Delete"
          variant="destructive"
        />
      </AnimatedPage>
    </RoleGate>
  );
}
