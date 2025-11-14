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
        // Make file publicly readable (optional - you can use signed URLs instead)
        // ACL: 'public-read'
      });

      console.log(`⏳ Sending file to S3...`);
      await this.s3Client.send(command);
      console.log(`✅ File uploaded to S3 successfully`);

      // Generate public URL (if ACL is public-read)
      // const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      // Or generate signed URL (expires in 1 year)
      console.log(`🔗 Generating signed URL...`);
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const url = await getSignedUrl(this.s3Client, getCommand, { expiresIn: 31536000 }); // 1 year
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
   * Get a signed URL for a file (for viewing/downloading)
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>}
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
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

