import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoPlayer from '@/components/VideoPlayer';

export default function VideoPlayerPage() {
  const [searchParams] = useSearchParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = searchParams.get('url');
    if (url) {
      // Decode the URL if it was encoded
      try {
        setVideoUrl(decodeURIComponent(url));
      } catch {
        setVideoUrl(url);
      }
    }
  }, [searchParams]);

  if (!videoUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading video player...</div>
      </div>
    );
  }

  return <VideoPlayer videoUrl={videoUrl} />;
}

