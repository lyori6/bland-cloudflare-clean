// src/utils/slack.ts

export interface SlackMessagePayload {
    blocks: Array<object>; // Array of Slack Block Kit blocks
    // text?: string; // Fallback text for notifications - good practice but optional for now
}

/**
 * Sends a message to a specified Slack webhook URL.
 * @param webhookUrl The Slack incoming webhook URL.
 * @param payload The message payload (Slack Block Kit format recommended).
 * @returns True if the message was sent successfully, false otherwise.
 */
export async function sendSlackMessage(webhookUrl: string, payload: SlackMessagePayload): Promise<boolean> {
    if (!webhookUrl) {
        console.error('Slack webhook URL is undefined. Cannot send message.');
        return false;
    }

    // Log a masked URL for security (shows only part of it)
    const maskedUrl = webhookUrl.includes('services/') ? webhookUrl.substring(0, webhookUrl.indexOf('services/') + 'services/'.length) + '...' : 'Invalid Slack URL';
    console.log(`Sending Slack message to: ${maskedUrl}`);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseText = await response.text(); // Read response text first

        if (!response.ok) {
            console.error(`Slack API Error (${response.status}): ${responseText}`);
            // Attempt to parse if it's JSON, but don't fail if it's just text
            try {
                const errorJson = JSON.parse(responseText);
                console.error('Slack error details (JSON):', errorJson);
            } catch (e) {
                // Not JSON, text already logged
            }
            return false;
        }
        
        console.log('Slack message sent successfully. Response:', responseText);
        // Slack usually returns 'ok' for success.
        return responseText.trim().toLowerCase() === 'ok';

    } catch (error) {
        console.error('Error sending Slack message (network or other exception):', error);
        return false;
    }
}
