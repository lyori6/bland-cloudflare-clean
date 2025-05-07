// src/utils/apyhub.ts
import { formatInTimeZone } from 'date-fns-tz'; // Make sure this is imported

export interface BookingDetails {
	name: string;
	email: string;
	startTimeISO: string; // This is UTC
}

const APYHUB_ICAL_URL = 'https://api.apyhub.com/generate/ical/file?output=invite.ics';

export async function generateICS(details: BookingDetails, apiToken: string): Promise<string> {
	console.log(`Generating ICS via ApyHub for: ${details.email}. Input UTC: ${details.startTimeISO}`);

	const pacificTimeZone = 'America/Los_Angeles';
	const utcStartDate = new Date(details.startTimeISO);
	const utcEndDate = new Date(utcStartDate.getTime() + 30 * 60 * 1000); // 30 min duration

	// Convert UTC start and end times to Pacific Time strings for ApyHub
	const meetingDatePT = formatInTimeZone(utcStartDate, pacificTimeZone, 'dd-MM-yyyy'); // DD-MM-YYYY
	const startTimePT = formatInTimeZone(utcStartDate, pacificTimeZone, 'HH:mm');      // HH:MM
	const endTimePT = formatInTimeZone(utcEndDate, pacificTimeZone, 'HH:mm');          // HH:MM

	console.log(`Derived Pacific Time for ApyHub: Date=${meetingDatePT}, Start=${startTimePT}, End=${endTimePT}`);

	const requestBody = {
		summary: `Interview: ${details.name}`,
		description: `Bland AI Support Engineer Interview Slot for ${details.name}. Please be ready!`,
		organizer_email: 'hello@debtcat.com',
		attendees_emails: [details.email],
		time_zone: pacificTimeZone, // Explicitly 'America/Los_Angeles'

		// Provide date and time components in Pacific Time
		meeting_date: meetingDatePT,    // e.g., "12-05-2025" (Pacific Time date)
		start_time: startTimePT,        // e.g., "12:00" (Pacific Time)
		end_time: endTimePT,            // e.g., "12:30" (Pacific Time)
		
		// OMIT start_date_time and end_date_time to avoid ApyHub confusion
		// start_date_time: utcStartDate.toISOString(), // DO NOT SEND if sending components
		// end_date_time: utcEndDate.toISOString(),     // DO NOT SEND if sending components

		organizer_name: 'Bland AI Recruiting',
	};

	console.log('Sending body to ApyHub:', JSON.stringify(requestBody));

	try {
		const response = await fetch(APYHUB_ICAL_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apy-token': apiToken,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`ApyHub API Error (${response.status}): ${errorText}`);
			throw new Error(`Failed to generate ICS: ApyHub returned status ${response.status} - ${errorText}`);
		}

		const icsContent = await response.text();
		console.log('Successfully generated ICS content from ApyHub.');
		return icsContent;

	} catch (error) {
		console.error('Error calling ApyHub:', error);
		throw error;
	}
}