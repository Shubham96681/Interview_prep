const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Load environment variables if not already loaded
if (!process.env.AWS_S3_BUCKET_NAME) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv might not be available, that's okay
  }
}

class S3Service {
  constructor() {
    // Build S3 client configuration
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
    };

    // Use IAM role credentials if running on EC2 (no explicit credentials)
    // Otherwise, use IAM user credentials from environment variables
    // When running on EC2 with an attached IAM role, AWS SDK automatically
    // retrieves credentials from the instance metadata service
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      // Explicit credentials provided (for local development or when not using IAM role)
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
      console.log('🔑 S3 Service: Using IAM user credentials from environment variables');
    } else {
      // No explicit credentials - will use IAM role (EC2) or default credential chain
      console.log('🔑 S3 Service: Using IAM role or default credential chain (EC2 recommended)');
    }

    this.s3Client = new S3Client(config);
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    
    if (this.bucketName) {
      console.log(`✅ S3 Service initialized with bucket: ${this.bucketName}`);
    } else {
      console.warn('⚠️ AWS_S3_BUCKET_NAME not set - S3 uploads will be disabled');
    }
  }

  /**
   * Upload a file to S3
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {string} fileName - Name for the file in S3
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<{url: string, key: string}>}
   */
  async uploadFile(fileBuffer, fileName, contentType = 'video/webm') {
    if (!this.bucketName) {
      throw new Error('S3 bucket name not configured');
    }

    try {
      const key = `recordings/${fileName}`;
      console.log(`📤 S3 Upload: Bucket=${this.bucketName}, Key=${key}, Size=${fileBuffer.length} bytes, ContentType=${contentType}`);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // Enable multipart upload for large files (handled automatically by AWS SDK)
        // Make file publicly readable (optional - you can use signed URLs instead)
        // ACL: 'public-read'
      });
      
      // Log file size for monitoring
      const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
      console.log(`📊 File size: ${fileSizeMB} MB`);

      console.log(`⏳ Sending file to S3...`);
      await this.s3Client.send(command);
      console.log(`✅ File uploaded to S3 successfully`);

      // Generate public URL (if ACL is public-read)
      // const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      // Or generate signed URL (expires in 7 days - AWS S3 maximum)
      console.log(`🔗 Generating signed URL...`);
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      // AWS S3 presigned URLs have a maximum expiration of 7 days (604800 seconds)
      const url = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 604800 }); // 7 days (max allowed)
      console.log(`✅ Signed URL generated: ${url.substring(0, 100)}...`);

      return {
        url,
        key,
      };
    } catch (error) {
      console.error('❌ Error uploading to S3:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.Code || error.code);
      console.error('   Name:', error.name);
      if (error.$metadata) {
        console.error('   Request ID:', error.$metadata.requestId);
        console.error('   HTTP Status:', error.$metadata.httpStatusCode);
      }
      throw error;
    }
  }

  /**
   * Extract S3 key from a URL (handles expired URLs and various formats)
   * @param {string} url - S3 URL (can be expired)
   * @returns {string|null} - Extracted S3 key or null if extraction fails
   */
  extractKeyFromUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      // Remove query parameters (expired URLs may have query params)
      const urlWithoutParams = url.split('?')[0];
      
      // Pattern 1: Look for /recordings/ in the path (most common)
      // https://bucket.s3.region.amazonaws.com/recordings/filename.webm
      const recordingsMatch = urlWithoutParams.match(/\/recordings\/[^\/\?]+/);
      if (recordingsMatch) {
        return recordingsMatch[0].substring(1); // Remove leading slash
      }
      
      // Pattern 2: Extract everything after bucket name
      // https://bucket.s3.region.amazonaws.com/path/to/file
      const bucketMatch = urlWithoutParams.match(/\.s3\.[^\/]+\/(.+)$/);
      if (bucketMatch) {
        return bucketMatch[1];
      }
      
      // Pattern 3: Extract from s3.region.amazonaws.com/bucket/path format
      // https://s3.region.amazonaws.com/bucket/path/to/file
      const s3Match = urlWithoutParams.match(/s3\.[^\/]+\/[^\/]+\/(.+)$/);
      if (s3Match) {
        return s3Match[1];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  /**
   * Get a signed URL for a file (for viewing/downloading)
   * Automatically generates a fresh URL even if the original is expired
   * @param {string} key - S3 object key (or URL to extract key from)
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>}
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      // If key looks like a URL, extract the actual key
      let s3Key = key;
      if (key.includes('amazonaws.com') || key.includes('http://') || key.includes('https://')) {
        const extractedKey = this.extractKeyFromUrl(key);
        if (extractedKey) {
          s3Key = extractedKey;
          console.log(`🔑 Extracted S3 key from URL: ${s3Key}`);
        } else {
          throw new Error(`Could not extract S3 key from URL: ${key}`);
        }
      }
      
      // Ensure expiration doesn't exceed AWS S3 maximum of 7 days
      const maxExpiration = 604800; // 7 days in seconds
      const actualExpiration = Math.min(expiresIn, maxExpiration);
      
      if (expiresIn > maxExpiration) {
        console.warn(`⚠️ Requested expiration (${expiresIn}s) exceeds S3 maximum (${maxExpiration}s). Using ${maxExpiration}s instead.`);
      }
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      console.log(`🔄 Generating fresh signed URL for key: ${s3Key} (expires in ${actualExpiration}s)`);
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: actualExpiration });
      console.log(`✅ Fresh signed URL generated successfully`);
      return url;
    } catch (error) {
      console.error('❌ Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<void>}
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting from S3:', error);
      throw error;
    }
  }
}

module.exports = new S3Service();

