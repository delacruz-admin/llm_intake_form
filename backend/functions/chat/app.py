"""
ARB Intake Chat Lambda — handles conversational intake via Amazon Bedrock.
Maintains chat history in DynamoDB per session, extracts structured fields
from the LLM response, and returns both the assistant message and updated fields.
"""

import json
import os
import uuid
import time
import boto3
from datetime import datetime

TABLE_NAME = os.environ["SESSIONS_TABLE"]
MODEL_ID = os.environ["BEDROCK_MODEL_ID"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
bedrock = boto3.client("bedrock-runtime")

SYSTEM_PROMPT = """You are the ARB Intake Assistant for the Enterprise Architecture and Technology Infrastructure team. Your job is to guide requestors through submitting a Technology Infrastructure intake request through friendly, efficient conversation.

CORE RULES:
1. Collect information for these sections in order:
   - A1: Requestor Information (team, poc_name, poc_email, exec_sponsor)
   - A2: Request Details (request_type, app_type, title, description)
   - A3: Business Context (business_outcomes, criticality, impact_if_not_done, need_date)
   - A4: Dependencies (vendor_name, discovery_stakeholders)

2. Ask about one section at a time. Don't overwhelm the user.

3. After each user response, output a JSON block with extracted fields:
   <extracted_fields>
   {"field_name": "value", ...}
   </extracted_fields>
   Only include fields that were mentioned. Use null for fields explicitly stated as none/N/A.

4. Valid request_type values: New Service, Enhancement, Advisory, Compliance
5. Valid criticality values: Emergency, High, Medium, Low
6. Valid app_type values: Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, Other

7. When all required fields are collected, summarize and ask the user to confirm before submission.

8. Keep your tone warm but efficient — EA people are busy."""


def get_session_messages(session_id: str) -> list:
    """Retrieve conversation history from DynamoDB."""
    response = table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"SESSION#{session_id}",
            ":sk": "MSG#",
        },
        ScanIndexForward=True,
    )
    return [
        {"role": item["role"], "content": item["content"]}
        for item in response.get("Items", [])
    ]


def save_message(session_id: str, role: str, content: str):
    """Persist a single message to DynamoDB."""
    table.put_item(
        Item={
            "PK": f"SESSION#{session_id}",
            "SK": f"MSG#{datetime.utcnow().isoformat()}",
            "role": role,
            "content": content,
            "timestamp": int(time.time()),
        }
    )


def save_extracted_fields(session_id: str, fields: dict):
    """Update extracted intake fields for this session."""
    if not fields:
        return
    table.update_item(
        Key={"PK": f"SESSION#{session_id}", "SK": "FIELDS"},
        UpdateExpression="SET "
        + ", ".join(f"#{k} = :v{i}" for i, k in enumerate(fields)),
        ExpressionAttributeNames={f"#{k}": k for k in fields},
        ExpressionAttributeValues={
            f":v{i}": v for i, (k, v) in enumerate(fields.items())
        },
    )


def extract_fields_from_response(text: str) -> dict:
    """Parse the <extracted_fields> JSON block from the assistant response."""
    import re

    match = re.search(r"<extracted_fields>\s*(\{.*?\})\s*</extracted_fields>", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return {}
    return {}


def clean_response_text(text: str) -> str:
    """Remove the <extracted_fields> block from the user-facing response."""
    import re

    return re.sub(r"<extracted_fields>.*?</extracted_fields>", "", text, flags=re.DOTALL).strip()


def call_bedrock(messages: list) -> str:
    """Invoke Bedrock Converse API with the conversation history."""
    # Bedrock Converse expects content as array of content blocks
    formatted = [
        {"role": m["role"], "content": [{"text": m["content"]}]}
        for m in messages
    ]

    response = bedrock.converse(
        modelId=MODEL_ID,
        messages=formatted,
        system=[{"text": SYSTEM_PROMPT}],
        inferenceConfig={
            "maxTokens": 1000,
            "temperature": 0.7,
        },
    )
    return response["output"]["message"]["content"][0]["text"]


def handler(event, context):
    """Lambda entry point for POST /chat."""
    try:
        body = json.loads(event.get("body", "{}"))
        user_message = body.get("message", "").strip()
        session_id = body.get("session_id", "")

        if not user_message:
            return _response(400, {"error": "message is required"})

        # Create new session if none provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Load conversation history
        messages = get_session_messages(session_id)

        # Append user message
        messages.append({"role": "user", "content": user_message})
        save_message(session_id, "user", user_message)

        # Call Bedrock
        assistant_text = call_bedrock(messages)

        # Extract structured fields
        fields = extract_fields_from_response(assistant_text)
        if fields:
            save_extracted_fields(session_id, fields)

        # Clean response for the frontend
        clean_text = clean_response_text(assistant_text)

        # Save assistant message
        save_message(session_id, "assistant", assistant_text)

        return _response(200, {
            "session_id": session_id,
            "message": clean_text,
            "extracted_fields": fields,
        })

    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": "Internal server error"})


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
