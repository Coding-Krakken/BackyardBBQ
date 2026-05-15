'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoleGate } from '@/components/RoleGate';
import { AnimatedPage } from '@/components/AnimatedPage';
import { useToast } from '@/components/Toast';
import { fetcher, formatCurrency } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  available: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  active: boolean;
}

const CATEGORIES = ['mains', 'sides', 'drinks', 'desserts', 'combos'];

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'locations'>('items');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'location'; id: string } | null>(null);
  const { addToast } = useToast();

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('mains');
  const [formAvailable, setFormAvailable] = useState(true);
  const [formAddress, setFormAddress] = useState('');
  const [formActive, setFormActive] = useState(true);

  const { data: itemsData, mutate: mutateItems } = useSWR<{ data: MenuItem[] }>('/api/admin/menu/items', fetcher);
  const { data: locationsData, mutate: mutateLocations } = useSWR<{ data: Location[] }>('/api/admin/menu/locations', fetcher);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormCategory('mains');
    setFormAvailable(true);
    setFormAddress('');
    setFormActive(true);
    setEditingItem(null);
    setEditingLocation(null);
    setShowDialog(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDescription(item.description);
    setFormPrice(String(item.priceCents / 100));
    setFormCategory(item.category);
    setFormAvailable(item.available);
    setShowDialog(true);
  };

  const openEditLocation = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormAddress(location.address);
    setFormActive(location.active);
    setShowDialog(true);
  };

  const handleSubmitItem = async () => {
    setIsSubmitting(true);
    const body = {
      name: formName,
      description: formDescription,
      priceCents: Math.round(parseFloat(formPrice) * 100),
      category: formCategory,
      available: formAvailable,
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
          <div className="panel">
            <DataTable
              columns={[
                { header: 'Name', accessor: (row: MenuItem) => row.name, sortKey: (row: MenuItem) => row.name },
                { header: 'Category', accessor: (row: MenuItem) => row.category.charAt(0).toUpperCase() + row.category.slice(1), sortKey: (row: MenuItem) => row.category },
                { header: 'Price', accessor: (row: MenuItem) => formatCurrency(row.priceCents), sortKey: (row: MenuItem) => row.priceCents },
                { header: 'Available', accessor: (row: MenuItem) => (
                  <span className={`badge ${row.available ? 'badge-green' : 'badge-red'}`}>
                    {row.available ? 'Yes' : 'No'}
                  </span>
                )},
                { header: 'Actions', accessor: (row: MenuItem) => (
                  <div className="flex-gap-sm">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEditItem(row)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setDeleteTarget({ type: 'item', id: row.id })}>Delete</button>
                  </div>
                )},
              ]}
              data={itemsData?.data ?? []}
            />
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="panel">
            <DataTable
              columns={[
                { header: 'Name', accessor: (row: Location) => row.name, sortKey: (row: Location) => row.name },
                { header: 'Address', accessor: (row: Location) => row.address, sortKey: (row: Location) => row.address },
                { header: 'Status', accessor: (row: Location) => (
                  <span className={`badge ${row.active ? 'badge-green' : 'badge-red'}`}>
                    {row.active ? 'Active' : 'Inactive'}
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
            <div className="modal">
              <h3 className="modal-title">
                {activeTab === 'items'
                  ? editingItem ? 'Edit Menu Item' : 'Create Menu Item'
                  : editingLocation ? 'Edit Location' : 'Create Location'
                }
              </h3>

              {activeTab === 'items' ? (
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Item name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="textarea" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price ($)</label>
                    <input className="input" type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <input type="checkbox" checked={formAvailable} onChange={(e) => setFormAvailable(e.target.checked)} style={{ marginRight: '0.5rem' }} />
                      Available
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
