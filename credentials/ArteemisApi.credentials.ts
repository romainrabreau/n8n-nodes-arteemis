import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ArteemisApi implements ICredentialType {
	name = 'arteemisApi';

	displayName = 'Arteemis API';

	icon: Icon = { light: 'file:../icons/arteemis.svg', dark: 'file:../icons/arteemis.dark.svg' };

	documentationUrl = 'https://api.arteemis.xyz/api/v1';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'A workspace key (art_key_...) from Integrations > API in Arteemis. A personal token (art_pat_...) also works, but only an admin can set up the trigger.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.arteemis.xyz/api/v1',
			description: 'Leave as is unless Arteemis gave you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// workspaces_list is a free read any valid token may call.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/tools/workspaces_list',
			method: 'POST',
			body: {},
		},
	};
}
