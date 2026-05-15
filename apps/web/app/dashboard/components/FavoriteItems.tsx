"use client";

interface FavoriteItem {
  name: string;
  count: number;
  totalSpentCents: number;
  lastOrderedAt: string;
  available: boolean;
  currentPriceCents?: number;
  locationName?: string;
}

interface FavoritesProps {
  favorites: FavoriteItem[];
}

export function FavoriteItems({ favorites }: FavoritesProps) {
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!favorites || favorites.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-section">
      <div>
        <h2>Your Favorites</h2>
        <p style={{ color: "var(--warm-gray)", marginTop: "0.25rem", fontSize: "0.95rem" }}>
          Based on your order history
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem"
        }}
      >
        {favorites.slice(0, 4).map((item, index) => (
          <article
            key={item.name}
            className="panel"
            style={{
              padding: "1.25rem",
              opacity: item.available ? 1 : 0.6
            }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: "0.75rem" }}>
              <div
                style={{
                  fontSize: "1.75rem",
                  lineHeight: 1,
                  color: index === 0 ? "var(--ember)" : "var(--brass)"
                }}
              >
                {index === 0 ? "🏆" : index === 1 ? "🥈" : index === 2 ? "🥉" : "⭐"}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                  {item.name}
                </h3>
                
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--warm-gray)" }}>
                  <div>
                    <span style={{ color: "var(--ember)" }}>{item.count}</span> ordered
                  </div>
                  <div>
                    {formatPrice(item.totalSpentCents)} total
                  </div>
                </div>

                {item.available && item.currentPriceCents && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
                      {item.locationName}
                    </p>
                    <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--ember)", marginTop: "0.25rem" }}>
                      {formatPrice(item.currentPriceCents)}
                    </p>
                  </div>
                )}

                {!item.available && (
                  <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--warm-gray)", fontStyle: "italic" }}>
                    Currently unavailable
                  </p>
                )}

                <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--warm-gray)" }}>
                  Last ordered {formatDate(item.lastOrderedAt)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {favorites.length > 4 && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/checkout" className="btn btn-secondary">
            View All Favorites & Order
          </a>
        </div>
      )}
    </section>
  );
}
