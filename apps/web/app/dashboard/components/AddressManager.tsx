"use client";

import { useState, useEffect, FormEvent } from "react";

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

interface AddressManagerProps {
  onUpdate?: () => void;
}

export function AddressManager({ onUpdate }: AddressManagerProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    label: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    isDefault: false
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/customer/addresses");
      if (response.ok) {
        const data = await response.json();
        setAddresses(data.addresses || []);
      }
    } catch (error) {
      console.error("Failed to fetch addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      isDefault: false
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleEdit = (address: Address) => {
    setFormData({
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      isDefault: address.isDefault
    });
    setEditingId(address.id);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const url = editingId ? "/api/customer/addresses" : "/api/customer/addresses";
      const method = editingId ? "PATCH" : "POST";
      const body = editingId ? { id: editingId, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: editingId ? "Address updated successfully!" : "Address added successfully!"
        });
        fetchAddresses();
        resetForm();
        if (onUpdate) onUpdate();
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to save address"
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    try {
      const response = await fetch(`/api/customer/addresses?id=${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Address deleted successfully!"
        });
        fetchAddresses();
        if (onUpdate) onUpdate();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: "Failed to delete address"
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred"
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch("/api/customer/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true })
      });

      if (response.ok) {
        fetchAddresses();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error("Failed to set default:", error);
    }
  };

  if (loading) {
    return <p style={{ color: "var(--warm-gray)" }}>Loading addresses...</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>Saved Addresses</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-secondary"
            style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
          >
            + Add Address
          </button>
        )}
      </div>

      {message && (
        <div
          className={message.type === "success" ? "success-text" : "error-text"}
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: message.type === "success" 
              ? "rgba(34, 197, 94, 0.1)" 
              : "rgba(239, 68, 68, 0.1)",
            borderRadius: "8px",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
          }}
        >
          {message.text}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="form-stack" style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "rgba(3, 8, 11, 0.4)", borderRadius: "var(--radius-sm)", border: "1px solid var(--line-soft)" }}>
          <h4>{editingId ? "Edit Address" : "Add New Address"}</h4>
          
          <label>
            Label (e.g., "Home", "Work")
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
              maxLength={50}
            />
          </label>

          <label>
            Street Address
            <input
              type="text"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              required
              maxLength={200}
            />
          </label>

          <div className="form-row">
            <label style={{ flex: 2 }}>
              City
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
                maxLength={100}
              />
            </label>
            <label style={{ flex: 1 }}>
              State
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                required
                maxLength={2}
                placeholder="TX"
              />
            </label>
            <label style={{ flex: 1 }}>
              ZIP Code
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                required
                pattern="\d{5}(-\d{4})?"
                placeholder="12345"
              />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              style={{ width: "auto" }}
            />
            Set as default address
          </label>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? "Saving..." : editingId ? "Update Address" : "Add Address"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--warm-gray)" }}>
            No saved addresses yet. Add one to speed up checkout!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {addresses.map((address) => (
            <div
              key={address.id}
              className="panel"
              style={{
                padding: "1rem",
                border: address.isDefault ? "2px solid var(--ember)" : undefined
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <strong style={{ color: "var(--cream)" }}>{address.label}</strong>
                    {address.isDefault && (
                      <span style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.5rem",
                        background: "var(--ember)",
                        borderRadius: "4px",
                        color: "var(--bg-charcoal)",
                        fontWeight: 600
                      }}>
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                    {address.street}<br />
                    {address.city}, {address.state} {address.zip}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  {!address.isDefault && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="btn btn-ghost"
                      style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(address)}
                    className="btn btn-ghost"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="btn btn-ghost"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", color: "#ef4444" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
