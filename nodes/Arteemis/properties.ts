import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, operation: string[]) => ({
	show: { resource: [resource], operation },
});

const contactIdField = (resource: string, operation: string): INodeProperties => ({
	displayName: 'Contact ID',
	name: 'contactId',
	type: 'string',
	required: true,
	default: '',
	description: 'The Arteemis contact ID, from Contact > Create or Update or Contact > Find',
	displayOptions: show(resource, [operation]),
});

export const nodeProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Campaign', value: 'campaign' },
			{ name: 'Contact', value: 'contact' },
			{ name: 'List', value: 'list' },
			{ name: 'Pipeline', value: 'pipeline' },
			{ name: 'Task', value: 'task' },
		],
		default: 'contact',
	},

	// Operations
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a contact',
			},
			{
				name: 'Find',
				value: 'find',
				description: 'Find a contact by email or LinkedIn profile URL',
				action: 'Find a contact',
			},
		],
		default: 'upsert',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['list'] } },
		options: [
			{
				name: 'Add Contact',
				value: 'addContact',
				description: 'Put an existing contact in one of your lists',
				action: 'Add a contact to a list',
			},
		],
		default: 'addContact',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['campaign'] } },
		options: [
			{
				name: 'Enroll Contact',
				value: 'enrollContact',
				description: 'Add a contact to a campaign, which then sends its sequence on its schedule',
				action: 'Enroll a contact in a campaign',
			},
		],
		default: 'enrollContact',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['pipeline'] } },
		options: [
			{
				name: 'Add or Move Contact',
				value: 'addOrMove',
				description:
					'Put a contact in your pipeline, or move them to a stage. Adding ends their live campaign sequences.',
				action: 'Add or move a contact in the pipeline',
			},
		],
		default: 'addOrMove',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Open a call or a to-do, on a contact or on its own',
				action: 'Create a task',
			},
		],
		default: 'create',
	},

	// Contact > Create or Update
	{
		displayName: 'Full Name',
		name: 'fullName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Claire Martin',
		displayOptions: show('contact', ['upsert']),
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description:
			'Work email. Arteemis uses it, or the LinkedIn profile, to find a contact that already exists.',
		displayOptions: show('contact', ['upsert', 'find']),
	},
	{
		displayName: 'LinkedIn Profile URL',
		name: 'linkedinUrl',
		type: 'string',
		default: '',
		placeholder: 'https://www.linkedin.com/in/claire-martin',
		description:
			'Needed for the LinkedIn steps of a campaign. Find looks it up when no contact has the email.',
		displayOptions: show('contact', ['upsert', 'find']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('contact', ['upsert']),
		options: [
			{
				displayName: 'Add to List Name or ID',
				name: 'listId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLists' },
				default: '',
				description:
					'The list the contact joins, new or existing. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Company',
				name: 'company',
				type: 'string',
				default: '',
				description:
					'The company they work for. Arteemis links the contact to it, and creates it when it does not exist yet.',
			},
			{
				displayName: 'Custom Fields',
				name: 'customFields',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Custom Field',
				options: [
					{
						displayName: 'Field',
						name: 'field',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								placeholder: 'industry_segment',
								description: 'Lowercase letters, digits and underscores',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
				description:
					'Used by {{firstName}} in your messages. Guessed from the full name when empty.',
			},
			{
				displayName: 'Job Title',
				name: 'title',
				type: 'string',
				default: '',
				placeholder: 'Head of Sales',
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
			},
		],
	},

	// List > Add Contact
	{
		displayName: 'List Name or ID',
		name: 'listId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLists' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: show('list', ['addContact']),
	},
	contactIdField('list', 'addContact'),

	// Campaign > Enroll Contact
	{
		displayName: 'Campaign Name or ID',
		name: 'campaignId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getCampaigns' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: show('campaign', ['enrollContact']),
	},
	contactIdField('campaign', 'enrollContact'),

	// Pipeline > Add or Move Contact
	contactIdField('pipeline', 'addOrMove'),
	{
		displayName: 'Stage Name or ID',
		name: 'stage',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getStages' },
		default: '',
		description:
			'Leave empty to add the contact to the first column. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: show('pipeline', ['addOrMove']),
	},

	// Task > Create
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Call Claire about the pilot',
		displayOptions: show('task', ['create']),
	},
	{
		displayName: 'Due',
		name: 'dueAt',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'When it should be done',
		displayOptions: show('task', ['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('task', ['create']),
		options: [
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
				description: 'The Arteemis contact the task is about',
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{
				displayName: 'Type',
				name: 'kind',
				type: 'options',
				options: [
					{ name: 'Call', value: 'call' },
					{ name: 'To-Do', value: 'todo' },
				],
				default: 'call',
			},
		],
	},
];
