# Cloudflare Worker: Bland AI Recruiting Pathway Integrations

This Cloudflare Worker serves as an integration hub for the Bland AI "Support Engineer Recruiting Pathway." It handles tasks like generating ICS calendar invites, sending email notifications, and posting alerts to Slack.

## 1. Overview

The primary purpose of this worker is to offload external API interactions from the Bland AI pathway, allowing the pathway to focus on conversational logic while this worker manages:
*   Generating iCalendar (.ics) files for interview appointments.
*   Sending email confirmations with ICS attachments to applicants.
*   Sending real-time notifications (success/failure) to designated Slack channels regarding the booking process.

It is designed to be called via HTTP POST requests from the Bland AI pathway.

## 2. Endpoints

Currently, the worker exposes the following HTTP POST endpoints:

### 2.1. `/book-email`
*   **Purpose:** Orchestrates the generation of an ICS calendar invite and sends it via email to the applicant. Also triggers internal Slack notifications for the success or failure of this specific process.
*   **Method:** `POST`
*   **Expected Request Body (JSON):**
    ```json
    {
      "email": "applicant.email@example.com",
      "interview_date": "DD-MM-YYYY", // e.g., "21-05-2025"
      "interview_time": "HH:MM"      // e.g., "14:30" (Assumed Pacific Time)
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Booking confirmed and email sent."
    }
    ```
*   **Error Response (4xx/5xx):**
    ```json
    {
      "success": false,
      "error": "Error message describing the issue."
    }
    ```
*   **Internal Logic:**
    1.  Parses input `interview_date` and `interview_time` (assumed Pacific Time).
    2.  Converts the Pacific Time to a UTC ISO 8601 string (currently uses a fixed UTC-8 offset; future enhancement: use `date-fns-tz` for full PST/PDT accuracy if input parsing becomes more complex here).
    3.  Derives a `name` from the applicant's email for personalization.
    4.  Calls **ApyHub API** (using `APY_TOKEN` secret) to generate `.ics` content. The ApyHub request specifies `time_zone: 'America/Los_Angeles'` for the event.
    5.  Calls **SendGrid API** (using `SENDGRID_KEY` secret) to send an email with the `.ics` attachment. Email body displays time formatted explicitly in Pacific Time using `date-fns-tz`.
    6.  Non-blockingly (via `ctx.waitUntil`) calls its own `/slack-event` endpoint to notify about the success or failure of the ApyHub/SendGrid operations.

### 2.2. `/slack-event`
*   **Purpose:** An internal endpoint called by other functions within this worker (e.g., `/book-email`) to send notifications to Slack. This allows for non-blocking Slack messages.
*   **Method:** `POST`
*   **Expected Request Body (JSON):**
    ```json
    // Interface: InternalSlackEvent
    {
      "type": "booking_success" | "booking_failure", // Add more types as needed
      "data": {
        "email"?: string,
        "name"?: string,
        "pacificTime"?: string, // Formatted Pacific Time string
        "errorMessage"?: string
        // pathwayId, nodeId could be added if called directly by Bland pathway for other events
      }
    }
    ```
*   **Response (200 OK / 202 Accepted / 500 Internal Server Error):** Simple status indicating if the request was processed. The actual Slack message sending is best-effort.
*   **Internal Logic:**
    1.  Parses the event payload.
    2.  Determines the target Slack webhook URL (`SLACK_BOOKINGS_URL` or `SLACK_ERRORS_URL` based on `type`).
    3.  Formats a message using Slack Block Kit.
    4.  Uses a utility function (`src/utils/slack.ts`) to POST the message to the Slack webhook.

## 3. Project Structure

```
.
├── src/
│   ├── index.ts         # Main worker logic, routing, and handlers
│   └── utils/
│       ├── apyhub.ts    # Logic for ApyHub API interaction
│       ├── sendgrid.ts  # Logic for SendGrid API interaction
│       └── slack.ts     # Logic for Slack API interaction
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── wrangler.toml        # Cloudflare Wrangler configuration
```

## 4. Environment Variables (Secrets)

The following secrets must be configured in the Cloudflare Worker environment:

*   `APY_TOKEN`: API token for ApyHub (for ICS generation).
*   `SENDGRID_KEY`: API key for SendGrid (for sending emails).
*   `SLACK_BOOKINGS_URL`: Slack Incoming Webhook URL for success/booking notifications.
*   `SLACK_ERRORS_URL`: Slack Incoming Webhook URL for error notifications. (Note: For the current simplified setup, both may point to the same Slack channel URL).
*   `HMAC_SECRET`: A shared secret for HMAC request verification (planned for future implementation to secure endpoints called by the Bland pathway).

## 5. Key Dependencies

*   `@sendgrid/mail`: Official SendGrid Node.js library for sending emails.
*   `date-fns-tz`: For timezone-aware date formatting, specifically for displaying Pacific Time correctly in emails.
*   `typescript`: For type safety and modern JavaScript development.
*   `wrangler`: Cloudflare CLI for developing and deploying Workers.

## 6. Setup & Deployment

1.  **Clone the repository.**
2.  **Install dependencies:** `npm install`
3.  **Configure Secrets:** Use `wrangler secret put <SECRET_NAME>` to set the environment variables listed above.
4.  **Local Development:** `npm run dev` (starts a local server, typically on `http://localhost:8787`).
5.  **Deployment:** `npm run deploy` (deploys the worker to your Cloudflare account).

## 7. Security Considerations (Future)

*   **HMAC Verification:** Endpoints called directly from the Bland AI pathway (like `/book-email`) should be secured using HMAC signature verification to ensure requests are legitimate. The `HMAC_SECRET` is provisioned for this.
*   **Input Validation:** While basic validation is in place, further sanitization and validation of input data (email formats, date/time string patterns) can enhance robustness.
*   **Error Masking:** Ensure sensitive details from downstream API errors are not exposed in responses to the client (Bland AI), while providing sufficient detail in internal logs and Slack error alerts.

## 8. Future Enhancements / To-Do

*   Implement full HMAC signature verification for requests from the Bland pathway.
*   Enhance `/slack-event` to handle more event types if the worker's responsibilities expand.
*   Refine Slack message formatting using more advanced Block Kit features.
*   Add robust input conversion for Pacific Time in `/book-email` using `date-fns-tz` to accurately handle PST/PDT transitions if it becomes a source of issues (currently relies on a fixed offset for parsing, display formatting is accurate).
*   Implement internal retry logic for calls to ApyHub or SendGrid if transient errors become common. 

## 9. License

MIT License
