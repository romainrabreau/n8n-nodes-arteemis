import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { arteemisApiRequest } from '../Arteemis/GenericFunctions';

type Headers = ReturnType<IWebhookFunctions['getHeaderData']>;

/** How far a signature's timestamp may be from now, either way (Standard Webhooks). */
const TOLERANCE_SECONDS = 5 * 60;

interface Endpoint extends IDataObject {
	id: string;
	url: string;
	events: string[];
}

/**
 * Standard Webhooks: `webhook-signature` holds `v1,<base64 HMAC-SHA256>` entries, separated by spaces, of
 * `<webhook-id>.<webhook-timestamp>.<raw body>` keyed with the base64 that follows `whsec_` in the secret.
 */
export function isValidSignature(
	secret: string,
	headers: Headers,
	rawBody: Buffer | string,
	nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
	const id = headers['webhook-id'];
	const timestamp = headers['webhook-timestamp'];
	const signatures = headers['webhook-signature'];
	if (typeof id !== 'string' || typeof timestamp !== 'string' || typeof signatures !== 'string') {
		return false;
	}
	const sentAt = Number.parseInt(timestamp, 10);
	if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > TOLERANCE_SECONDS) {
		return false;
	}
	const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();
	return signatures.split(' ').some((entry) => {
		const [version, signature] = entry.split(',');
		if (version !== 'v1' || !signature) return false;
		const given = Buffer.from(signature, 'base64');
		return given.length === expected.length && timingSafeEqual(given, expected);
	});
}

const sameEvents = (a: string[], b: string[]) =>
	a.length === b.length && [...a].sort().join() === [...b].sort().join();

export class ArteemisTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'arteemis Trigger',
		name: 'arteemisTrigger',
		icon: { light: 'file:../../icons/arteemis.svg', dark: 'file:../../icons/arteemis.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in your arteemis workspace',
		defaults: {
			name: 'arteemis Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'arteemisApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['message.received'],
				description: 'What starts the workflow',
				options: [
					{
						name: 'Background Job Finished',
						value: 'job.finished',
						description: 'An enrichment, a signals run, an import or an enrollment ended',
					},
					{
						name: 'Contact Status Changed',
						value: 'contact.status_changed',
						description:
							'New, in campaign, paused, replied (with the kind of reply), client or do not contact',
					},
					{
						name: 'Lead Entered Campaign',
						value: 'enrollment.started',
					},
					{
						name: 'Lead Left Campaign',
						value: 'enrollment.ended',
						description:
							'With the reason: finished, replied, wrong person, unsubscribed, bounced, no channel, removed by hand',
					},
					{
						name: 'LinkedIn Invitation Accepted',
						value: 'invitation.accepted',
						description: 'Someone accepted an invitation one of your campaigns sent',
					},
					{
						name: 'Message Sent',
						value: 'message.sent',
						description: 'An email, a LinkedIn message or a LinkedIn invitation left for a contact',
					},
					{
						name: 'New Reply',
						value: 'message.received',
						description: 'A contact replied by email or on LinkedIn',
					},
					{
						name: 'New Task',
						value: 'task.created',
						description: 'A reply to answer, a call, a to-do or a message waiting for approval',
					},
					{
						name: 'Pipeline Stage Changed',
						value: 'deal.stage_changed',
						description: 'A person entered the pipeline or moved to another stage',
					},
				],
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to refuse calls not signed with the secret arteemis gave when the webhook was created',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.endpointId) return false;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const { data } = await arteemisApiRequest.call(this, 'webhooks_list', {});
				const endpoint = (data.endpoints as Endpoint[]).find(
					(item) => item.id === staticData.endpointId,
				);
				return Boolean(
					endpoint &&
					endpoint.url === webhookUrl &&
					endpoint.status === 'active' &&
					sameEvents(endpoint.events, events),
				);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				// The URL belongs to this node alone: an endpoint already on it is a leftover, removed first.
				const { data: listed } = await arteemisApiRequest.call(this, 'webhooks_list', {});
				for (const endpoint of listed.endpoints as Endpoint[]) {
					if (endpoint.url === webhookUrl) {
						await arteemisApiRequest.call(this, 'webhooks_manage', {
							operation: 'delete',
							endpoint_id: endpoint.id,
						});
					}
				}
				const { data } = await arteemisApiRequest.call(this, 'webhooks_manage', {
					operation: 'create',
					url: webhookUrl,
					events,
					description: `n8n: ${this.getWorkflow().name ?? this.getNode().name}`.slice(0, 200),
				});
				staticData.endpointId = (data.endpoint as Endpoint).id;
				staticData.secret = data.secret as string;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.endpointId) {
					const { data } = await arteemisApiRequest.call(this, 'webhooks_list', {});
					// Gone already (deleted in arteemis): nothing left to remove.
					const exists = (data.endpoints as Endpoint[]).some(
						(item) => item.id === staticData.endpointId,
					);
					if (exists) {
						await arteemisApiRequest.call(this, 'webhooks_manage', {
							operation: 'delete',
							endpoint_id: staticData.endpointId,
						});
					}
				}
				delete staticData.endpointId;
				delete staticData.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		if (this.getNodeParameter('verifySignature', true) as boolean) {
			const secret = this.getWorkflowStaticData('node').secret as string | undefined;
			const request = this.getRequestObject();
			if (!secret || !isValidSignature(secret, this.getHeaderData(), request.rawBody ?? '')) {
				// A 401 makes arteemis retry, then report the endpoint as failing: never silently dropped.
				this.getResponseObject().status(401).send('Invalid signature').end();
				return { noWebhookResponse: true };
			}
		}
		const body = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		// A test ping, or an event the node no longer listens to: acknowledged, no run.
		if (!events.includes(body.type as string)) {
			return {};
		}
		return { workflowData: [this.helpers.returnJsonArray(body)] };
	}
}
