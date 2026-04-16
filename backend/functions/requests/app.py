"""
ARB Intake Requests Lambda — CRUD for intake requests.
Handles submit, list, and get-by-ID operations.
"""

import json
import os
import uuid
import time
import boto3
from datetime import datetime

REQUESTS_TABLE = os.environ["REQUESTS_TABLE"]
SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

dynamodb = boto3.resource("dynamodb")
requests_table = dynamodb.Table(REQUESTS_TABLE)
sessions_table = dynamodb.Table(SESSIONS_TABLE)
bedrock = boto3.client("bedrock-runtime")


def handler(event, context):
    """Lambda entry point for /requests endpoints."""
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}

    resource = event.get("resource", "")

    try:
        print(f"Handler: method={method}, resource={resource}, path_params={path_params}")
        if method == "POST" and resource == "/requests":
            return submit_request(event)
        elif method == "POST" and resource == "/drafts":
            return save_draft(event)
        elif method == "PUT" and resource == "/drafts":
            return update_draft(event)
        elif method == "PUT" and "id" in path_params and resource.endswith("/annotations"):
            return update_annotation(path_params["id"], event)
        elif method == "DELETE" and "id" in path_params and resource.endswith("/annotations"):
            return delete_annotation(path_params["id"], event)
        elif method == "PUT" and "id" in path_params:
            return update_request(path_params["id"], event)
        elif method == "DELETE" and "id" in path_params:
            return delete_request(path_params["id"])
        elif method == "POST" and "id" in path_params and resource.endswith("/notes"):
            return add_note(path_params["id"], event)
        elif method == "GET" and "id" in path_params and resource.endswith("/notes"):
            return get_notes(path_params["id"])
        elif method == "PUT" and "id" in path_params and resource.endswith("/notes"):
            return update_note(path_params["id"], event)
        elif method == "DELETE" and "id" in path_params and resource.endswith("/notes"):
            return delete_note(path_params["id"], event)
        elif method == "POST" and "id" in path_params and resource.endswith("/activity"):
            return add_activity(path_params["id"], event)
        elif method == "GET" and "id" in path_params and resource.endswith("/activity"):
            return get_activity(path_params["id"])
        elif method == "PUT" and "id" in path_params and resource.endswith("/activity"):
            return update_activity(path_params["id"], event)
        elif method == "DELETE" and "id" in path_params and resource.endswith("/activity"):
            return delete_activity(path_params["id"], event)
        elif method == "POST" and "id" in path_params and resource.endswith("/annotations"):
            return add_annotation(path_params["id"], event)
        elif method == "GET" and "id" in path_params and resource.endswith("/annotations"):
            return get_annotations(path_params["id"])
        elif method == "GET" and "id" in path_params and resource.endswith("/summary"):
            return generate_summary(path_params["id"])
        elif method == "POST" and "id" in path_params and resource.endswith("/review-chat"):
            return review_chat(path_params["id"], event)
        elif method == "GET" and "id" in path_params:
            return get_request(path_params["id"])
        elif method == "GET":
            return list_requests(event)
        else:
            return _response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": "Internal server error"})


def save_draft(event):
    """Save current intake fields as a draft."""
    body = json.loads(event.get("body", "{}"))
    session_id = body.get("session_id", "")
    fields = body.get("fields", {})
    submitter = body.get("submitter", "")
    submitter_email = body.get("submitter_email", "")

    if not session_id:
        return _response(400, {"error": "session_id is required"})

    # Generate a draft ID
    draft_id = f"ARB-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow().isoformat()

    draft_data = {
        "PK": f"REQUEST#{draft_id}",
        "SK": "META",
        "GSI1PK": "REQUESTS",
        "GSI1SK": f"STATUS#draft#{now}",
        "request_id": draft_id,
        "session_id": session_id,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "submitter": submitter,
        "submitter_email": submitter_email,
    }

    # Copy all fields
    for k, v in fields.items():
        if v and k not in ("submitter", "submitter_email"):
            draft_data[k] = v

    requests_table.put_item(Item=draft_data)

    return _response(201, {
        "request_id": draft_id,
        "status": "draft",
        "message": "Draft saved.",
    })


def update_draft(event):
    """Update an existing draft with current fields."""
    body = json.loads(event.get("body", "{}"))
    request_id = body.get("request_id", "")
    fields = body.get("fields", {})

    if not request_id:
        return _response(400, {"error": "request_id is required"})

    now = datetime.utcnow().isoformat()

    # Build update from fields
    update_parts = ["updated_at = :updated"]
    attr_values = {":updated": now}
    attr_names = {}

    for i, (k, v) in enumerate(fields.items()):
        if k in ("submitter", "submitter_email", "request_id", "session_id", "status", "PK", "SK", "GSI1PK", "GSI1SK"):
            continue
        update_parts.append(f"#{k} = :f{i}")
        attr_names[f"#{k}"] = k
        attr_values[f":f{i}"] = v or ""

    if len(update_parts) <= 1:
        return _response(200, {"message": "Nothing to update."})

    requests_table.update_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": "META"},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeNames=attr_names if attr_names else None,
        ExpressionAttributeValues=attr_values,
    )

    return _response(200, {"request_id": request_id, "message": "Draft updated."})


def submit_request(event):
    """Create a new intake request from a completed chat session."""
    body = json.loads(event.get("body", "{}"))
    session_id = body.get("session_id", "")
    submitter = body.get("submitter", "")
    submitter_email = body.get("submitter_email", "")

    if not session_id:
        return _response(400, {"error": "session_id is required"})

    # Retrieve extracted fields from the session
    fields_item = sessions_table.get_item(
        Key={"PK": f"SESSION#{session_id}", "SK": "FIELDS"}
    ).get("Item", {})

    if not fields_item:
        return _response(400, {"error": "No intake data found for this session"})

    # Generate request ID
    request_id = f"ARB-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow().isoformat()

    # Build request record
    request_data = {
        "PK": f"REQUEST#{request_id}",
        "SK": "META",
        "GSI1PK": "REQUESTS",
        "GSI1SK": f"STATUS#received-pending#{now}",
        "request_id": request_id,
        "session_id": session_id,
        "status": "received-pending",
        "created_at": now,
        "updated_at": now,
        # Submitter (from login)
        "submitter": submitter,
        "submitter_email": submitter_email,
        # Copy fields from session
        "team": fields_item.get("team", ""),
        "poc_name": fields_item.get("poc_name", ""),
        "poc_email": fields_item.get("poc_email", ""),
        "exec_sponsor": fields_item.get("exec_sponsor", ""),
        "request_type": fields_item.get("request_type", ""),
        "app_type": fields_item.get("app_type", ""),
        "title": fields_item.get("title", ""),
        "description": fields_item.get("description", ""),
        "business_outcomes": fields_item.get("business_outcomes", ""),
        "criticality": fields_item.get("criticality", ""),
        "impact_if_not_done": fields_item.get("impact_if_not_done", ""),
        "need_date": fields_item.get("need_date", ""),
        "vendor_name": fields_item.get("vendor_name", ""),
        "discovery_stakeholders": fields_item.get("discovery_stakeholders", ""),
    }

    requests_table.put_item(Item=request_data)

    return _response(201, {
        "request_id": request_id,
        "status": "received-pending",
        "message": "Intake submitted to ARB queue.",
    })


def get_request(request_id):
    """Get a single request by ID."""
    print(f"get_request called with id: '{request_id}'")
    result = requests_table.get_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": "META"}
    )
    item = result.get("Item")
    if not item:
        return _response(404, {"error": "Request not found"})

    # Remove DynamoDB keys from response
    item.pop("PK", None)
    item.pop("SK", None)
    item.pop("GSI1PK", None)
    item.pop("GSI1SK", None)

    return _response(200, item)


def list_requests(event):
    """List all requests, optionally filtered by status."""
    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status", "")

    response = requests_table.query(
        IndexName="GSI1",
        KeyConditionExpression="GSI1PK = :pk"
        + (" AND begins_with(GSI1SK, :sk)" if status_filter else ""),
        ExpressionAttributeValues={
            ":pk": "REQUESTS",
            **(
                {":sk": f"STATUS#{status_filter}"}
                if status_filter
                else {}
            ),
        },
        ScanIndexForward=False,
    )

    items = []
    for item in response.get("Items", []):
        item.pop("PK", None)
        item.pop("SK", None)
        item.pop("GSI1PK", None)
        item.pop("GSI1SK", None)
        items.append(item)

    return _response(200, {"requests": items, "count": len(items)})


VALID_STATUSES = [
    "received-pending", "under-review", "accepted-discovery",
    "in-backlog", "active", "deferred",
]

VALID_CRITICALITIES = ["Emergency", "High", "Medium", "Low"]


def update_request(request_id, event):
    """Update request fields: status, assigned_to, criticality, target_date."""
    body = json.loads(event.get("body", "{}"))

    # Build update expression dynamically from allowed fields
    allowed = {}
    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            return _response(400, {"error": f"Invalid status. Must be one of: {VALID_STATUSES}"})
        allowed["status"] = body["status"]
    if "assigned_to" in body:
        allowed["assigned_to"] = body["assigned_to"]
    if "criticality" in body:
        if body["criticality"] not in VALID_CRITICALITIES:
            return _response(400, {"error": f"Invalid criticality. Must be one of: {VALID_CRITICALITIES}"})
        allowed["criticality"] = body["criticality"]
    if "target_date" in body:
        allowed["target_date"] = body["target_date"]
    if "promised_date" in body:
        allowed["promised_date"] = body["promised_date"]

    if not allowed:
        return _response(400, {"error": "No valid fields to update"})

    allowed["updated_at"] = datetime.utcnow().isoformat()

    # Build the update expression
    update_parts = []
    attr_names = {}
    attr_values = {}
    for i, (k, v) in enumerate(allowed.items()):
        update_parts.append(f"#{k} = :v{i}")
        attr_names[f"#{k}"] = k
        attr_values[f":v{i}"] = v

    # Also update GSI1SK if status changed
    if "status" in allowed:
        update_parts.append("GSI1SK = :gsi1sk")
        attr_values[":gsi1sk"] = f"STATUS#{allowed['status']}#{allowed['updated_at']}"

    requests_table.update_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": "META"},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
        ConditionExpression="attribute_exists(PK)",
    )

    return _response(200, {
        "request_id": request_id,
        "updated": list(allowed.keys()),
        "message": "Request updated.",
    })


def add_note(request_id, event):
    """Add a triage note to a request."""
    body = json.loads(event.get("body", "{}"))
    text = body.get("text", "").strip()
    author = body.get("author", "Unknown")

    if not text:
        return _response(400, {"error": "text is required"})

    now = datetime.utcnow().isoformat()
    note_id = uuid.uuid4().hex[:8]

    requests_table.put_item(
        Item={
            "PK": f"REQUEST#{request_id}",
            "SK": f"NOTE#{now}#{note_id}",
            "note_id": note_id,
            "text": text,
            "author": author,
            "created_at": now,
        }
    )

    return _response(201, {
        "note_id": note_id,
        "message": "Note added.",
    })


def get_notes(request_id):
    """Get all triage notes for a request."""
    response = requests_table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"REQUEST#{request_id}",
            ":sk": "NOTE#",
        },
        ScanIndexForward=False,
    )

    notes = []
    for item in response.get("Items", []):
        item.pop("PK", None)
        item["sk"] = item.pop("SK", "")
        notes.append(item)

    return _response(200, {"notes": notes, "count": len(notes)})


def update_note(request_id, event):
    """Update a triage note's text."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()
    text = body.get("text", "").strip()

    if not sk or not text:
        return _response(400, {"error": "sk and text are required"})

    now = datetime.utcnow().isoformat()
    requests_table.update_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
        UpdateExpression="SET #t = :t, edited_at = :e",
        ExpressionAttributeNames={"#t": "text"},
        ExpressionAttributeValues={":t": text, ":e": now},
        ConditionExpression="attribute_exists(PK)",
    )

    return _response(200, {"message": "Note updated."})


def delete_note(request_id, event):
    """Delete a single triage note."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()

    if not sk:
        return _response(400, {"error": "sk is required"})

    requests_table.delete_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
    )

    return _response(200, {"message": "Note deleted."})


def add_activity(request_id, event):
    """Add an activity log entry."""
    body = json.loads(event.get("body", "{}"))
    text = body.get("text", "").strip()
    author = body.get("author", "Unknown")
    hours = body.get("hours", None)

    if not text:
        return _response(400, {"error": "text is required"})

    now = datetime.utcnow().isoformat()
    activity_id = uuid.uuid4().hex[:8]

    item = {
        "PK": f"REQUEST#{request_id}",
        "SK": f"ACTIVITY#{now}#{activity_id}",
        "activity_id": activity_id,
        "text": text,
        "author": author,
        "created_at": now,
    }
    if hours is not None:
        item["hours"] = str(hours)

    requests_table.put_item(Item=item)

    return _response(201, {"activity_id": activity_id, "message": "Activity logged."})


def get_activity(request_id):
    """Get all activity log entries for a request."""
    response = requests_table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"REQUEST#{request_id}",
            ":sk": "ACTIVITY#",
        },
        ScanIndexForward=False,
    )

    entries = []
    for item in response.get("Items", []):
        item.pop("PK", None)
        item["sk"] = item.pop("SK", "")
        entries.append(item)

    return _response(200, {"activity": entries, "count": len(entries)})


def update_activity(request_id, event):
    """Update an activity log entry."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()
    text = body.get("text", "").strip()
    hours = body.get("hours", None)

    if not sk or not text:
        return _response(400, {"error": "sk and text are required"})

    now = datetime.utcnow().isoformat()
    update_expr = "SET #t = :t, edited_at = :e"
    attr_names = {"#t": "text"}
    attr_values = {":t": text, ":e": now}

    if hours is not None:
        update_expr += ", hours = :h"
        attr_values[":h"] = str(hours)

    requests_table.update_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
        ConditionExpression="attribute_exists(PK)",
    )

    return _response(200, {"message": "Activity updated."})


def delete_activity(request_id, event):
    """Delete an activity log entry."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()

    if not sk:
        return _response(400, {"error": "sk is required"})

    requests_table.delete_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
    )

    return _response(200, {"message": "Activity deleted."})


def add_annotation(request_id, event):
    """Add a field-level annotation to a request."""
    body = json.loads(event.get("body", "{}"))
    field_name = body.get("field_name", "").strip()
    text = body.get("text", "").strip()
    author = body.get("author", "Unknown")

    if not field_name or not text:
        return _response(400, {"error": "field_name and text are required"})

    now = datetime.utcnow().isoformat()
    annotation_id = uuid.uuid4().hex[:8]

    requests_table.put_item(
        Item={
            "PK": f"REQUEST#{request_id}",
            "SK": f"ANNOT#{field_name}#{now}#{annotation_id}",
            "annotation_id": annotation_id,
            "field_name": field_name,
            "text": text,
            "author": author,
            "created_at": now,
        }
    )

    return _response(201, {
        "annotation_id": annotation_id,
        "message": "Annotation added.",
    })


def get_annotations(request_id):
    """Get all field-level annotations for a request."""
    response = requests_table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"REQUEST#{request_id}",
            ":sk": "ANNOT#",
        },
        ScanIndexForward=True,
    )

    annotations = []
    for item in response.get("Items", []):
        item.pop("PK", None)
        # Keep SK so frontend can reference it for edits/deletes
        item["sk"] = item.pop("SK", "")
        annotations.append(item)

    return _response(200, {"annotations": annotations})


def update_annotation(request_id, event):
    """Update an existing annotation's text."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()
    text = body.get("text", "").strip()

    if not sk or not text:
        return _response(400, {"error": "sk and text are required"})

    now = datetime.utcnow().isoformat()
    requests_table.update_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
        UpdateExpression="SET #t = :t, edited_at = :e",
        ExpressionAttributeNames={"#t": "text"},
        ExpressionAttributeValues={":t": text, ":e": now},
        ConditionExpression="attribute_exists(PK)",
    )

    return _response(200, {"message": "Annotation updated."})


def delete_annotation(request_id, event):
    """Delete a single annotation."""
    body = json.loads(event.get("body", "{}"))
    sk = body.get("sk", "").strip()

    if not sk:
        return _response(400, {"error": "sk is required"})

    requests_table.delete_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": sk},
    )

    return _response(200, {"message": "Annotation deleted."})


def generate_summary(request_id):
    """Generate an LLM summary of the intake request."""
    result = requests_table.get_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": "META"}
    )
    item = result.get("Item")
    if not item:
        return _response(404, {"error": "Request not found"})

    # Build context from all fields
    fields_text = "\n".join(
        f"{k}: {v}" for k, v in item.items()
        if k not in ("PK", "SK", "GSI1PK", "GSI1SK", "session_id") and v
    )

    prompt = f"""Summarize this technology infrastructure intake request in 2-3 concise sentences for an Architecture Review Board reviewer. Focus on what is being requested, why it matters, and any key constraints or risks. Do not use bullet points.

Request data:
{fields_text}"""

    try:
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 200, "temperature": 0.3},
        )
        summary = response["output"]["message"]["content"][0]["text"]
        return _response(200, {"summary": summary})
    except Exception as e:
        print(f"Summary generation error: {e}")
        return _response(500, {"error": "Failed to generate summary"})


def review_chat(request_id, event):
    """Chat with the AI about a specific request during review."""
    body = json.loads(event.get("body", "{}"))
    user_message = body.get("message", "").strip()
    history = body.get("history", [])

    if not user_message:
        return _response(400, {"error": "message is required"})

    # Load the request data for context
    result = requests_table.get_item(
        Key={"PK": f"REQUEST#{request_id}", "SK": "META"}
    )
    item = result.get("Item")
    if not item:
        return _response(404, {"error": "Request not found"})

    fields_text = "\n".join(
        f"{k}: {v}" for k, v in item.items()
        if k not in ("PK", "SK", "GSI1PK", "GSI1SK", "session_id") and v
    )

    # Load annotations for additional context
    annot_response = requests_table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"REQUEST#{request_id}",
            ":sk": "ANNOT#",
        },
    )
    annotations_text = ""
    for a in annot_response.get("Items", []):
        annotations_text += f"\n- [{a.get('field_name', '')}] {a.get('author', '')}: {a.get('text', '')}"

    system_prompt = f"""You are an Architecture Review Board assistant helping a reviewer analyze a technology infrastructure intake request. Answer questions about this request concisely and accurately based on the data provided. If something isn't in the data, say so.

REQUEST DATA:
{fields_text}

{"REVIEWER ANNOTATIONS:" + annotations_text if annotations_text else ""}

Keep responses concise — 2-4 sentences unless the reviewer asks for more detail. Focus on facts from the request data. You can highlight risks, gaps, or things that need clarification."""

    # Build messages for Bedrock
    messages = []
    for msg in history:
        messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}],
        })
    messages.append({
        "role": "user",
        "content": [{"text": user_message}],
    })

    try:
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=messages,
            system=[{"text": system_prompt}],
            inferenceConfig={"maxTokens": 500, "temperature": 0.5},
        )
        reply = response["output"]["message"]["content"][0]["text"]
        return _response(200, {"message": reply})
    except Exception as e:
        print(f"Review chat error: {e}")
        return _response(500, {"error": "Failed to generate response"})


def delete_request(request_id):
    """Delete a request and all its notes and attachments."""
    # Query all items for this request (META, NOTEs, ATTACHments)
    response = requests_table.query(
        KeyConditionExpression="PK = :pk",
        ExpressionAttributeValues={":pk": f"REQUEST#{request_id}"},
    )

    items = response.get("Items", [])
    if not items:
        return _response(404, {"error": "Request not found"})

    # Batch delete all items
    with requests_table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})

    return _response(200, {
        "request_id": request_id,
        "deleted_items": len(items),
        "message": "Request deleted.",
    })


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }
