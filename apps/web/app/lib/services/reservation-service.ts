import type { ReservationFormData } from "../validation";

interface ReservationResponse {
  reservationId: string;
  message: string;
}

export async function submitReservation(payload: ReservationFormData): Promise<ReservationResponse> {
  const response = await fetch("/api/reservations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as ReservationResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to submit reservation request.");
  }

  return data;
}
