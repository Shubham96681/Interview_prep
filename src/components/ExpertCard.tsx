import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, MapPin, Clock, DollarSign, Sparkles, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '@/lib/avatarUtils';
import { useAuth } from '@/contexts/AuthContext';

interface ExpertCardProps {
  expert: {
    id: string;
    name: string;
    title: string;
    company: string;
    bio: string;
    avatar?: string;
    rating: number;
    totalSessions: number;
    reviewCount?: number;
    hourlyRate: number;
    experience?: string;
    languages?: string[];
    specialties?: string[];
  };
  onAuthRequired?: () => void;
}

export default function ExpertCard({ expert, onAuthRequired }: ExpertCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleViewProfile = () => {
    // Check if user is authenticated
    if (!user) {
      // If onAuthRequired callback is provided, call it
      if (onAuthRequired) {
        onAuthRequired();
      } else {
        // Otherwise, navigate to expert profile (they can view but will need to login to book)
        navigate(`/expert/${expert.id}`);
      }
      return;
    }

    // If user is authenticated, navigate to expert profile
    navigate(`/expert/${expert.id}`);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-2 ring-gray-200 group-hover:ring-blue-400 transition-all duration-300">
              <AvatarImage src={getAvatarUrl(expert.avatar, expert.name)} alt={expert.name} />
              <AvatarFallback className="bg-blue-600 text-white text-lg font-bold">
                {expert.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-2 -right-2 bg-orange-500 rounded-full p-1">
              <Award className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                {expert.name}
              </h3>
              <p className="text-gray-600 font-medium">{expert.title}</p>
              <p className="text-blue-600 font-semibold">{expert.company}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-yellow-50 rounded-full px-3 py-1 border border-yellow-200">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-gray-900">{expert.rating}</span>
              </div>
              <span className="text-gray-500 text-sm">({expert.reviewCount || expert.totalSessions || 0} reviews)</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
              <DollarSign className="h-5 w-5" />
              <span className="font-bold text-xl">{expert.hourlyRate}</span>
              <span className="text-gray-600">/hr</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <p className="text-gray-600 line-clamp-2 leading-relaxed">{expert.bio}</p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-600">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>{expert.experience}</span>
          </div>
          
          {expert.languages && expert.languages.length > 0 && (
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="h-4 w-4 text-orange-500" />
              <span>{expert.languages.join(', ')}</span>
            </div>
          )}
        </div>
        
        {(expert.specialties && expert.specialties.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {expert.specialties.slice(0, 3).map((specialty, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1"
              >
                {specialty}
              </Badge>
            ))}
            {expert.specialties.length > 3 && (
              <Badge 
                variant="outline" 
                className="border-gray-300 text-gray-600 px-3 py-1"
              >
                +{expert.specialties.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="pt-4">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 py-6 text-lg font-semibold"
            onClick={handleViewProfile}
            aria-label={`View profile and book session with ${expert.name}`}
          >
            <Sparkles className="h-5 w-5 mr-2" aria-hidden="true" />
            View Profile & Book
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
