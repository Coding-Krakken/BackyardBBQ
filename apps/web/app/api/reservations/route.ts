import { NextResponse } from "next/server";
import { normalizeReservationForm } from "../../lib/validation";
import { featureFlags } from "../../config/content";

export async function POST(request: Request) {
  // Check if dine-in feature is enabled
  if (!featureFlags.isDineInEnabled) {
    return NextResponse.json(
      {
        error: "Table reservations are not currently available. Please check back later or explore our takeout and catering options."
      },
      { status: 403 }
    );
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = normalizeReservationForm(payload);

    // TODO: Persist reservation to database when Reservation model is introduced.
    const reservationId = `resv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json(
      {
        reservationId,
        message: `Reservation received for ${parsed.name}.`
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit reservation."
      },
      { status: 400 }
    );
  }
}
