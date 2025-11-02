// Backend port detection service
class BackendDetector {
  private static instance: BackendDetector;
  private detectedPort: number | null = null;
  private readonly possiblePorts = [5000, 5001, 5002, 3001, 3000];
  private readonly maxRetries = 3;

  static getInstance(): BackendDetector {
    if (!BackendDetector.instance) {
      BackendDetector.instance = new BackendDetector();
    }
    return BackendDetector.instance;
  }

  async detectBackendPort(): Promise<number> {
    if (this.detectedPort) {
      return this.detectedPort;
    }

    console.log('🔍 Detecting backend port...');

    for (const port of this.possiblePorts) {
      try {
        const isAvailable = await this.checkPort(port);
        if (isAvailable) {
          this.detectedPort = port;
          console.log(`✅ Backend detected on port ${port}`);
          return port;
        }
      } catch (error) {
        console.log(`❌ Port ${port} not available:`, error);
      }
    }

    throw new Error('No backend server found on any common ports');
  }

  private async checkPort(port: number): Promise<boolean> {
    const url = `http://localhost:${port}/api/health`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(2000), // 2 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            return true;
          }
        }
      } catch (error) {
        console.log(`Attempt ${attempt}/${this.maxRetries} failed for port ${port}:`, error);
        if (attempt < this.maxRetries) {
          await this.delay(1000); // Wait 1 second before retry
        }
      }
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDetectedPort(): number | null {
    return this.detectedPort;
  }

  reset(): void {
    this.detectedPort = null;
  }
}

export default BackendDetector.getInstance();
