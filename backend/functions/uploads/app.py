"""
Upload Lambda — generates presigned URLs for S3 file uploads
and records attachment metadata in the requests table.
"""

import json
import os
import uuid
import boto3
from datetime import datetime

ATTACHMENTS_BUCKET = os.environ["ATTACHMENTS_BUCKET"]
REQUESTS_TABLE = os.environ["REQUESTS_TABLE"]

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(REQUESTS_TABLE)


def handler(event, context):
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}
    request_id = path_params.get("id", "")

    try:
        if method == "POST":
            return generate_upload_url(request_id, event)
        elif method == "GET":
            params = event.get("queryStringParameters") or {}
            if "s3_key" in params:
                return generate_download_url(params["s3_key"])
            return list_attachments(request_id)
        elif method == "DELETE":
            return delete_attachment(request_id, event)
        else:
            return _response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": "Internal server error"})


def generate_upload_url(request_id, event):
    """Generate a presigned PUT URL for uploading a file."""
    body = json.loads(event.get("body", "{}"))
    filename = body.get("filename", "").strip()
    content_type = body.get("content_type", "application/octet-stream")
    category = body.get("category", "general")  # e.g., logical-diagram, vendor-doc

    if not filename:
        return _response(400, {"error": "filename is required"})
    if not request_id:
        return _response(400, {"error": "request_id is required"})

    file_id = uuid.uuid4().hex[:8]
    s3_key = f"{request_id}/{file_id}/{filename}"

    # Generate presigned PUT URL (valid 15 min)
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": ATTACHMENTS_BUCKET,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )

    # Record attachment metadata
    now = datetime.utcnow().isoformat()
    table.put_item(
        Item={
            "PK": f"REQUEST#{request_id}",
            "SK": f"ATTACH#{now}#{file_id}",
            "file_id": file_id,
            "filename": filename,
            "content_type": content_type,
            "category": category,
            "s3_key": s3_key,
            "uploaded_at": now,
        }
    )

    return _response(200, {
        "upload_url": presigned_url,
        "file_id": file_id,
        "s3_key": s3_key,
    })


def list_attachments(request_id):
    """List all attachments for a request, each with a presigned download URL."""
    if not request_id:
        return _response(400, {"error": "request_id is required"})

    response = table.query(
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": f"REQUEST#{request_id}",
            ":sk": "ATTACH#",
        },
        ScanIndexForward=False,
    )

    attachments = []
    for item in response.get("Items", []):
        item.pop("PK", None)
        item.pop("SK", None)
        # Generate a presigned download URL for each attachment
        if item.get("s3_key"):
            try:
                item["download_url"] = s3.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": ATTACHMENTS_BUCKET,
                        "Key": item["s3_key"],
                    },
                    ExpiresIn=3600,
                )
            except Exception:
                item["download_url"] = None
        attachments.append(item)

    return _response(200, {"attachments": attachments})


def generate_download_url(s3_key):
    """Generate a presigned GET URL for downloading a file."""
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": ATTACHMENTS_BUCKET,
                "Key": s3_key,
            },
            ExpiresIn=3600,
        )
        return _response(200, {"download_url": url})
    except Exception as e:
        return _response(500, {"error": str(e)})


def delete_attachment(request_id, event):
    """Delete an attachment — remove from S3 and DynamoDB."""
    body = json.loads(event.get("body", "{}"))
    file_id = body.get("file_id", "").strip()
    s3_key = body.get("s3_key", "").strip()
    sk = body.get("sk", "").strip()

    if not file_id and not sk:
        return _response(400, {"error": "file_id or sk is required"})

    # If we have sk, delete directly. Otherwise find by file_id.
    if sk:
        table.delete_item(Key={"PK": f"REQUEST#{request_id}", "SK": sk})
    else:
        # Find the attachment by file_id
        response = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues={
                ":pk": f"REQUEST#{request_id}",
                ":sk": "ATTACH#",
            },
        )
        for item in response.get("Items", []):
            if item.get("file_id") == file_id:
                table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                s3_key = s3_key or item.get("s3_key", "")
                break

    # Delete from S3
    if s3_key:
        try:
            s3.delete_object(Bucket=ATTACHMENTS_BUCKET, Key=s3_key)
        except Exception:
            pass  # S3 delete is best-effort

    return _response(200, {"message": "Attachment deleted."})


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }
