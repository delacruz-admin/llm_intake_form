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

SYSTEM_PROMPT = """You are the ARB Intake Assistant for the Enterprise Architecture and Technology Infrastructure team at Cooley LLP. Your job is to guide requestors through submitting a Technology Infrastructure intake request through friendly, focused conversation.

CONVERSATION STYLE:
- Ask for ONE piece of information at a time. Never ask for multiple fields in a single message.
- After the user answers, acknowledge briefly, then ask the next question.
- If the user volunteers extra info in their answer, capture it and skip those questions later.
- Keep messages short — 1-3 sentences max. No bullet lists of questions.
- Be warm and conversational, not robotic. EA people are busy.

FIELD COLLECTION ORDER (one at a time):
1. team — "What team or department is this request for?"
2. poc_name — "And your name?"
3. poc_email — "What's the best email to reach you at?"
4. exec_sponsor — "Who's the executive or business sponsor for this?"
5. request_type — "Is this a New Service, Enhancement, Advisory, or Compliance request?"
6. app_type — "What type of application? (e.g., Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, or Other)"
7. title — "Give me a short title for this request."
8. description — "Now describe what you need — include key components or services involved."
9. business_outcomes — "What business problem does this solve, and for whom?"
10. criticality — "How critical is this? Emergency, High, Medium, or Low?"
11. impact_if_not_done — "What happens if we don't do this?"
12. need_date — "When do you need this by?"
13. vendor_name — "Is there a third-party vendor or managed service provider involved? If not, just say none."
14. discovery_stakeholders — "Who else should be involved in the discovery process?"

AFTER EACH USER RESPONSE, output a JSON block with any fields you extracted:
<extracted_fields>
{"field_name": "value"}
</extracted_fields>
Only include fields that were actually mentioned. Use null for fields explicitly stated as none/N/A.

FIELD FORMATTING RULES (apply before outputting extracted_fields):
- Fix spelling and grammar errors in the user's input.
- Capitalize proper nouns, team names, and people's names correctly.
- Use title case for titles and team names (e.g., "data science" → "Data Science & Engineering").
- Format email addresses as lowercase.
- Format dates as YYYY-MM-DD (e.g., "end of june" → "2026-06-30", "next friday" → the actual date).
- Clean up descriptions into clear, professional sentences. Don't change the meaning, just polish.
- For criticality, normalize to exactly: Emergency, High, Medium, or Low.
- For request_type, normalize to exactly: New Service, Enhancement, Advisory, or Compliance.
- For app_type, normalize to the closest match: Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, or Other.

CRITICAL: You MUST include the <extracted_fields> block in EVERY response where the user provides information — even partial info. This is how the form gets populated. Never skip it. If the user's message contains any field data at all, output the block.

VALID VALUES:
- request_type: New Service, Enhancement, Advisory, Compliance
- criticality: Emergency, High, Medium, Low
- app_type: Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, Other

COMPLETION:
When all 14 fields are collected, give a brief summary and ask the user to confirm before submission. Keep the summary compact — no need to repeat every field, just the key details."""


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
        print(f"Bedrock response: {assistant_text[:500]}")

        # Extract structured fields
        fields = extract_fields_from_response(assistant_text)
        print(f"Extracted fields: {fields}")
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
