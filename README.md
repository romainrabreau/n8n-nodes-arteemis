# n8n-nodes-arteemis

The [Arteemis](https://arteemis.xyz) nodes for n8n. Arteemis runs B2B outreach: email and LinkedIn campaigns, a unified inbox, a pipeline and tasks.

- **Arteemis Trigger** starts a workflow when a contact replies, a status changes, a lead enters or leaves a campaign, a message leaves, a LinkedIn invitation is accepted, a task opens, a deal changes stage or a background job ends.
- **Arteemis** creates or updates contacts, finds them, adds them to lists, enrolls them in campaigns, moves them in the pipeline and opens tasks.

## Installation

In n8n, open **Settings > Community Nodes**, choose **Install** and enter `n8n-nodes-arteemis`. See the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

In Arteemis, open **Integrations > API** and create a **workspace key** (`art_key_...`). In n8n, create an **Arteemis API** credential and paste it as the API key. Leave the base URL at `https://api.arteemis.xyz/api/v1`.

A personal token (`art_pat_...`) also works for the actions, with your own role. The trigger manages webhooks, which needs a workspace key or the admin role.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| Contact | Create or Update | Adds a person, or updates the contact with the same email or LinkedIn profile. Optional company, list and custom fields. |
| Contact | Find | Finds a contact by email or LinkedIn profile URL. No match outputs no item. |
| List | Add Contact | Puts an existing contact in one of your person lists. |
| Campaign | Enroll Contact | Adds a contact to a campaign, which then sends its sequence on its schedule. |
| Pipeline | Add or Move Contact | Puts a contact in the pipeline, or moves them to a stage. Adding ends their live campaign sequences. |
| Task | Create | Opens a call or a to-do, on a contact or on its own. |

Lists, campaigns and pipeline stages are offered in dropdowns.

## Trigger

Choose one or more events. When the workflow is activated (or while you listen for a test event), the node registers its webhook URL in Arteemis; it removes it when the workflow is deactivated. Arteemis calls within a minute of the event, with a JSON body:

```json
{
  "id": "message:1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b",
  "type": "message.received",
  "occurred_at": "2026-10-27T09:12:44.000Z",
  "workspace_id": "org_...",
  "data": {
    "message": { "id": "...", "channel": "email", "received_at": "2026-10-27T09:12:40.000Z" },
    "contact": { "id": "...", "full_name": "Claire Martin", "email": "...", "linkedin_url": "...", "title": "...", "organization": "...", "lead_status": "replied", "reply_kind": "interested", "custom_fields": {} },
    "campaign": { "id": "...", "name": "Q4 Heads of Sales" },
    "enrollment_id": "..."
  }
}
```

**Verify Signature** (on by default) checks each call against the signing secret Arteemis returns when the webhook is created (Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature`) and answers 401 to anything else.

Arteemis only calls HTTPS URLs on a public host: an n8n reachable at `http://localhost:5678` cannot receive events. Use a public HTTPS address (n8n Cloud, or `WEBHOOK_URL` set on a self-hosted instance). A delivery is retried for about 21 hours, so use `id` to skip a repeat.

## Example

New reply to CRM: **Arteemis Trigger** on *New Reply* > **IF** `{{ $json.data.contact.reply_kind }}` is `interested` > your CRM node, with `{{ $json.data.contact.email }}` and `{{ $json.data.campaign.name }}`.

Inbound lead to campaign: **Webhook** (your form) > **Arteemis** *Contact: Create or Update* > **Arteemis** *Campaign: Enroll Contact* with `{{ $json.id }}`.

## Compatibility

Built with `@n8n/node-cli` 0.54 (n8n nodes API version 1). No runtime dependency.

## Resources

- [Arteemis API guide](https://api.arteemis.xyz/api/v1) (every tool, webhooks and their payloads)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
