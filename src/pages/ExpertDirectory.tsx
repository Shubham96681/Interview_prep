import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, ArrowLeft, Sparkles, Users, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpertCard from '@/components/ExpertCard';
import { apiService } from '@/lib/apiService';

interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  avatar?: string;
  profilePhotoPath?: string;
  rating: number;
  totalSessions: number;
  hourlyRate: number;
  skills?: string | string[];
  proficiency?: string | string[];
  specialties?: string[];
}

export default function ExpertDirectory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch experts from API
  useEffect(() => {
    const fetchExperts = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔍 Fetching experts from API...');
        const response = await apiService.getExperts();
        
        console.log('📥 Full API response:', response);
        console.log('📥 Response.data:', response.data);
        console.log('📥 Response.data type:', typeof response.data);
        console.log('📥 Is response.data an array?', Array.isArray(response.data));
        if (response.data && typeof response.data === 'object') {
          console.log('📥 Response.data keys:', Object.keys(response.data));
          if (response.data.experts) {
            console.log('📥 Response.data.experts:', response.data.experts);
            console.log('📥 Is experts an array?', Array.isArray(response.data.experts));
          }
        }
        
        if (response.success && response.data) {
          // Handle different response structures
          // apiService wraps backend response, so structure is:
          // { success: true, data: { success: true, data: { experts: [...], pagination: {...} } } }
          let expertsData = null;
          
          // Check if response.data is directly an array (unlikely but possible)
          if (Array.isArray(response.data)) {
            expertsData = response.data;
          }
          // Check for double nested: response.data.data.experts (apiService wraps backend response)
          else if (response.data && response.data.data) {
            // Backend returns: { success: true, data: { experts: [...], pagination: {...} } }
            // After apiService wraps: { success: true, data: { success: true, data: { experts: [...], pagination: {...} } } }
            if (response.data.data.experts && Array.isArray(response.data.data.experts)) {
              expertsData = response.data.data.experts;
            } else if (Array.isArray(response.data.data)) {
              expertsData = response.data.data;
            }
          }
          // Check for single nested: response.data.experts (if apiService doesn't wrap)
          else if (response.data && typeof response.data === 'object' && response.data.experts) {
            if (Array.isArray(response.data.experts)) {
              expertsData = response.data.experts;
            }
          }
          
          if (!expertsData || !Array.isArray(expertsData)) {
            console.error('❌ Invalid experts data structure. Full response:', JSON.stringify(response, null, 2));
            console.error('❌ Response.data:', response.data);
            setError('Invalid response format from server. Please check console for details.');
            setLoading(false);
            return;
          }
          
          console.log(`✅ Fetched ${expertsData.length} experts from API`);
          
          // Transform backend data to match frontend format
          const transformedExperts = expertsData.map((expert: any) => {
            // Parse JSON fields
            const parseJsonField = (field: any, defaultValue: any[] = []): string[] => {
              if (!field) return defaultValue;
              if (Array.isArray(field)) return field;
              if (typeof field === 'string') {
                try {
                  const parsed = JSON.parse(field);
                  return Array.isArray(parsed) ? parsed : defaultValue;
                } catch {
                  return defaultValue;
                }
              }
              return defaultValue;
            };

            const skills = parseJsonField(expert.skills, []);
            const proficiency = parseJsonField(expert.proficiency, []);
            const specialties = proficiency.length > 0 ? proficiency : skills;

            return {
              id: expert.id,
              name: expert.name || 'Unknown',
              title: expert.title || '',
              company: expert.company || '',
              bio: expert.bio || '',
              avatar: expert.avatar || expert.profilePhotoPath || '',
              rating: expert.rating || 0,
              totalSessions: expert.totalSessions || 0,
              hourlyRate: expert.hourlyRate || 0,
              specialties: specialties,
              skills: skills,
              proficiency: proficiency
            };
          });
          
          setExperts(transformedExperts);
        } else {
          console.error('❌ Failed to fetch experts:', response);
          setError('Failed to load experts. Please try again.');
        }
      } catch (err: any) {
        console.error('❌ Error fetching experts:', err);
        setError('Failed to load experts. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchExperts();
  }, []);

  // Extract all specialties from experts
  const specialties = Array.from(
    new Set(experts.flatMap(expert => expert.specialties || []))
  );

  // Filter experts based on search and filters
  const filteredExperts = experts.filter(expert => {
    const matchesSearch = !searchQuery || 
                         expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expert.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (expert.specialties || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSpecialty = selectedSpecialty === 'all' || 
                            (expert.specialties || []).includes(selectedSpecialty);
    
    const matchesPrice = priceRange === 'all' ||
                        (priceRange === 'under-100' && expert.hourlyRate < 100) ||
                        (priceRange === '100-150' && expert.hourlyRate >= 100 && expert.hourlyRate <= 150) ||
                        (priceRange === 'over-150' && expert.hourlyRate > 150);
    
    return matchesSearch && matchesSpecialty && matchesPrice;
  });

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center px-6 py-4 max-w-7xl mx-auto border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">I</span>
            </div>
            <div className="text-xl font-bold text-gray-900">InPrepare</div>
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Button>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Expert Directory
            </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find the perfect interview coach
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  placeholder="Search experts, companies, skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                />
              </div>
              
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600">
                  <SelectValue placeholder="All Specialties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties.map(specialty => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600">
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="under-100">Under $100/hr</SelectItem>
                  <SelectItem value="100-150">$100-150/hr</SelectItem>
                  <SelectItem value="over-150">Over $150/hr</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                className="h-12 flex items-center gap-3 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Filter className="h-5 w-5" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              {filteredExperts.length} Expert{filteredExperts.length !== 1 ? 's' : ''} Available
            </h2>
            {selectedSpecialty !== 'all' && (
              <Badge 
                variant="secondary" 
                className="flex items-center gap-2 bg-blue-100 text-blue-800 border-blue-200 px-4 py-2 text-sm"
              >
                {selectedSpecialty}
                <button 
                  onClick={() => setSelectedSpecialty('all')} 
                  className="ml-2 hover:bg-blue-200 rounded-full p-1 transition-colors"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Star className="h-5 w-5 text-yellow-500" />
            <span>Top rated experts</span>
          </div>
        </div>

        {/* Expert Grid */}
        {loading ? (
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-16 text-center">
              <div className="text-gray-400 mb-6">
                <Users className="h-16 w-16 mx-auto animate-pulse" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Loading experts...</h3>
              <p className="text-gray-600 text-lg">Please wait while we fetch the latest experts</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-16 text-center">
              <div className="text-red-500 mb-6">
                <Users className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Error loading experts</h3>
              <p className="text-gray-600 text-lg mb-6">{error}</p>
              <Button 
                variant="outline" 
                className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3"
                onClick={() => window.location.reload()}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredExperts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
        ) : (
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-16 text-center">
              <div className="text-gray-400 mb-6">
                <Search className="h-16 w-16 mx-auto animate-pulse" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">No experts found</h3>
              <p className="text-gray-600 text-lg mb-6">Try adjusting your search criteria or filters</p>
              <Button 
                variant="outline" 
                className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3"
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




