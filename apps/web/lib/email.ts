import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Backyard BBQ King <noreply@send.backyardbbqking.com>";
const OWNER_EMAIL = process.env.CATERING_OWNER_EMAIL || "hello@backyardbbqking.com";

interface CateringInquiryEmailData {
  referenceNumber: string;
  eventDate: string;
  partySize: number;
  eventLocation: string;
  foodPreferences: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  additionalNotes?: string;
}

export async function sendCateringInquiryNotification(data: CateringInquiryEmailData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: OWNER_EMAIL,
    subject: `New Catering Inquiry: ${data.referenceNumber}`,
    html: `
      <h2>New Catering Inquiry Received</h2>
      <p><strong>Reference:</strong> ${data.referenceNumber}</p>
      <hr />
      <h3>Event Details</h3>
      <ul>
        <li><strong>Date:</strong> ${data.eventDate}</li>
        <li><strong>Guests:</strong> ${data.partySize}</li>
        <li><strong>Location:</strong> ${data.eventLocation}</li>
      </ul>
      <h3>Food Preferences</h3>
      <p>${data.foodPreferences}</p>
      ${data.additionalNotes ? `<h3>Additional Notes</h3><p>${data.additionalNotes}</p>` : ""}
      <hr />
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Name:</strong> ${data.contactName}</li>
        <li><strong>Email:</strong> <a href="mailto:${data.contactEmail}">${data.contactEmail}</a></li>
        <li><strong>Phone:</strong> <a href="tel:${data.contactPhone}">${data.contactPhone}</a></li>
      </ul>
      <hr />
      <p><em>Reply directly to the customer or update the status in the admin dashboard.</em></p>
    `,
  });

  if (error) {
    console.error("[email] Failed to send owner notification:", error);
  }
}

export async function sendCateringConfirmation(data: CateringInquiryEmailData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.contactEmail,
    subject: `Your Catering Inquiry - ${data.referenceNumber}`,
    html: `
      <h2>Thanks for your inquiry, ${data.contactName}!</h2>
      <p>We've received your catering request and will be in touch within 24 hours to discuss the details.</p>
      <p><strong>Your reference number:</strong> ${data.referenceNumber}</p>
      <hr />
      <h3>What you submitted</h3>
      <ul>
        <li><strong>Event Date:</strong> ${data.eventDate}</li>
        <li><strong>Guests:</strong> ${data.partySize}</li>
        <li><strong>Location:</strong> ${data.eventLocation}</li>
      </ul>
      <h3>What happens next</h3>
      <ol>
        <li>We'll review your request and reach out to discuss your menu and event details.</li>
        <li>Once we finalize the plan, a <strong>65% deposit</strong> secures your date.</li>
        <li>Full payment is due 7 days before your event.</li>
      </ol>
      <h3>Cancellation Policy</h3>
      <ul>
        <li>Cancel 3+ days before your event: <strong>full deposit refund</strong></li>
        <li>Cancel less than 3 days before: <strong>50% of total payment refunded</strong></li>
      </ul>
      <hr />
      <p>Questions? Reply to this email or call us directly.</p>
      <p>— The Backyard BBQ King Team</p>
    `,
  });

  if (error) {
    console.error("[email] Failed to send customer confirmation:", error);
  }
}
