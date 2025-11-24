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
            setVideoUrl(url);
            setIsLoading(false);
          } else {
            setError('Recording not found or unavailable');
            setIsLoading(false);
          }
        })
        .catch((err: any) => {
          console.error('Error fetching recording URL:', err);
          setError('Failed to load recording. Please try again.');
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

