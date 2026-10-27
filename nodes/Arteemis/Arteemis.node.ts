import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { arteemisApiRequest } from './GenericFunctions';
import { nodeProperties } from './properties';

/** The fields of a contacts_get record a workflow is likely to use. */
function shapeContact(record: IDataObject): IDataObject {
	return {
		id: record.id,
		name: record.name,
		firstName: record.firstName,
		lastName: record.lastName,
		email: record.email,
		phone: record.phoneNumber,
		linkedinUrl: record.linkedinUrl,
		title: record.currentTitle,
		company: record.organizationName || record.currentCompany,
		companyDomain: record.companyDomain,
		location: record.location,
		leadStatus: record.leadStatus,
		replyKind: record.replyKind,
		customFields: record.customFields || {},
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}

/** Keeps the filled values only, trimmed. */
function filled(values: Record<string, unknown>): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(values)) {
		const clean = typeof value === 'string' ? value.trim() : value;
		if (clean !== undefined && clean !== null && clean !== '') {
			out[key] = clean as IDataObject[string];
		}
	}
	return out;
}

async function upsertContact(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const pairs = ((extra.customFields as IDataObject | undefined)?.field ?? []) as Array<{
		key: string;
		value: string;
	}>;
	const customFields = Object.fromEntries(pairs.map(({ key, value }) => [key.trim(), value]));
	const person = filled({
		full_name: this.getNodeParameter('fullName', i),
		email: this.getNodeParameter('email', i, ''),
		linkedin_url: this.getNodeParameter('linkedinUrl', i, ''),
		first_name: extra.firstName,
		last_name: extra.lastName,
		role: extra.title,
		phone: extra.phone,
	});
	const hasCustom = Object.keys(customFields).length > 0;
	const listId = (extra.listId as string | undefined) || undefined;

	// Arteemis matches a person on email first, then LinkedIn profile: create answers the existing contact.
	const { data: created } = await arteemisApiRequest.call(this, 'contacts_manage', {
		operation: 'create',
		contact: {
			kind: 'person',
			...person,
			...filled({ organization_name: extra.company }),
			...(hasCustom ? { custom_fields: customFields } : {}),
		},
		...(listId ? { list_id: listId } : {}),
	});

	let updated = false;
	if (created.existed) {
		const patch: IDataObject = { ...person };
		if (hasCustom) patch.custom_fields = customFields;
		if (created.organization_id) patch.organization_id = created.organization_id;
		await arteemisApiRequest.call(this, 'contacts_manage', {
			operation: 'update',
			contact_id: created.contact_id,
			patch,
		});
		updated = true;
	}
	return {
		id: created.contact_id,
		created: !created.existed,
		updated,
		organizationId: created.organization_id ?? null,
		listId: listId ?? null,
	};
}

async function findContact(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const entry = filled({
		email: this.getNodeParameter('email', i, ''),
		linkedin_url: this.getNodeParameter('linkedinUrl', i, ''),
	});
	if (Object.keys(entry).length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Give an email or a LinkedIn profile URL to look for',
			{
				itemIndex: i,
			},
		);
	}
	// match looks the email up first, then the LinkedIn profile, the way Arteemis deduplicates contacts.
	const { data: matched } = await arteemisApiRequest.call(this, 'contacts_query', {
		match: [{ kind: 'person', ...entry }],
	});
	const rows = (matched.rows ?? []) as IDataObject[];
	const contactId = rows[0]?.contact_id as string | null | undefined;
	if (!contactId) return [];
	const { data: record } = await arteemisApiRequest.call(this, 'contacts_get', {
		contact_id: contactId,
	});
	return [shapeContact(record)];
}

async function run(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const resource = this.getNodeParameter('resource', i) as string;
	const operation = this.getNodeParameter('operation', i) as string;
	const contactId = () => (this.getNodeParameter('contactId', i) as string).trim();

	if (resource === 'contact' && operation === 'upsert') return [await upsertContact.call(this, i)];
	if (resource === 'contact' && operation === 'find') return await findContact.call(this, i);

	if (resource === 'list' && operation === 'addContact') {
		const listId = this.getNodeParameter('listId', i) as string;
		const { data } = await arteemisApiRequest.call(this, 'contact_lists_manage', {
			operation: 'add_contacts',
			list_id: listId,
			contact_ids: [contactId()],
		});
		return [{ listId, contactId: contactId(), added: data.added, listTotal: data.total }];
	}

	if (resource === 'campaign' && operation === 'enrollContact') {
		const campaignId = this.getNodeParameter('campaignId', i) as string;
		// campaigns_enroll runs as a background job: the contact is in the campaign within seconds.
		const { data, job_id: jobId } = await arteemisApiRequest.call(this, 'campaigns_enroll', {
			campaign_id: campaignId,
			contact_ids: [contactId()],
		});
		return [
			{ campaignId, contactId: contactId(), jobId: jobId ?? data.id, jobStatus: data.status },
		];
	}

	if (resource === 'pipeline' && operation === 'addOrMove') {
		const stage = this.getNodeParameter('stage', i, '') as string;
		// add leaves anyone already in the pipeline where they are; move then sends them to the stage.
		const { data: added } = await arteemisApiRequest.call(this, 'deals_manage', {
			operation: 'add',
			contact_ids: [contactId()],
		});
		const result: IDataObject = {
			contactId: contactId(),
			added: ((added.added_contact_ids as string[] | undefined) ?? []).length > 0,
			stoppedEnrollments: added.stopped_enrollments,
			stage: added.stage,
			stageId: null,
		};
		if (stage) {
			const { data: moved } = await arteemisApiRequest.call(this, 'deals_manage', {
				operation: 'move',
				contact_id: contactId(),
				stage,
			});
			result.stage = moved.stage;
			result.stageId = moved.stage_id;
		}
		return [result];
	}

	if (resource === 'task' && operation === 'create') {
		const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const due = new Date(this.getNodeParameter('dueAt', i) as string);
		if (Number.isNaN(due.getTime())) {
			throw new NodeOperationError(this.getNode(), 'Due is not a date Arteemis can read', {
				itemIndex: i,
			});
		}
		const kind = (extra.kind as string | undefined) || 'call';
		// The API takes an instant in UTC (2026-10-27T17:00:00Z).
		const body: IDataObject = {
			operation: 'create',
			title: this.getNodeParameter('title', i) as string,
			kind,
			due_at: due.toISOString(),
			...filled({ note: extra.note, contact_id: extra.contactId }),
		};
		const { data } = await arteemisApiRequest.call(this, 'tasks_manage', body);
		return [
			{
				id: data.task_id,
				title: body.title,
				kind,
				dueAt: body.due_at,
				contactId: body.contact_id ?? null,
			},
		];
	}

	throw new NodeOperationError(this.getNode(), `Unknown operation ${resource}: ${operation}`, {
		itemIndex: i,
	});
}

export class Arteemis implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Arteemis',
		name: 'arteemis',
		icon: { light: 'file:../../icons/arteemis.svg', dark: 'file:../../icons/arteemis.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create contacts, fill lists, enroll campaigns and move your pipeline in Arteemis',
		defaults: {
			name: 'Arteemis',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'arteemisApi',
				required: true,
			},
		],
		properties: nodeProperties,
	};

	methods = {
		loadOptions: {
			async getLists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { data } = await arteemisApiRequest.call(this, 'contact_lists_list');
				// People go into person lists; organization lists take organizations only.
				return (data as unknown as IDataObject[])
					.filter((list) => list.kind === 'person')
					.map((list) => ({ name: list.name as string, value: list.id as string }));
			},

			async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options: INodePropertyOptions[] = [];
				let cursor: string | null | undefined;
				// 50 a page, 5 pages at most: the campaigns not archived.
				for (let page = 0; page < 5; page++) {
					const response = await arteemisApiRequest.call(this, 'campaigns_find', {
						limit: 50,
						...(cursor ? { cursor } : {}),
					});
					for (const row of response.data.rows as IDataObject[]) {
						options.push({ name: `${row.name} (${row.status})`, value: row.id as string });
					}
					cursor = response.next_cursor;
					if (!cursor) break;
				}
				return options;
			},

			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { data } = await arteemisApiRequest.call(this, 'deals_list', {});
				return (data.columns as IDataObject[]).map((column) => ({
					name: column.name as string,
					value: column.id as string,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const results = await run.call(this, i);
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Both constructors hand back an error of their own class unchanged.
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [returnData];
	}
}
