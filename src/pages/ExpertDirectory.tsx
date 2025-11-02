import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, ArrowLeft, Sparkles, Users, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpertCard from '@/components/ExpertCard';
import { mockExperts } from '@/lib/mockData';

export default function ExpertDirectory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  const specialties = Array.from(
    new Set(mockExperts.flatMap(expert => expert.specialties))
  );

  const filteredExperts = mockExperts.filter(expert => {
    const matchesSearch = expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expert.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expert.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSpecialty = selectedSpecialty === 'all' || 
                            expert.specialties.includes(selectedSpecialty);
    
    const matchesPrice = priceRange === 'all' ||
                        (priceRange === 'under-100' && expert.hourlyRate < 100) ||
                        (priceRange === '100-150' && expert.hourlyRate >= 100 && expert.hourlyRate <= 150) ||
                        (priceRange === 'over-150' && expert.hourlyRate > 150);
    
    return matchesSearch && matchesSpecialty && matchesPrice;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6 max-w-7xl mx-auto backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            ✨ InterviewAce
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105"
          >
            Dashboard
          </Button>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom duration-1000">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-12 w-12 text-purple-400 animate-pulse" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Expert Directory
            </h1>
            <Sparkles className="h-12 w-12 text-blue-400 animate-pulse animation-delay-400" />
          </div>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Find the perfect interview coach
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8 border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 animate-in slide-in-from-bottom duration-1000 delay-200">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="relative group">
                <Search className="absolute left-4 top-4 h-5 w-5 text-white/40 group-focus-within:text-blue-400 transition-colors duration-300" />
                <Input
                  placeholder="Search experts, companies, skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300 text-lg"
                />
              </div>
              
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger className="h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white focus:border-blue-400 focus:ring-blue-400/20 text-lg">
                  <SelectValue placeholder="All Specialties" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/20 backdrop-blur-xl">
                  <SelectItem value="all" className="text-white hover:bg-white/10">All Specialties</SelectItem>
                  {specialties.map(specialty => (
                    <SelectItem key={specialty} value={specialty} className="text-white hover:bg-white/10">
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white focus:border-blue-400 focus:ring-blue-400/20 text-lg">
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/20 backdrop-blur-xl">
                  <SelectItem value="all" className="text-white hover:bg-white/10">All Prices</SelectItem>
                  <SelectItem value="under-100" className="text-white hover:bg-white/10">Under $100/hr</SelectItem>
                  <SelectItem value="100-150" className="text-white hover:bg-white/10">$100-150/hr</SelectItem>
                  <SelectItem value="over-150" className="text-white hover:bg-white/10">Over $150/hr</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                className="h-12 flex items-center gap-3 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105 text-lg"
              >
                <Filter className="h-5 w-5" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex justify-between items-center mb-8 animate-in slide-in-from-bottom duration-1000 delay-400">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold text-white">
              {filteredExperts.length} Expert{filteredExperts.length !== 1 ? 's' : ''} Available
            </h2>
            {selectedSpecialty !== 'all' && (
              <Badge 
                variant="secondary" 
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border-white/20 text-white px-4 py-2 text-sm hover:scale-110 transition-transform duration-300"
              >
                {selectedSpecialty}
                <button 
                  onClick={() => setSelectedSpecialty('all')} 
                  className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors duration-300"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <Star className="h-5 w-5 text-yellow-400 animate-pulse" />
            <span>Top rated experts</span>
          </div>
        </div>

        {/* Expert Grid */}
        {filteredExperts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredExperts.map((expert, index) => (
              <div 
                key={expert.id} 
                className="animate-in slide-in-from-bottom duration-1000"
                style={{ animationDelay: `${600 + index * 100}ms` }}
              >
                <ExpertCard expert={expert} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 animate-in slide-in-from-bottom duration-1000 delay-600">
            <CardContent className="p-16 text-center">
              <div className="text-white/40 mb-6">
                <Search className="h-16 w-16 mx-auto animate-pulse" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">No experts found</h3>
              <p className="text-white/60 text-lg mb-6">Try adjusting your search criteria or filters</p>
              <Button 
                variant="outline" 
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105 px-8 py-3"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSpecialty('all');
                  setPriceRange('all');
                }}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}




