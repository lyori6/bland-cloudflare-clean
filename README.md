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

---
