import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, User, Phone, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    inquiry: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (!formData.inquiry.trim()) {
      toast.error('Please enter your inquiry');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Here you can add API call to send contact form data to backend
      // For now, we'll just show a success message
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Contact form submission:', formData);
      
      toast.success('Thank you for contacting us! We will get back to you soon.');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        inquiry: ''
      });
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Error submitting contact form:', error);
      toast.error(error.message || 'Failed to submit your inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Contact Us</DialogTitle>
          <DialogDescription className="text-gray-600">
            Fill out the form below and we'll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-700 font-medium">
              Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={handleChange}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-700 font-medium">
              Phone Number <span className="text-gray-400 text-sm">(Optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={handleChange}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inquiry" className="text-gray-700 font-medium">
              Your Inquiry <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Textarea
                id="inquiry"
                name="inquiry"
                placeholder="Tell us how we can help you..."
                value={formData.inquiry}
                onChange={handleChange}
                className="pl-10 min-h-[120px] resize-none"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

