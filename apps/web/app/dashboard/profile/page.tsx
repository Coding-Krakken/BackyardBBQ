"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";
import { AddressManager } from "../components/AddressManager";

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "glutenFree", label: "Gluten-Free" },
  { value: "dairyFree", label: "Dairy-Free" },
  { value: "nutAllergy", label: "Nut Allergy" },
  { value: "shellfishAllergy", label: "Shellfish Allergy" },
  { value: "lowSodium", label: "Low Sodium" },
  { value: "keto", label: "Keto" },
];

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [notifsMessage, setNotifsMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [notificationSettings, setNotificationSettings] = useState({
    email: { orderUpdates: true, bookingReminders: true, promotions: true },
    sms: { orderUpdates: false, bookingReminders: false }
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/customer/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data.customer);
        setFirstName(data.customer.firstName || "");
        setLastName(data.customer.lastName || "");
        setPhone(data.customer.phone || "");
        
        // Parse dietary preferences from JSON
        if (data.customer.dietaryPreferences) {
          const prefs = typeof data.customer.dietaryPreferences === 'string' 
            ? JSON.parse(data.customer.dietaryPreferences)
            : data.customer.dietaryPreferences;
          setDietaryPreferences(prefs || []);
        }
        
        // Parse notification settings from JSON
        if (data.customer.notificationSettings) {
          const settings = typeof data.customer.notificationSettings === 'string'
            ? JSON.parse(data.customer.notificationSettings)
            : data.customer.notificationSettings;
          setNotificationSettings(settings);
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone })
      });

      if (response.ok) {
        setMessage("Profile updated successfully!");
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage("Failed to update profile");
      }
    } catch (error) {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDietaryChange = (value: string) => {
    setDietaryPreferences(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleSaveDietaryPrefs = async () => {
    setSavingPrefs(true);
    setPrefsMessage(null);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          dietaryPreferences: JSON.stringify(dietaryPreferences)
        })
      });

      if (response.ok) {
        setPrefsMessage("Preferences saved successfully!");
        setTimeout(() => setPrefsMessage(null), 3000);
      } else {
        setPrefsMessage("Failed to save preferences");
      }
    } catch (error) {
      setPrefsMessage("An error occurred");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifs(true);
    setNotifsMessage(null);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          notificationSettings: JSON.stringify(notificationSettings)
        })
      });

      if (response.ok) {
        setNotifsMessage("Notification settings saved successfully!");
        setTimeout(() => setNotifsMessage(null), 3000);
      } else {
        setNotifsMessage("Failed to save settings");
      }
    } catch (error) {
      setNotifsMessage("An error occurred");
    } finally {
      setSavingNotifs(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <p style={{ color: "var(--warm-gray)" }}>Loading...</p>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Profile Settings</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Manage your personal information and preferences.
            </p>
          </section>

          {/* Personal Information */}
          <article className="panel" style={{ marginBottom: "1.5rem" }}>
            <h3>Personal Information</h3>
            <form className="form-stack" onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
              <div className="form-row">
                <label>
                  First Name
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Last Name
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </label>
              </div>

              <label>
                Email
                <input type="email" value={profile?.email || ""} disabled />
              </label>

              <label>
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </label>

              {message && (
                <p className={message.includes("success") ? "success-text" : "error-text"}>
                  {message}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </article>

          {/* Dietary Preferences */}
          <article className="panel" style={{ marginBottom: "1.5rem" }}>
            <h3>Dietary Preferences & Allergens</h3>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
              Help us recommend dishes that fit your dietary needs
            </p>

            <div style={{ 
              marginTop: "1.5rem", 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
              gap: "0.75rem" 
            }}>
              {DIETARY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    background: dietaryPreferences.includes(option.value) 
                      ? "rgba(217, 109, 49, 0.15)" 
                      : "rgba(3, 8, 11, 0.4)",
                    border: dietaryPreferences.includes(option.value)
                      ? "1px solid var(--ember)"
                      : "1px solid var(--line-soft)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dietaryPreferences.includes(option.value)}
                    onChange={() => handleDietaryChange(option.value)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>{option.label}</span>
                </label>
              ))}
            </div>

            {prefsMessage && (
              <p 
                className={prefsMessage.includes("success") ? "success-text" : "error-text"}
                style={{ marginTop: "1rem" }}
              >
                {prefsMessage}
              </p>
            )}

            <button
              onClick={handleSaveDietaryPrefs}
              className="btn btn-primary"
              disabled={savingPrefs}
              style={{ marginTop: "1.5rem" }}
            >
              {savingPrefs ? "Saving..." : "Save Preferences"}
            </button>
          </article>

          {/* Notification Preferences */}
          <article className="panel" style={{ marginBottom: "1.5rem" }}>
            <h3>Notification Preferences</h3>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
              Choose how you want to receive updates from us
            </p>

            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ marginBottom: "1rem", fontSize: "1rem" }}>📧 Email Notifications</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginLeft: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={notificationSettings.email.orderUpdates}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      email: { ...notificationSettings.email, orderUpdates: e.target.checked }
                    })}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ color: "var(--cream)", fontWeight: 500 }}>Order Updates</div>
                    <div style={{ color: "var(--warm-gray)", fontSize: "0.85rem" }}>
                      Get notified when your order status changes
                    </div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={notificationSettings.email.bookingReminders}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      email: { ...notificationSettings.email, bookingReminders: e.target.checked }
                    })}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ color: "var(--cream)", fontWeight: 500 }}>Booking Reminders</div>
                    <div style={{ color: "var(--warm-gray)", fontSize: "0.85rem" }}>
                      Reminders for your upcoming catering events
                    </div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={notificationSettings.email.promotions}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      email: { ...notificationSettings.email, promotions: e.target.checked }
                    })}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ color: "var(--cream)", fontWeight: 500 }}>Promotions & News</div>
                    <div style={{ color: "var(--warm-gray)", fontSize: "0.85rem" }}>
                      Special offers, new menu items, and company updates
                    </div>
                  </div>
                </label>
              </div>

              <h4 style={{ marginTop: "2rem", marginBottom: "1rem", fontSize: "1rem" }}>📱 SMS Notifications</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginLeft: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={notificationSettings.sms.orderUpdates}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      sms: { ...notificationSettings.sms, orderUpdates: e.target.checked }
                    })}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ color: "var(--cream)", fontWeight: 500 }}>Order Updates</div>
                    <div style={{ color: "var(--warm-gray)", fontSize: "0.85rem" }}>
                      Critical order updates via text message
                    </div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={notificationSettings.sms.bookingReminders}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      sms: { ...notificationSettings.sms, bookingReminders: e.target.checked }
                    })}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ color: "var(--cream)", fontWeight: 500 }}>Booking Reminders</div>
                    <div style={{ color: "var(--warm-gray)", fontSize: "0.85rem" }}>
                      Text reminders 24 hours before your event
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {notifsMessage && (
              <p
                className={notifsMessage.includes("success") ? "success-text" : "error-text"}
                style={{ marginTop: "1rem" }}
              >
                {notifsMessage}
              </p>
            )}

            <button
              onClick={handleSaveNotificationSettings}
              className="btn btn-primary"
              disabled={savingNotifs}
              style={{ marginTop: "1.5rem" }}
            >
              {savingNotifs ? "Saving..." : "Save Notification Settings"}
            </button>
          </article>

          {/* Saved Addresses */}
          <article className="panel">
            <AddressManager onUpdate={fetchProfile} />
          </article>
        </main>
      </div>
    </>
  );
}
