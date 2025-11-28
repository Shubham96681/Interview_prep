import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Star, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';

interface FeedbackFormProps {
  sessionId: string;
  revieweeName: string;
  onFeedbackSubmitted: () => void;
  existingReview?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
}

export default function FeedbackForm({
  sessionId,
  revieweeName,
  onFeedbackSubmitted,
  existingReview
}: FeedbackFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when existingReview changes (e.g., when user revisits page)
  useEffect(() => {
    if (existingReview) {
      console.log('🔄 FeedbackForm: Updating form with existing review:', existingReview);
      setRating(existingReview.rating || 0);
      setComment(existingReview.comment || '');
    } else {
      // Reset form if no existing review
      setRating(0);
      setComment('');
    }
  }, [existingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (!comment.trim()) {
      toast.error('Please provide feedback comment');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass userId from AuthContext - include test IDs too, backend will map them
      const userId = user?.id || undefined;
      console.log('📝 FeedbackForm: Submitting review with userId:', userId);
      const response = await apiService.createReview(sessionId, rating, comment, undefined, userId);
      
      if (response.success) {
        toast.success('Feedback submitted successfully!');
        onFeedbackSubmitted();
      } else {
        toast.error(response.error || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provide Feedback</CardTitle>
        <CardDescription>
          Share your experience with {revieweeName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Rating *</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="comment">Feedback Comment *</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about the session..."
              rows={4}
              required
              className="mt-2"
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : existingReview ? 'Update Feedback' : 'Submit Feedback'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

