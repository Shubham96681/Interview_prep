import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';
import { apiService } from '@/lib/apiService';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const response = await apiService.healthCheck();
      setIsConnected(response.success);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  // Don't show anything if we haven't checked yet or if connected
  if (isConnected === null || isConnected) {
    return null;
  }

  return (
    <Alert className="mb-4 border-red-200 bg-red-50">
      <WifiOff className="h-4 w-4 text-red-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-red-800">
            Backend server is not available. Some features may not work properly.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkConnection}
          disabled={isChecking}
          className="ml-4"
        >
          {isChecking ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}






