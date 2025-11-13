# S3 Configuration - Quick Reference

## Your Configuration

- **IAM Role Name**: `InterviewPrepS3Role`
- **S3 Bucket Name**: `interview-prep-recordings-2024`

## EC2 Server Configuration

On your EC2 instance, update `server/.env`:

```env
AWS_S3_BUCKET_NAME=interview-prep-recordings-2024
AWS_REGION=us-east-1
```

**Note**: When using IAM role, you don't need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in the `.env` file.

## Local Development Configuration

For local testing, add to `server/.env`:

```env
AWS_S3_BUCKET_NAME=interview-prep-recordings-2024
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

## Verify Setup

1. **Check IAM Role is attached to EC2**:
   - EC2 Console → Your Instance → Security tab
   - Should show: `InterviewPrepS3Role`

2. **Check S3 Bucket**:
   - S3 Console → Should see: `interview-prep-recordings-2024`
   - Bucket should have CORS configured

3. **Test Upload**:
   - Start a meeting and record
   - Stop recording
   - Check S3 bucket → `recordings/` folder for uploaded file

## Server Logs

When server starts, you should see:
```
🔑 S3 Service: Using IAM role or default credential chain (EC2 recommended)
```

If you see this, S3 is configured correctly!

