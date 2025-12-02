import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPassword?: string; // Optional - if provided, user doesn't need to enter current password (first login)
}

export default function ChangePasswordDialog({ isOpen, onClose, onSuccess, currentPassword }: ChangePasswordDialogProps) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  const isFirstLogin = !!currentPassword;

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});

    // Validation
    const newPwdError = validatePassword(newPwd);
    if (newPwdError) {
      setErrors({ new: newPwdError });
      return;
    }

    if (newPwd !== confirmPwd) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }

    if (!isFirstLogin && !currentPwd) {
      setErrors({ current: 'Current password is required' });
      return;
    }

    setIsLoading(true);

    try {
      // Use provided current password for first login, or user-entered password
      const finalCurrentPassword = isFirstLogin ? currentPassword : currentPwd;
      
      const response = await apiService.changePassword(finalCurrentPassword, newPwd);
      
      if (response.success) {
        toast.success('Password changed successfully!');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setErrors({});
        onSuccess();
        onClose();
      } else {
        const errorMessage = response.error || response.message || 'Failed to change password';
        if (errorMessage.includes('Current password')) {
          setErrors({ current: errorMessage });
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to change password';
      if (errorMessage.includes('Current password') || errorMessage.includes('incorrect')) {
        setErrors({ current: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            {isFirstLogin ? 'Change Your Password' : 'Update Password'}
          </DialogTitle>
          <DialogDescription>
            {isFirstLogin 
              ? 'For security reasons, you must change your password before continuing.'
              : 'Enter your current password and choose a new password.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isFirstLogin && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="current-password"
                  type="password"
                  value={currentPwd}
                  onChange={(e) => {
                    setCurrentPwd(e.target.value);
                    if (errors.current) setErrors({ ...errors, current: undefined });
                  }}
                  className="pl-10"
                  placeholder="Enter current password"
                  required
                />
              </div>
              {errors.current && (
                <p className="text-sm text-red-500">{errors.current}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="new-password"
                type="password"
                value={newPwd}
                onChange={(e) => {
                  setNewPwd(e.target.value);
                  if (errors.new) setErrors({ ...errors, new: undefined });
                }}
                className="pl-10"
                placeholder="Enter new password (min 6 characters)"
                required
                minLength={6}
              />
            </div>
            {errors.new && (
              <p className="text-sm text-red-500">{errors.new}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirm-password"
                type="password"
                value={confirmPwd}
                onChange={(e) => {
                  setConfirmPwd(e.target.value);
                  if (errors.confirm) setErrors({ ...errors, confirm: undefined });
                }}
                className="pl-10"
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>
            {errors.confirm && (
              <p className="text-sm text-red-500">{errors.confirm}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            {!isFirstLogin && (
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

