import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '@/lib/apiService';
import { toast } from 'sonner';

interface OTPVerificationModalProps {
  isOpen: boolean;
  email: string;
  userName: string;
  onVerificationSuccess: (userData: any, token: string) => void;
  onClose: () => void;
}

export default function OTPVerificationModal({
  isOpen,
  email,
  userName: _userName,
  onVerificationSuccess,
  onClose
}: OTPVerificationModalProps) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    if (!isOpen) {
      setOtp('');
      setTimeRemaining(600);
      return;
    }

    // Countdown timer
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.verifyOTP(email, otp);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        if (token) {
          localStorage.setItem('token', token);
        }
        
        toast.success('Email verified successfully! Welcome to Interview Prep Platform!');
        onVerificationSuccess(user, token);
        onClose();
      } else {
        toast.error(response.error || 'Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      toast.error(error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const response = await apiService.resendOTP(email);
      
      if (response.success) {
        toast.success('OTP resent to your email. Please check your inbox.');
        setTimeRemaining(600); // Reset timer
        setOtp('');
      } else {
        toast.error(response.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      toast.error(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Your Email</DialogTitle>
          <DialogDescription>
            We've sent a 6-digit OTP to <strong>{email}</strong>. Please enter it below to complete your registration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Enter OTP</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={handleOTPChange}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              disabled={isLoading || timeRemaining === 0}
            />
          </div>

          {timeRemaining > 0 ? (
            <p className="text-sm text-center text-gray-500">
              OTP expires in: <span className="font-semibold text-blue-600">{formatTime(timeRemaining)}</span>
            </p>
          ) : (
            <p className="text-sm text-center text-red-500 font-semibold">
              OTP has expired. Please request a new one.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={otp.length !== 6 || isLoading || timeRemaining === 0}
              className="w-full"
            >
              {isLoading ? 'Verifying...' : 'Verify OTP'}
            </Button>

            <Button
              variant="outline"
              onClick={handleResendOTP}
              disabled={isResending || timeRemaining > 0}
              className="w-full"
            >
              {isResending ? 'Resending...' : 'Resend OTP'}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Didn't receive the email? Check your spam folder or click "Resend OTP" after the timer expires.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

