/**
 * Cloudflare Worker for Bland AI Pathway Enhancements
 * Accepts booking details from Bland webhook and sends email confirmation.
 */

import { generateICS, BookingDetails } from './utils/apyhub';
import { sendEmailWithICS, EmailDetails } from './utils/sendgrid';
import { zonedTimeToUtc, formatInTimeZone } from 'date-fns-tz';
import { sendSlackMessage, SlackMessagePayload } from './utils/slack';

// Define the structure of environment variables (including secrets)
export interface Env {
	APY_TOKEN: string;
	SENDGRID_KEY: string;
	HMAC_SECRET: string;
	SLACK_BOOKINGS_URL?: string;
	SLACK_ERRORS_URL?: string;
}

// Expected input structure from Bland Webhook
interface BlandWebhookInput {
	email?: string;
	interview_date?: string; // Format: DD-MM-YYYY
	interview_time?: string; // Format: HH:MM (Assumed PST)
	// Add other fields from Bland if needed
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method !== 'POST') {
			console.log(`Method Not Allowed: ${request.method} for ${url.pathname}`);
			return new Response('Method Not Allowed', { status: 405 });
		}

		// TODO: Implement HMAC verification

		if (url.pathname === '/book-email') {
			return handleBookEmail(request, env, ctx);
		}

		console.log(`Path Not Found: ${url.pathname}`);
		return new Response('Not Found', { status: 404 });
	},
};

// --- Handler for /book-email ---
async function handleBookEmail(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	console.log(`Handling /book-email request...`);
	// Allow inputData to be undefined initially for safe error handling
	let inputData: BlandWebhookInput | undefined = undefined; 
	let bookingDataForSlack: { name?: string; email?: string } = {};
	let derivedName: string | undefined = undefined;
	let startTimeISO: string | undefined = undefined;
	let bookingDetails: BookingDetails | undefined = undefined; 

	try {
		inputData = await request.json();
		if (inputData && inputData.email) {
			bookingDataForSlack = { 
				name: inputData.email.split('@')[0] || 'Candidate', 
				email: inputData.email 
			};
		} else if (inputData) {
			bookingDataForSlack = { name: 'Candidate (No Email)' };
		}
		if (!inputData || typeof inputData !== 'object') {
			throw new Error("Invalid JSON payload");
		}
		console.log('Received Bland input data:', JSON.stringify(inputData));
		if (!inputData.email || !inputData.interview_date || !inputData.interview_time) {
			const missingFields = ['email', 'interview_date', 'interview_time']
				.filter(field => !inputData![field as keyof BlandWebhookInput])
				.join(', ');
			console.error(`Validation Error: Missing fields - ${missingFields}`);
			throw new Error(`Missing required fields: ${missingFields}`);
		}
		// --- Date/Time Parsing ---
		const dateParts = inputData.interview_date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
		const timeParts = inputData.interview_time.match(/^(\d{2}):(\d{2})$/);
		if (!dateParts || !timeParts) throw new Error('Invalid date or time format.');
		const day = dateParts[1], month = dateParts[2], year = dateParts[3];
		const hour = timeParts[1], minute = timeParts[2];
		const naiveDateTimeString = `${year}-${month}-${day}T${hour}:${minute}:00`;
		const pacificTimeZone = 'America/Los_Angeles';
		const utcDate = zonedTimeToUtc(naiveDateTimeString, pacificTimeZone);
		if (isNaN(utcDate.getTime())) throw new Error('Could not parse Pacific date.');
		startTimeISO = utcDate.toISOString();
		derivedName = inputData.email.split('@')[0] || 'Valued Candidate';
		bookingDetails = {
			name: derivedName,
			email: inputData.email,
			startTimeISO: startTimeISO,
		};
		const pacificTimeZoneDisplay = 'America/Los_Angeles';
		const dateObjectForDisplay = new Date(startTimeISO);
		const displayTimePacific = formatInTimeZone(dateObjectForDisplay, pacificTimeZoneDisplay, 'MM/dd/yyyy, hh:mm:ss a zzz');
		const icsContent = await generateICS(bookingDetails, env.APY_TOKEN);
		const emailDetails: EmailDetails = { 
			toEmail: bookingDetails.email,
			toName: bookingDetails.name,
			startTimeISO: bookingDetails.startTimeISO,
			icsContent: icsContent
		};
		await sendEmailWithICS(emailDetails, env.SENDGRID_KEY);
		console.log(`Successfully processed booking for ${bookingDetails.email}`);
		if (env.SLACK_BOOKINGS_URL) {
			const successMessageBlocks: Array<object> = [
				{ type: 'section', text: { type: 'mrkdwn', text: '✅ *New Interview Booked!*' } },
				{ type: 'divider' },
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*Applicant:* ${bookingDetails.name || 'N/A'}` },
						{ type: 'mrkdwn', text: `*Email:* ${bookingDetails.email || 'N/A'}` },
						{ type: 'mrkdwn', text: `*Time (PT):* ${displayTimePacific}` },
						{ type: 'mrkdwn', text: `*Calendar Invite:* Sent Successfully!` },
					],
				},
			];
			const slackPayload: SlackMessagePayload = { blocks: successMessageBlocks };
			ctx.waitUntil(
				sendSlackMessage(env.SLACK_BOOKINGS_URL, slackPayload)
					.then(sent => {
						if (sent) console.log("Success Slack notification sent.");
						else console.error("Failed to send success Slack notification.");
					})
			);
		} else {
			console.warn("SLACK_BOOKINGS_URL not configured. Skipping success notification.");
		}
		return new Response(JSON.stringify({ success: true, message: 'Booking confirmed and email sent.' }), {
			status: 200, headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('Error processing booking:', error.message || error);
		if (env.SLACK_ERRORS_URL) {
			const failureMessageBlocks: Array<object> = [
				{ type: 'section', text: { type: 'mrkdwn', text: '❌ *Interview Booking Failed!*' } },
				{ type: 'divider' },
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*Applicant Email:* ${bookingDataForSlack.email || (inputData ? inputData.email : 'N/A')}` },
						{ type: 'mrkdwn', text: `*Error Details:* ${error.message || 'Unknown internal error'}` },
					],
				},
			];
			const slackPayload: SlackMessagePayload = { blocks: failureMessageBlocks };
			ctx.waitUntil(
				sendSlackMessage(env.SLACK_ERRORS_URL, slackPayload)
					.then(sent => {
						if (sent) console.log("Failure Slack notification sent.");
						else console.error("Failed to send failure Slack notification.");
					})
			);
		} else {
			console.warn("SLACK_ERRORS_URL not configured. Skipping failure notification.");
		}
		return new Response(JSON.stringify({ success: false, error: error.message || 'Failed to process booking due to an internal error.' }), {
			status: 500, headers: { 'Content-Type': 'application/json' },
		});
	}
}