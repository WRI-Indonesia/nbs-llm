# MinIO Configuration Guide

## Environment Variables (.env)

Configure your MinIO connection by setting these variables in your `.env` file:

```env
# MinIO Server
MINIO_ENDPOINT=https://s3.wri-indonesia.id
MINIO_REGION=ap-southeast-1
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key

# Bucket and Path Configuration
MINIO_BUCKET=etl-kms
MINIO_STORAGE_PREFIX=open_alex/group_by_lang/en/

# SSL Configuration
MINIO_PUBLIC_BROWSER=https://s3-console.wri-indonesia.id/browser
```

## Explanation

### MINIO_BUCKET
- The bucket name in your MinIO server
- Example: `etl-kms`

### MINIO_STORAGE_PREFIX (Optional)
- The default path/folder prefix within the bucket
- Example: `open_alex/group_by_lang/en/`
- When you upload files, they will automatically be placed in this path
- When you list files, only files in this path will be shown
- **Leave empty** if you want to use the root of the bucket

## How It Works

1. **Upload**: Files are uploaded to `MINIO_BUCKET` with prefix `MINIO_STORAGE_PREFIX`
   - Example: File `data.csv` → `etl-kms/open_alex/group_by_lang/en/data.csv`

2. **Display**: The UI shows only the filename (not the full path)
   - Example: Shows `data.csv` (not `open_alex/group_by_lang/en/data.csv`)

3. **Operations**: All operations (upload, delete) use the configured path
   - No need to specify paths in the UI
   - Everything is configured in `.env`

## Usage

1. Update your `.env` file with the correct values
2. Restart your dev server
3. Click the folder icon in the Knowledge page
4. Upload, view, and delete files - all operations work in your configured path

## Example Configuration

For accessing files in `https://s3-console.wri-indonesia.id/browser/etl-kms/open_alex%2Fgroup_by_lang%2Fen%2F`:

```env
MINIO_BUCKET=etl-kms
MINIO_STORAGE_PREFIX=open_alex/group_by_lang/en/
```

The UI will show only filenames like:
- `data.csv`
- `metadata.json`
- `readme.txt`

Instead of the full paths.
