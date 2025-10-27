# MinIO Storage Setup

This project now includes MinIO file storage integration for managing documents and files.

## Features

- 📁 Upload files to MinIO bucket
- 🗑️ Delete files from MinIO bucket
- 📋 List all files in the bucket
- 🔄 Refresh file list
- 🎨 Clean, modern UI with file management table

## Setup

### 1. Install Dependencies

First, install the MinIO client library:

```bash
npm install minio
```

### 2. Environment Variables

Your environment variables are already configured in `.env.example`. Add the following to your `.env.local` file:

```env
# MinIO Configuration
MINIO_ENDPOINT=your-minio-server.com:9000  # Your MinIO server endpoint (include port)
MINIO_REGION=us-east-1                     # MinIO region
MINIO_ACCESS_KEY=your-access-key           # MinIO access key
MINIO_SECRET_KEY=your-secret-key           # MinIO secret key
MINIO_BUCKET=documents                     # Bucket name for storing files
MINIO_PUBLIC_BROWSER=true                  # Set to true if using SSL/HTTPS
```

**Note:** The endpoint should include both hostname and port (e.g., `minio.example.com:9000` or `192.168.1.100:9000`)

### 3. MinIO Server

Since you're using an online MinIO server, make sure you have:
- The correct endpoint URL with port
- Valid access keys and secret keys
- The bucket exists (it will be created automatically if it doesn't exist)

For local development, you can use Docker:

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

Then access:
- MinIO Console: http://localhost:9001
- MinIO API: http://localhost:9000

### 4. Usage

1. Navigate to the Knowledge page
2. Click the folder icon (📁) in the top-left panel
3. In the modal that opens:
   - **Upload Files**: Click "Choose File" to upload new files
   - **View Files**: See all files in a table with name, size, and last modified date
   - **Delete Files**: Click the trash icon to delete files
   - **Refresh**: Click the refresh icon to reload the file list

## API Endpoints

### GET /api/storage
List all files in the bucket.

**Query Parameters:**
- `prefix` (optional): Filter files by prefix

**Response:**
```json
{
  "files": [
    {
      "name": "example.pdf",
      "size": 12345,
      "lastModified": "2024-01-01T00:00:00.000Z",
      "etag": "etag_value"
    }
  ]
}
```

### POST /api/storage
Upload a file to the bucket.

**Form Data:**
- `file`: The file to upload
- `path` (optional): Custom path for the file

**Response:**
```json
{
  "message": "File uploaded successfully",
  "fileName": "example.pdf",
  "size": 12345
}
```

### DELETE /api/storage
Delete a file from the bucket.

**Query Parameters:**
- `fileName`: The name of the file to delete

**Response:**
```json
{
  "message": "File deleted successfully"
}
```

## Security

All API endpoints are protected with authentication using NextAuth. Only authenticated users can:
- List files
- Upload files
- Delete files

## Implementation Details

### Files Created

1. **`src/lib/minio.ts`**: MinIO client initialization and bucket setup
2. **`src/app/api/storage/route.ts`**: API routes for file operations
3. **`src/app/knowledge/_components/minio-storage-modal.tsx`**: React component for file management UI
4. **`src/app/knowledge/page.tsx`**: Updated to include the storage button

### Bucket Initialization

The bucket is automatically created on first use if it doesn't exist. The bucket name is set via the `MINIO_BUCKET` environment variable (defaults to `documents`).

## Troubleshooting

### Connection Errors
- Ensure MinIO server is running
- Check endpoint and port configuration
- Verify access key and secret key are correct

### Upload Failures
- Check file size limits
- Verify bucket permissions
- Ensure the bucket exists and is accessible

### Authentication Errors
- Verify NextAuth is properly configured
- Check session is active
- Ensure user is authenticated

