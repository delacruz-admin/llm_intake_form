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

TABLE_NAME = os.environ["TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    """Lambda entry point for /requests endpoints."""
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}

    try:
        if method == "POST":
            return submit_request(event)
        elif method == "GET" and "id" in path_params:
            return get_request(path_params["id"])
        elif method == "GET":
            return list_requests(event)
        else:
            return _response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": "Internal server error"})


def submit_request(event):
    """Create a new intake request from a completed chat session."""
    body = json.loads(event.get("body", "{}"))
    session_id = body.get("session_id", "")

    if not session_id:
        return _response(400, {"error": "session_id is required"})

    # Retrieve extracted fields from the session
    fields_item = table.get_item(
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
        "GSI1SK": f"STATUS#submitted#{now}",
        "request_id": request_id,
        "session_id": session_id,
        "status": "submitted",
        "created_at": now,
        "updated_at": now,
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

    table.put_item(Item=request_data)

    return _response(201, {
        "request_id": request_id,
        "status": "submitted",
        "message": "Intake submitted to ARB queue.",
    })


def get_request(request_id):
    """Get a single request by ID."""
    result = table.get_item(
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

    response = table.query(
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
