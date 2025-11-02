import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWindows = platform() === 'win32';

class RobustServerManager {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
    this.isShuttingDown = false;
  }

  async start() {
    console.log('🚀 Starting Robust Server Manager...');
    
    try {
      // Start backend server
      await this.startBackend();
      
      // Wait for backend to be ready
      await this.waitForBackend();
      
      // Start frontend server
      await this.startFrontend();
      
      console.log('✅ Both servers started successfully!');
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Failed to start servers:', error);
      this.shutdown();
      process.exit(1);
    }
  }

  async startBackend() {
    console.log('🔧 Starting backend server...');
    
    return new Promise((resolve, reject) => {
      this.backendProcess = spawn('node', ['robust-server.js'], {
        cwd: path.join(__dirname, 'server'),
        stdio: 'pipe'
      });

      this.backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Backend] ${output.trim()}`);
        
        if (output.includes('Server running on')) {
          resolve();
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString().trim()}`);
      });

      this.backendProcess.on('error', (error) => {
        console.error('❌ Backend process error:', error);
        reject(error);
      });

      this.backendProcess.on('exit', (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          console.error(`❌ Backend process exited with code ${code}`);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.backendProcess.killed) {
          reject(new Error('Backend startup timeout'));
        }
      }, 30000);
    });
  }

  async waitForBackend() {
    console.log('⏳ Waiting for backend to be ready...');
    
    const maxAttempts = 30;
    const delay = 1000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch('http://localhost:5000/api/health');
        if (response.ok) {
          console.log('✅ Backend is ready!');
          return;
        }
      } catch (error) {
        // Backend not ready yet
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Backend failed to become ready');
  }

  async startFrontend() {
    console.log('🎨 Starting frontend server...');
    
    return new Promise((resolve, reject) => {
      // On Windows, use npm.cmd or shell: true
      const command = isWindows ? 'npm.cmd' : 'npm';
      this.frontendProcess = spawn(command, ['run', 'dev'], {
        cwd: __dirname,
        stdio: 'pipe',
        shell: isWindows
      });

      this.frontendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Frontend] ${output.trim()}`);
        
        if (output.includes('Local:') || output.includes('ready in')) {
          resolve();
        }
      });

      this.frontendProcess.stderr.on('data', (data) => {
        console.error(`[Frontend Error] ${data.toString().trim()}`);
      });

      this.frontendProcess.on('error', (error) => {
        console.error('❌ Frontend process error:', error);
        reject(error);
      });

      this.frontendProcess.on('exit', (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          console.error(`❌ Frontend process exited with code ${code}`);
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!this.frontendProcess.killed) {
          reject(new Error('Frontend startup timeout'));
        }
      }, 60000);
    });
  }

  setupGracefulShutdown() {
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('exit', () => this.shutdown());
  }

  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log('🛑 Shutting down servers...');
    
    if (this.frontendProcess) {
      this.frontendProcess.kill('SIGTERM');
    }
    
    if (this.backendProcess) {
      this.backendProcess.kill('SIGTERM');
    }
    
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force kill if still running
    if (this.frontendProcess && !this.frontendProcess.killed) {
      this.frontendProcess.kill('SIGKILL');
    }
    
    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendProcess.kill('SIGKILL');
    }
    
    console.log('✅ Servers shut down');
    process.exit(0);
  }
}

// Start the robust server manager
const manager = new RobustServerManager();
manager.start().catch(console.error);






