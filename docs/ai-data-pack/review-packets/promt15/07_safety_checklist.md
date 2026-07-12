# Safety Checklist

```text
download_endpoint_added=false
download_token_added=false
artifact_bytes_returned=false
public_url_returned=false
full_storage_path_returned=false
provider_credentials_accepted=false
raw_provider_query_accepted=false
provider_direct_call_from_controller=false
provider_mutation_added=false
provider_validate_only_added=false
openai_upload_added=false
action_import_added=false
approval_workflow_added=false
dry_run_live_added=false
phase_3_started=false
cached_create_triggers_sync=false
official_partial_delegate_internal_lifecycle_only=true
new_provider_adapter_added=false
delete_campaign_action_added=false
```

Google Ads safety:

- public controller has no direct provider call
- public create endpoint rejects provider credentials and raw provider query fields
- official/partial work remains behind existing internal lifecycle
- cached create does not source sync

Response safety:

- manifest-only responses
- forbidden response keys stripped
- `responseRedaction` included on public responses
