import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoPlayer from '@/components/VideoPlayer';
import { apiService } from '@/lib/apiService';

export default function VideoPlayerPage() {
  const [searchParams] = useSearchParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    const url = searchParams.get('url'); // Fallback for old URLs

    if (sessionId) {
      // Fetch fresh URL from backend using sessionId
      setIsLoading(true);
      setError(null);
      apiService.getRecordingUrl(sessionId)
        .then((url: string | null) => {
          if (url) {
            console.log('✅ Recording URL fetched successfully');
            setVideoUrl(url);
            setIsLoading(false);
          } else {
            console.warn('⚠️ No recording URL returned from backend');
            setError('Recording not found or unavailable for this session.');
            setIsLoading(false);
          }
        })
        .catch((err: any) => {
          console.error('❌ Error fetching recording URL:', err);
          const errorMessage = err?.message || 'Unknown error';
          if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            setError('Authentication failed. Please log in again and try accessing the recording from your dashboard.');
          } else if (errorMessage.includes('403') || errorMessage.includes('Access denied')) {
            setError('You do not have permission to access this recording.');
          } else if (errorMessage.includes('404')) {
            setError('Recording not found. The session may not have a recording available.');
          } else {
            setError(`Failed to load recording: ${errorMessage}`);
          }
          setIsLoading(false);
        });
    } else if (url) {
      // Legacy support: decode URL if passed directly
      try {
        setVideoUrl(decodeURIComponent(url));
        setIsLoading(false);
      } catch {
        setVideoUrl(url);
        setIsLoading(false);
      }
    } else {
      setError('No recording specified');
      setIsLoading(false);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading video player...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl font-semibold mb-4">⚠️ Error</div>
          <div className="text-white text-lg mb-4">{error}</div>
          <button
            onClick={() => window.close()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">No video URL available</div>
      </div>
    );
  }

  return <VideoPlayer videoUrl={videoUrl} />;
}

