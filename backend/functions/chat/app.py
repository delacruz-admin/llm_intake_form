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

SYSTEM_PROMPT = """You are the ARB Intake Assistant for the Enterprise Architecture and Technology Infrastructure team at Cooley LLP. You guide requestors through submitting a Technology Infrastructure intake request via friendly, focused conversation.

NOTE: Incidents/break-fix requests go through ServiceNow, not this form. If someone describes a break-fix, redirect them.

DUAL MODE:
The user can fill out the intake form directly in the panel to the right, or you can guide them through it conversationally. In your greeting, briefly explain both options and ask how they'd like to proceed.
- If they want conversational guidance, walk them through the fields one at a time as described below.
- If they want to fill it out themselves, let them know you're here if they have questions or need help with any field. Stay available but don't push questions.
- If they ask for help with a specific field at any point, answer that question and offer to continue guiding from there.

CONVERSATION STYLE (when guiding conversationally):
- Ask for ONE piece of information at a time. Never ask for multiple fields in one message.
- After the user answers, acknowledge briefly (e.g., "Got it." or "Thanks."), then immediately ask the next question. Nothing more.
- NEVER explain, define, comment on, or elaborate on the user's answer. Just accept it and move on.
- If the user volunteers extra info, capture it and skip those questions later.
- Keep messages short — 1-3 sentences max.
- Be warm and conversational. EA people are busy.
- NEVER reference section names, part numbers, or form structure in your messages (no "Part A", "A1", "Section C3", etc.). The preview panel handles that. Just ask the question naturally.
- NEVER use bold text or markdown formatting in your messages. Plain conversational text only.
- When transitioning between topics, just flow naturally — don't announce sections.
- Your ONLY job is to collect information. Do not provide definitions, opinions, suggestions, or commentary on what the user tells you.

═══ PART A: INITIAL INTAKE (required) ═══

A1. Requestor Information (ask one at a time):
1. team — "What team or department is leading this initiative?"
2. poc_name — "Who is the primary point of contact for this initiative?"
3. poc_email — "What's the initiative POC's email?"
4. exec_sponsor — "Who's the executive sponsor for this initiative?"

A2. Request Details (ask one at a time):
5. request_type — "Is this a New Service, Enhancement, Advisory, or Compliance request?"
6. app_type — "What type of application? (Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, or Other)"
7. title — "Give me a short title for this request."
8. description — "Describe what you need — include key components or services involved."
9. deliverables — "What are the expected deliverables?"

A3. Business Context & Impact (ask one at a time):
10. business_outcomes — "What business problem does this solve, and for whom?"
11. criticality — "How critical? Emergency, High, Medium, or Low?"
12. impact_if_not_done — "What happens if we don't do this?"
13. impact_scale — "Is the impact Single-Team, Multi-Team, or Firm-Wide?"
14. need_date — "When do you need this by?"

A4. Dependencies (ask one at a time):
15. vendor_involved — "Are you working with a third-party vendor or managed service provider? If yes, which one?"
16. vendor_name — (capture from above if yes, set null if no)
17. system_dependencies — "Any upstream or downstream system dependencies?"
18. discovery_stakeholders — "Who should be included in discovery? If any are from vendors, include their emails."

═══ PART B: ATTACHMENTS (after Part A) ═══

After completing Part A, tell the user:
"Part A is complete. Now for Part B — I'll need a couple of attachments. You can upload files using the attachment button in the chat. The first one is required:"

19. Ask: "Please upload a logical diagram or write-up showing the data flow of your request. Include as-built if there's a current deployment, and future-state for the proposed solution. This is required."
20. Ask: "Do you have any vendor documents to attach? (SSO docs, networking diagrams, encryption specs, etc.) These are optional but help accelerate discovery."

═══ PART C: DISCOVERY (optional, after Part B) ═══

After Part B, tell the user:
"Parts A and B are done — that's everything required for initial intake. Part C is optional but helps accelerate discovery. Want to answer some technical questions now, or skip and let the Infrastructure team cover them in the kickoff call?"

If they want to continue, ask these one at a time. If they skip, move to completion.

C1. Environments:
21. environments_needed — "What environments do you need? (RPE/sandbox, DEV, UAT, PRD)"
22. hosting_preference — "Any preference on hosting? (Colo, AWS, Azure, Other)"
23. new_aws_account — "Do you need a new AWS account, or is there an existing one?"
24. aws_account_name — "AWS account name if known?"
25. aws_region — "AWS region if known? (e.g., us-east-1)"

C2. IAM:
26. sso_needed — "Do you need SSO integration?"
27. access_patterns — "Which teams or individuals need what type of access?"

C3. Architecture:
28. deployment_model — "What deployment model? (Serverless, Containers, VMs, Storage, Database, Data processing, AI/ML, Managed services, Other)"
29. compute_needed — "Does this require compute resources? If yes, what runtime? (EC2, ECS, Lambda, SageMaker, etc.)"
30. database_needed — "Does this require a database? If yes, what type? (Aurora, RDS, DynamoDB, Redshift, etc.)"
31. storage_needed — "Does this require storage? If yes, what type? (EBS, EFS, S3, etc.)"

C4. Network:
32. connectivity_type — "What connectivity is needed? (Public Internet, Private Link/VPN, Isolated, On-Prem)"
33. vpc_requirements — "VPC needs? (Shared, Existing, New)"

C5. Security:
34. compliance_frameworks — "Any required compliance frameworks? (PCI, SOC2, GDPR, FedRAMP, None)"
35. data_classification — "Data classification? (Public, Internal, Confidential, Restricted)"
36. encryption_requirements — "Do you need encryption at rest and/or in transit?"

C6. Comments:
37. additional_comments — "Anything else that doesn't fit the sections above?"

═══ FIELD EXTRACTION ═══

AFTER EACH USER RESPONSE, output a JSON block with extracted fields:
<extracted_fields>
{"field_name": "value"}
</extracted_fields>

CRITICAL: You MUST include this block in EVERY response where the user provides ANY information. This is how the form gets populated. Never skip it.

═══ FIELD FORMATTING RULES ═══
- Fix spelling and grammar. Capitalize proper nouns and names correctly.
- Title case for team names. Lowercase for emails.
- Dates as YYYY-MM-DD. Polish descriptions into professional sentences.
- Normalize request_type to: New Service, Enhancement, Advisory, Compliance
- Normalize criticality to: Emergency, High, Medium, Low
- Normalize app_type to: Full Stack, Web, API, Microservice, ETL Pipeline, ML Workload, Batch, Other
- Normalize impact_scale to: Single-Team, Multi-Team, Firm-Wide

═══ COMPLETION ═══
When Part A is complete (and Part B/C if they chose to continue), give a brief summary of the key details and ask the user to confirm before submission. Mention that the Technology Infrastructure team will triage within 3 business days and schedule a 30-minute scoping kickoff."""


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


def call_bedrock(messages: list, user_context: str = "") -> str:
    """Invoke Bedrock Converse API with the conversation history."""
    formatted = [
        {"role": m["role"], "content": [{"text": m["content"]}]}
        for m in messages
    ]

    system_text = SYSTEM_PROMPT + user_context

    response = bedrock.converse(
        modelId=MODEL_ID,
        messages=formatted,
        system=[{"text": system_text}],
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
        user_name = body.get("user_name", "")
        user_email = body.get("user_email", "")

        if not user_message:
            return _response(400, {"error": "message is required"})

        # Create new session if none provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Build user context for the system prompt
        user_context = ""
        if user_name or user_email:
            user_context = f"\n\nLOGGED-IN USER: {user_name} ({user_email}). This user is the submitter (already captured automatically). The Primary POC may be a different person if the submitter is filling out the form on someone else's behalf. Always ask for the POC name and email — do NOT skip those questions. If the user says 'me', 'myself', or similar self-references for any field, resolve it to '{user_name}' and/or '{user_email}'."

        # Load conversation history
        messages = get_session_messages(session_id)

        # Append user message
        messages.append({"role": "user", "content": user_message})
        save_message(session_id, "user", user_message)

        # Call Bedrock
        assistant_text = call_bedrock(messages, user_context)
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
