"""
Portfolio Chat Lambda — answers questions about the full ARB request register.
Loads all requests from DynamoDB and sends them as context to Bedrock Converse.
"""

import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime")

REQUESTS_TABLE = os.environ["REQUESTS_TABLE"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

requests_table = dynamodb.Table(REQUESTS_TABLE)


def handler(event, context):
    """API Gateway proxy handler."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    if http_method == "POST" and path == "/portfolio-chat":
        return portfolio_chat(event)

    return _response(404, {"error": "Not found"})


def portfolio_chat(event):
    """Answer a question about the full portfolio of ARB requests."""
    body = json.loads(event.get("body", "{}"))
    question = body.get("message", "").strip()
    history = body.get("history", [])

    if not question:
        return _response(400, {"error": "message is required"})

    # Load all non-draft requests
    all_requests = _load_all_requests()

    # Build context document
    context_doc = _build_context(all_requests)

    # Build conversation
    system_prompt = f"""You are the ARB Portfolio Analyst for the Architecture Review Board.
You have access to the complete register of technology infrastructure requests.
Answer questions about the portfolio — trends, statistics, comparisons, risks, recommendations.
Be concise and data-driven. Reference specific request IDs when relevant.
Do not use markdown formatting like bold or headers. Use plain text.
Today's date is {datetime.utcnow().strftime('%Y-%m-%d')}.

CURRENT PORTFOLIO DATA:
{context_doc}"""

    messages = []
    for h in history[-10:]:  # Keep last 10 turns
        messages.append({"role": h["role"], "content": [{"text": h["content"]}]})
    messages.append({"role": "user", "content": [{"text": question}]})

    try:
        resp = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[{"text": system_prompt}],
            messages=messages,
            inferenceConfig={"maxTokens": 1024, "temperature": 0.3},
        )
        answer = resp["output"]["message"]["content"][0]["text"]
    except Exception as e:
        return _response(500, {"error": f"Bedrock error: {str(e)}"})

    return _response(200, {"reply": answer})


def _load_all_requests():
    """Scan all non-draft requests from DynamoDB."""
    items = []
    response = requests_table.query(
        IndexName="GSI1",
        KeyConditionExpression=boto3.dynamodb.conditions.Key("GSI1PK").eq("REQUESTS"),
    )
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = requests_table.query(
            IndexName="GSI1",
            KeyConditionExpression=boto3.dynamodb.conditions.Key("GSI1PK").eq("REQUESTS"),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))
    return items


def _build_context(requests):
    """Format all requests into a text document for the LLM."""
    if not requests:
        return "No requests in the portfolio."

    lines = [f"Total requests: {len(requests)}\n"]
    for r in requests:
        lines.append(f"---\nID: {r.get('request_id', 'N/A')}")
        lines.append(f"Title: {r.get('title', 'Untitled')}")
        lines.append(f"Status: {r.get('status', 'unknown')}")
        lines.append(f"Team: {r.get('team', 'N/A')}")
        lines.append(f"Criticality: {r.get('criticality', 'N/A')}")
        lines.append(f"Type: {r.get('request_type', 'N/A')}")
        lines.append(f"Submitter: {r.get('submitter', 'N/A')}")
        lines.append(f"POC: {r.get('poc_name', 'N/A')}")
        lines.append(f"Submitted: {r.get('created_at', 'N/A')}")
        lines.append(f"Need Date: {r.get('need_date', 'N/A')}")
        lines.append(f"Promised Date: {r.get('promised_date', 'N/A')}")
        lines.append(f"Assigned To: {r.get('assigned_to', 'Unassigned')}")
        lines.append(f"Description: {r.get('description', 'N/A')}")
        lines.append(f"Business Outcomes: {r.get('business_outcomes', 'N/A')}")
        lines.append(f"Impact if Not Done: {r.get('impact_if_not_done', 'N/A')}")
        lines.append(f"Vendor: {r.get('vendor_name', 'N/A')}")
    return "\n".join(lines)


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }
