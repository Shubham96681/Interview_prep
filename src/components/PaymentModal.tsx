import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CreditCard, 
  Lock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Calendar,
  Clock,
  User,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (paymentData: PaymentData) => void;
  sessionData: {
    expertName: string;
    date: string;
    time: string;
    duration: number;
    amount: number;
    sessionType: string;
  };
}

interface PaymentData {
  transactionId: string;
  amount: number;
  status: 'success' | 'failed';
  timestamp: string;
}

export default function PaymentModal({ isOpen, onClose, onPaymentSuccess, sessionData }: PaymentModalProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'failed'>('form');
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Card number validation (dummy: must be 16 digits)
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length !== 16) {
      newErrors.cardNumber = 'Please enter a valid 16-digit card number';
    }

    // Expiry validation
    if (!formData.expiryMonth || !formData.expiryYear) {
      newErrors.expiry = 'Please select expiry month and year';
    } else {
      const currentDate = new Date();
      const expiryDate = new Date(parseInt(formData.expiryYear), parseInt(formData.expiryMonth) - 1);
      if (expiryDate < currentDate) {
        newErrors.expiry = 'Card has expired';
      }
    }

    // CVV validation
    if (!formData.cvv || formData.cvv.length !== 3) {
      newErrors.cvv = 'Please enter a valid 3-digit CVV';
    }

    // Cardholder name validation
    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = 'Please enter cardholder name';
    }

    // Email validation
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (!formData.phone || formData.phone.length < 10) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'cardNumber') {
      value = formatCardNumber(value);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const simulatePayment = async () => {
    setStep('processing');

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate transaction ID
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const paymentData: PaymentData = {
        transactionId,
        amount: sessionData.amount,
        status: 'success',
        timestamp: new Date().toISOString()
      };
      
      // Simulate payment processing (90% success rate for demo)
      const isSuccess = Math.random() > 0.1;
      
      if (isSuccess) {
        setStep('success');
        toast.success('Payment successful!', {
          description: `Transaction ID: ${paymentData.transactionId}`
        });
        
        // Call success callback after a short delay
        setTimeout(() => {
          onPaymentSuccess(paymentData);
          onClose();
        }, 2000);
      } else {
        setStep('failed');
        toast.error('Payment failed', {
          description: 'Your payment could not be processed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      setStep('failed');
      toast.error('Payment failed', {
        description: 'An error occurred during payment processing.'
      });
    } finally {
      // Payment processing completed
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    await simulatePayment();
  };

  const resetForm = () => {
    setStep('form');
    setFormData({
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      cardholderName: '',
      email: '',
      phone: ''
    });
    setErrors({});
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {step === 'form' && 'Complete Payment'}
            {step === 'processing' && 'Processing Payment'}
            {step === 'success' && 'Payment Successful'}
            {step === 'failed' && 'Payment Failed'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Secure payment for your interview session'}
            {step === 'processing' && 'Please wait while we process your payment...'}
            {step === 'success' && 'Your payment has been processed successfully'}
            {step === 'failed' && 'There was an issue processing your payment'}
          </DialogDescription>
        </DialogHeader>

        {/* Session Summary */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Session Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Expert:</span>
              <span>{sessionData.expertName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Date:</span>
              <span>{formatDate(sessionData.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Time:</span>
              <span>{sessionData.time} ({sessionData.duration} minutes)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Type:</span>
              <span className="capitalize">{sessionData.sessionType}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-blue-200">
              <div className="flex items-center gap-2 font-semibold">
                <DollarSign className="h-4 w-4" />
                <span>Total Amount:</span>
              </div>
              <span className="text-xl font-bold text-blue-600">${sessionData.amount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Card Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Card Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number *</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={formData.cardNumber}
                    onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                    maxLength={19}
                    className={errors.cardNumber ? 'border-red-500' : ''}
                  />
                  {errors.cardNumber && (
                    <p className="text-sm text-red-500 mt-1">{errors.cardNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Expiry Date *</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={formData.expiryMonth} 
                        onValueChange={(value) => handleInputChange('expiryMonth', value)}
                      >
                        <SelectTrigger className={errors.expiry ? 'border-red-500' : ''}>
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                              {(i + 1).toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={formData.expiryYear} 
                        onValueChange={(value) => handleInputChange('expiryYear', value)}
                      >
                        <SelectTrigger className={errors.expiry ? 'border-red-500' : ''}>
                          <SelectValue placeholder="YYYY" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.expiry && (
                      <p className="text-sm text-red-500 mt-1">{errors.expiry}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cvv">CVV *</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={formData.cvv}
                      onChange={(e) => handleInputChange('cvv', e.target.value.replace(/\D/g, ''))}
                      maxLength={3}
                      className={errors.cvv ? 'border-red-500' : ''}
                    />
                    {errors.cvv && (
                      <p className="text-sm text-red-500 mt-1">{errors.cvv}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="cardholderName">Cardholder Name *</Label>
                  <Input
                    id="cardholderName"
                    placeholder="John Doe"
                    value={formData.cardholderName}
                    onChange={(e) => handleInputChange('cardholderName', e.target.value)}
                    className={errors.cardholderName ? 'border-red-500' : ''}
                  />
                  {errors.cardholderName && (
                    <p className="text-sm text-red-500 mt-1">{errors.cardholderName}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">
                Your payment information is encrypted and secure. This is a demo payment gateway for testing purposes.
              </span>
            </div>

            {/* Payment Button */}
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 h-12 text-lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay ${sessionData.amount} Now
            </Button>
          </form>
        )}

        {/* Processing State */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
            <p className="text-gray-600">Please don't close this window...</p>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-600 mb-2">Payment Successful!</h3>
            <p className="text-gray-600 mb-4">Your session has been booked and confirmed.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                You will receive a confirmation email shortly with session details and meeting link.
              </p>
            </div>
          </div>
        )}

        {/* Failed State */}
        {step === 'failed' && (
          <div className="text-center py-8">
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Payment Failed</h3>
            <p className="text-gray-600 mb-4">There was an issue processing your payment.</p>
            <div className="space-y-2">
              <Button 
                onClick={resetForm}
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
