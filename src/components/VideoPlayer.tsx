import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
}

export default function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('🎬 Video element initialized, URL:', videoUrl.substring(0, 100) + '...');

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      // Also check duration periodically in case it becomes available later
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        if (duration !== video.duration) {
          setDuration(video.duration);
          console.log('✅ Video duration updated during playback:', video.duration);
        }
      }
    };
    const updateDuration = () => {
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        setIsLoading(false);
        console.log('✅ Video duration loaded:', video.duration);
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      console.log('▶️ Video playing');
      // Check duration when video starts playing
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      console.log('⏸️ Video paused');
    };
    const handleLoadedMetadata = () => {
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        setIsLoading(false);
        console.log('✅ Video metadata loaded, duration:', video.duration);
      } else {
        console.warn('⚠️ Video metadata loaded but duration not available yet');
      }
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      console.log('✅ Video can play');
      // Try to get duration when video can play
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    const handleLoadedData = () => {
      // Duration might be available after data loads
      if (video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        console.log('✅ Video duration loaded from loadeddata event:', video.duration);
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);

    // Set the video source and load it
    video.src = videoUrl;
    video.load();

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [videoUrl]); // Only depend on videoUrl, not isPlaying

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + 10, duration);
  }, [duration]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(video.currentTime - 10, 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen();
    } else if ((video as any).mozRequestFullScreen) {
      (video as any).mozRequestFullScreen();
    } else if ((video as any).msRequestFullscreen) {
      (video as any).msRequestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          setIsMuted(video.volume === 0);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayPause, skipForward, skipBackward, toggleMute, toggleFullscreen]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="w-full h-full flex flex-col">
        {/* Video Element */}
        <div className="flex-1 flex items-center justify-center relative">
          <video
            ref={videoRef}
            className="max-w-full max-h-full"
            preload="auto"
            playsInline
            controls={false}
            onLoadedData={() => {
              const video = videoRef.current;
              if (video && video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
                setDuration(video.duration);
                console.log('✅ Duration set from onLoadedData:', video.duration);
              }
              setIsLoading(false);
              setError(null);
            }}
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (video && video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
                setDuration(video.duration);
                console.log('✅ Duration set from onLoadedMetadata:', video.duration);
              }
              setIsLoading(false);
              setError(null);
            }}
            onCanPlay={() => {
              const video = videoRef.current;
              if (video && video.duration && video.duration !== Infinity && !isNaN(video.duration) && video.duration > 0) {
                setDuration(video.duration);
                console.log('✅ Duration set from onCanPlay:', video.duration);
              }
              setIsLoading(false);
              setError(null);
            }}
            onError={(e) => {
              setIsLoading(false);
              const video = e.currentTarget;
              let errorMessage = 'Failed to load video';
              
              if (video.error) {
                switch (video.error.code) {
                  case video.error.MEDIA_ERR_ABORTED:
                    errorMessage = 'Video loading was aborted';
                    break;
                  case video.error.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error while loading video. This might be a CORS issue.';
                    break;
                  case video.error.MEDIA_ERR_DECODE:
                    errorMessage = 'Video decoding error';
                    break;
                  case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Video format not supported or source not found';
                    break;
                  default:
                    errorMessage = `Video error: ${video.error.message || 'Unknown error'}`;
                }
              }
              
              console.error('❌ Video error:', {
                code: video.error?.code,
                message: video.error?.message,
                errorMessage,
                videoUrl: videoUrl.substring(0, 100)
              });
              setError(errorMessage);
            }}
            onLoadStart={() => {
              setIsLoading(true);
              setError(null);
              console.log('🔄 Video load started');
            }}
            onProgress={() => {
              const video = videoRef.current;
              if (video && video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const bufferedPercent = (bufferedEnd / video.duration) * 100;
                console.log(`📊 Video buffered: ${bufferedPercent.toFixed(1)}%`);
              }
            }}
          />
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-lg">Loading video...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 p-8">
              <div className="text-red-400 text-xl font-semibold mb-4">⚠️ Video Error</div>
              <div className="text-white text-lg mb-4 text-center">{error}</div>
              <div className="text-gray-400 text-sm mb-6 text-center max-w-md">
                This could be due to CORS restrictions, network issues, or an unsupported video format.
              </div>
              <Button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  const video = videoRef.current;
                  if (video) {
                    video.load();
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Retry
              </Button>
              <Button
                onClick={() => {
                  window.open(videoUrl, '_blank');
                }}
                variant="outline"
                className="mt-2 text-white border-white hover:bg-white/20"
              >
                Open in New Tab
              </Button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercentage}%, #4b5563 ${progressPercentage}%, #4b5563 100%)`
              }}
            />
          </div>

          {/* Control Buttons and Time */}
          <div className="flex items-center justify-between gap-4">
            {/* Left Side: Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={skipBackward}
                className="text-white hover:bg-white/20"
                title="Rewind 10 seconds"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="text-white hover:bg-white/20"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={skipForward}
                className="text-white hover:bg-white/20"
                title="Forward 10 seconds"
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Center: Time Display */}
            <div className="flex items-center gap-2 text-white text-sm font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Right Side: Fullscreen */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
                title="Fullscreen"
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}

