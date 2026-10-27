import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type Context = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

/** What every tool answers: `{summary, data, next_cursor?, job_id?}`. */
export interface Envelope {
	summary: string;
	data: IDataObject;
	next_cursor?: string | null;
	job_id?: string;
}

/**
 * Calls one Arteemis tool: `POST {baseUrl}/tools/{tool}` with its arguments as the JSON body.
 * A refusal answers `{error: {code, message}}`, which NodeApiError shows as the description.
 */
export async function arteemisApiRequest(
	this: Context,
	tool: string,
	body: IDataObject = {},
): Promise<Envelope> {
	const credentials = await this.getCredentials('arteemisApi');
	const baseUrl = String(credentials.baseUrl || 'https://api.arteemis.xyz/api/v1').replace(
		/\/+$/,
		'',
	);
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}/tools/${tool}`,
		body,
		json: true,
	};
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'arteemisApi',
			options,
		)) as Envelope;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
