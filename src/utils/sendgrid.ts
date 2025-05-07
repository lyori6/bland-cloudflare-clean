// src/utils/sendgrid.ts
import sgMail from '@sendgrid/mail';
import { formatInTimeZone } from 'date-fns-tz';

export interface EmailDetails {
	toEmail: string;
	toName: string;
	startTimeISO: string;
	icsContent: string; // Raw ICS text
}

/**
 * Sends an email with an ICS attachment using SendGrid.
 * Automatically CCs lyori6@gmail.com.
 * @param details - Recipient details, time, and the ICS content.
 * @param apiKey - Your SendGrid API Key.
 * @throws Error if the email sending fails.
 */
export async function sendEmailWithICS(details: EmailDetails, apiKey: string): Promise<void> {
	console.log(`Sending email via SendGrid to: ${details.toEmail}, CC: lyori6@gmail.com`);
	sgMail.setApiKey(apiKey); // Set the API key

	const senderEmail = 'hello@debtcat.com'; // Your verified SendGrid sender
	const senderName = 'Bland AI Recruiting';
	
	// Format the date for display in Pacific Time
	const pacificTimeZoneDisplay = 'America/Los_Angeles';
	const dateObjectForDisplay = new Date(details.startTimeISO); // Start with the UTC time from details
	
	// Format for display, e.g., "05/19/2025, 12:00:00 PM PDT"
	const displayTimePacific = formatInTimeZone(
		dateObjectForDisplay, 
		pacificTimeZoneDisplay, 
		'MM/dd/yyyy, hh:mm:ss a zzz'
	);

	const msg = {
		to: {
			email: details.toEmail,
			name: details.toName,
		},
		// Add the CC field here
		cc: [
			{ email: 'lyori6@gmail.com' } // Your CC address
		],
		from: {
			email: senderEmail,
			name: senderName,
		},
		subject: `Interview Confirmation - Bland AI Support Engineer - ${details.toName}`,
		text: `Hi ${details.toName},\n\nYour interview is confirmed for ${displayTimePacific}.\n\nPlease find the calendar invite attached.\n\nBest regards,\n${senderName}\n\n(Raw UTC Time: ${details.startTimeISO})`, // Added raw time for debug
		html: `<p>Hi ${details.toName},</p><p>Your interview is confirmed for <strong>${displayTimePacific}</strong>.</p><p>Please find the calendar invite attached.</p><p>Best regards,<br/>${senderName}</p><p><small>(Raw UTC Time: ${details.startTimeISO})</small></p>`, // Added raw time for debug
		attachments: [
			{
				content: btoa(details.icsContent), // Base64 encode
				filename: 'invite.ics',
				type: 'text/calendar; method=REQUEST',
				disposition: 'attachment',
			},
		],
	};

	try {
		const response = await sgMail.send(msg);
		console.log('SendGrid email sent successfully. Status Code:', response[0].statusCode);
	} catch (error: any) {
		console.error('Error sending email via SendGrid:');
		if (error.response) {
			console.error(JSON.stringify(error.response.body, null, 2));
		} else {
			console.error(error);
		}
		throw new Error('Failed to send confirmation email via SendGrid.');
	}
}