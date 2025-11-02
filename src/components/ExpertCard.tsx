import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, MapPin, Clock, DollarSign, Sparkles, Award } from 'lucide-react';
import { Expert } from '@/lib/mockData';
import { useNavigate } from 'react-router-dom';

interface ExpertCardProps {
  expert: Expert;
}

export default function ExpertCard({ expert }: ExpertCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 border-0 shadow-xl bg-white border border-gray-200 hover:border-gray-300 overflow-hidden relative">
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
      
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-4 ring-gray-200 group-hover:ring-blue-400/50 transition-all duration-300">
              <AvatarImage src={expert.avatar} alt={expert.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-bold">
                {expert.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1 animate-pulse">
              <Award className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
                {expert.name}
              </h3>
              <p className="text-gray-600 font-medium">{expert.title}</p>
              <p className="text-blue-600 font-semibold text-lg">{expert.company}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-yellow-100 rounded-full px-3 py-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-gray-800">{expert.rating}</span>
              </div>
              <span className="text-gray-500">({expert.reviewCount} reviews)</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-600 bg-green-100 rounded-lg px-3 py-2">
              <DollarSign className="h-5 w-5" />
              <span className="font-bold text-xl">{expert.hourlyRate}</span>
              <span className="text-gray-600">/hr</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 relative z-10">
        <p className="text-gray-600 line-clamp-2 leading-relaxed">{expert.bio}</p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-600">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>{expert.experience}</span>
          </div>
          
          <div className="flex items-center gap-3 text-gray-600">
            <MapPin className="h-4 w-4 text-purple-500" />
            <span>{expert.languages.join(', ')}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {expert.specialties.slice(0, 3).map((specialty, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="bg-blue-100 text-blue-800 border-blue-200 hover:scale-110 transition-transform duration-300 px-3 py-1"
            >
              {specialty}
            </Badge>
          ))}
          {expert.specialties.length > 3 && (
            <Badge 
              variant="outline" 
              className="border-gray-300 text-gray-600 hover:scale-110 transition-transform duration-300 px-3 py-1"
            >
              +{expert.specialties.length - 3} more
            </Badge>
          )}
        </div>
        
        <div className="pt-4">
          <Button 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl py-6 text-lg font-semibold group/btn"
            onClick={() => navigate(`/expert/${expert.id}`)}
            aria-label={`View profile and book session with ${expert.name}`}
          >
            <Sparkles className="h-5 w-5 mr-2 group-hover/btn:animate-pulse" aria-hidden="true" />
            View Profile & Book
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
