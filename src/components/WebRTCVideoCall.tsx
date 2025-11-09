import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';

interface WebRTCVideoCallProps {
  meetingId: string;
  onEndCall?: () => void;
}

export default function WebRTCVideoCall({ meetingId, onEndCall }: WebRTCVideoCallProps) {
  // ALL HOOKS MUST BE CALLED IN THE SAME ORDER EVERY RENDER
  // No conditional hook calls allowed!
  
  const { user } = useAuth();
  
  // All state hooks - must be called in same order
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // All refs - must be called in same order
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRecordingRef = useRef(false);
  const socketInitializedRef = useRef(false);
  const meetingIdRef = useRef(meetingId);
  const createPeerConnectionRef = useRef<() => Promise<void>>();
  const handleOfferRef = useRef<(offer: RTCSessionDescriptionInit, senderSocketId: string) => Promise<void>>();
  const handleAnswerRef = useRef<(answer: RTCSessionDescriptionInit) => Promise<void>>();
  const handleIceCandidateRef = useRef<(candidate: RTCIceCandidateInit) => Promise<void>>();
  const cleanupRef = useRef<() => void>();

  // STUN/TURN servers configuration
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Memoize cleanup function to avoid stale closures
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up video call resources...');
    
    // Stop all local stream tracks (camera and microphone) from ref
    if (localStreamRef.current) {
      console.log('🛑 Stopping local stream tracks from ref...');
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`✅ Stopped ${track.kind} track:`, track.label);
      });
      localStreamRef.current = null;
    }
    
    // Also stop tracks from state (in case ref wasn't updated)
    // We'll access this via a closure-safe approach
    const currentLocalStream = localStreamRef.current || localVideoRef.current?.srcObject as MediaStream | null;
    if (currentLocalStream) {
      console.log('🛑 Stopping local stream tracks from video element...');
      currentLocalStream.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop();
          console.log(`✅ Stopped ${track.kind} track from video element:`, track.label);
        }
      });
    }
    
    // Clear video elements to ensure camera indicator turns off
    if (localVideoRef.current) {
      console.log('🛑 Clearing local video element...');
      const stream = localVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            track.stop();
          }
        });
      }
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
    }
    
    if (remoteVideoRef.current) {
      console.log('🛑 Clearing remote video element...');
      const stream = remoteVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            track.stop();
          }
        });
      }
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      console.log('🛑 Closing peer connection...');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop media recorder if recording
    if (mediaRecorderRef.current && isRecordingRef.current) {
      console.log('🛑 Stopping media recorder...');
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
      mediaRecorderRef.current = null;
      isRecordingRef.current = false;
    }
    
    // Disconnect socket
    if (socketRef.current) {
      console.log('🛑 Disconnecting socket...');
      try {
        socketRef.current.emit('leave-meeting', { meetingId });
        socketRef.current.disconnect();
      } catch (e) {
        console.error('Error disconnecting socket:', e);
      }
      socketRef.current = null;
    }
    
    // Reset states
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    setIsScreenSharing(false);
    
    console.log('✅ Cleanup complete - all camera and microphone access should be released');
  }, [meetingId]);

  // Update meetingId ref when it changes - MUST be called before any conditional returns
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Update cleanup ref when cleanup function changes
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  // Memoize functions to prevent infinite loops
  const startLocalStreamMemo = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera and microphone access...');
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'MediaDevices API is not available. This usually requires HTTPS in production.';
        console.error('❌', errorMsg);
        alert('Camera and microphone access requires HTTPS. Please access the site via HTTPS (https://54.91.53.228) or use a secure connection.');
        throw new Error(errorMsg);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Media stream obtained:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoEnabled: stream.getVideoTracks()[0]?.enabled,
        audioEnabled: stream.getAudioTracks()[0]?.enabled
      });
      
      // Ensure tracks are enabled
      stream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log('Video track:', track.label, 'enabled:', track.enabled);
      });
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('Audio track:', track.label, 'enabled:', track.enabled);
      });
      
      // Store in ref first for immediate access
      localStreamRef.current = stream;
      
      // Also assign directly to video element if it exists
      if (localVideoRef.current) {
        console.log('📹 Directly assigning stream to video element');
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(err => {
          console.error('Direct play failed:', err);
        });
      }
      
      setLocalStream(stream);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      
      console.log('✅ Local stream set in state and ref');
    } catch (error: any) {
      console.error('❌ Error accessing media devices:', error);
      let errorMessage = 'Could not access camera/microphone. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone permissions in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera or microphone is being used by another application.';
      } else {
        errorMessage += error.message || 'Unknown error.';
      }
      alert(errorMessage);
    }
  }, []);

  useEffect(() => {
    // Prevent re-initialization if already initialized
    if (socketInitializedRef.current) {
      return;
    }
    
    if (!meetingId) {
      setError('Meeting ID is required');
      setIsInitializing(false);
      return;
    }
    
    // Mark as initialized immediately to prevent re-runs
    socketInitializedRef.current = true;
    
    // Set initial state - this will cause a re-render but the guard prevents re-initialization
    setIsInitializing(true);
    setError(null);
    
    const initializeSocket = async () => {
      try {
        console.log('🔌 Initializing socket for meeting:', meetingId);
        const apiBaseUrl = window.location.origin;
        const socketInstance = io(apiBaseUrl, {
          transports: ['websocket', 'polling']
        });

        socketInstance.on('connect', async () => {
          console.log('✅ Connected to signaling server');
          setIsConnected(true);
          
          // Start local stream immediately - call memoized function
          try {
            await startLocalStreamMemo();
          } catch (err) {
            console.error('Error starting local stream:', err);
          }
          
          socketInstance.emit('join-meeting', {
            meetingId: meetingIdRef.current,
            userId: user?.id || 'anonymous'
          });
        });

        socketInstance.on('joined-meeting', async ({ otherUsers }) => {
          console.log('✅ Joined meeting, other users:', otherUsers);
          
          // Ensure local stream is started
          if (!localStreamRef.current) {
            try {
              await startLocalStreamMemo();
            } catch (err) {
              console.error('Error starting local stream:', err);
            }
          }
          
          if (otherUsers.length > 0) {
            // Defer peer connection creation to avoid calling undefined function
            setTimeout(() => {
              if (createPeerConnectionRef.current) {
                createPeerConnectionRef.current().catch(err => {
                  console.error('Error creating peer connection:', err);
                });
              }
            }, 100);
          }
        });

        socketInstance.on('user-joined', async () => {
          console.log('👤 Another user joined');
          setTimeout(() => {
            if (createPeerConnectionRef.current) {
              createPeerConnectionRef.current().catch(err => {
                console.error('Error creating peer connection:', err);
              });
            }
          }, 100);
        });

        socketInstance.on('offer', async ({ offer, senderSocketId }) => {
          console.log('📥 Received offer');
          setTimeout(() => {
            if (handleOfferRef.current) {
              handleOfferRef.current(offer, senderSocketId).catch(err => {
                console.error('Error handling offer:', err);
              });
            }
          }, 100);
        });

        socketInstance.on('answer', async ({ answer }) => {
          console.log('📥 Received answer');
          setTimeout(() => {
            if (handleAnswerRef.current) {
              handleAnswerRef.current(answer).catch(err => {
                console.error('Error handling answer:', err);
              });
            }
          }, 100);
        });

        socketInstance.on('ice-candidate', async ({ candidate }) => {
          console.log('📥 Received ICE candidate');
          setTimeout(() => {
            if (handleIceCandidateRef.current) {
              handleIceCandidateRef.current(candidate).catch(err => {
                console.error('Error handling ICE candidate:', err);
              });
            }
          }, 100);
        });

        socketInstance.on('user-left', () => {
          console.log('👤 User left');
          setRemoteStream(null);
        });

        socketInstance.on('disconnect', () => {
          console.log('❌ Disconnected from signaling server');
          setIsConnected(false);
        });

        setSocket(socketInstance);
        socketRef.current = socketInstance;
        setIsInitializing(false);
      } catch (error: any) {
        console.error('Error initializing socket:', error);
        setError(error?.message || 'Failed to initialize video call');
        setIsInitializing(false);
        socketInitializedRef.current = false;
      }
    };
    
    initializeSocket();
    
    // Handle page unload (browser close, navigation away, etc.)
    const handleBeforeUnload = () => {
      console.log('⚠️ Page unloading, cleaning up video call...');
      // Use ref to avoid dependency issues
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
    
    // Handle visibility change (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⚠️ Page hidden, but keeping call active');
        // Don't cleanup on visibility change, just log it
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('🧹 WebRTCVideoCall component unmounting, cleaning up...');
      socketInitializedRef.current = false;
      // Cleanup will be handled by component unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]); // Only depend on meetingId - startLocalStreamMemo is stable with empty deps

  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement) return;

    if (localStream) {
      console.log('📹 Setting local stream to video element');
      videoElement.srcObject = localStream;
      
      // Force play with multiple attempts
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log('✅ Local video is playing');
        } catch (err: any) {
          console.error('❌ Error playing local video:', err);
          // Retry after a short delay
          setTimeout(() => {
            if (videoElement && videoElement.srcObject) {
              videoElement.play().catch(e => console.error('Retry play failed:', e));
            }
          }, 500);
        }
      };
      
      // Play immediately
      playVideo();
      
      // Also try when metadata is loaded
      const handleLoadedMetadata = () => {
        console.log('✅ Video metadata loaded, attempting to play');
        videoElement.play().catch(err => console.error('Play after metadata failed:', err));
      };
      
      // Also try when video can play
      const handleCanPlay = () => {
        console.log('✅ Video can play, attempting to play');
        videoElement.play().catch(err => console.error('Play after canplay failed:', err));
      };
      
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('canplay', handleCanPlay);
      
      return () => {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('canplay', handleCanPlay);
      };
    } else {
      // Clear srcObject if no stream
      videoElement.srcObject = null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Ensure video plays
      remoteVideoRef.current.play().catch(err => {
        console.error('Error playing remote video:', err);
      });
    }
    return () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  const createPeerConnection = useCallback(async () => {
    try {
      // Get local stream from ref (most up-to-date) or state
      let currentStream = localStreamRef.current || localStream;
      
      // If still no stream, try to get from video element
      if (!currentStream && localVideoRef.current?.srcObject) {
        currentStream = localVideoRef.current.srcObject as MediaStream;
        console.log('✅ Got stream from video element');
      }
      
      // If still no stream, start it
      if (!currentStream) {
        console.log('⚠️ No local stream, starting it now...');
        await startLocalStreamMemo();
        // Wait for stream to be set
        await new Promise(resolve => setTimeout(resolve, 300));
        currentStream = localStreamRef.current || localStream;
      }
      
      if (!currentStream) {
        console.error('❌ Cannot create peer connection: no local stream available');
        return;
      }
      
      // Close existing peer connection if any
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      const pc = new RTCPeerConnection(rtcConfiguration);
      
      // Add local stream tracks
      currentStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind, track.enabled, track.label);
        pc.addTrack(track, currentStream!);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote stream');
        setRemoteStream(event.streams[0]);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            meetingId: meetingIdRef.current,
            candidate: event.candidate,
            targetSocketId: null // Will be set by server
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
      };

      peerConnectionRef.current = pc;

      // Create and send offer if we're the first to join
      if (socket) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          meetingId: meetingIdRef.current,
          offer,
          targetSocketId: null
        });
      }
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  }, [localStream, socket, startLocalStreamMemo]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, senderSocketId: string) => {
    if (!peerConnectionRef.current) {
      await createPeerConnection();
    }

    const pc = peerConnectionRef.current!;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket) {
      socket.emit('answer', {
        meetingId: meetingIdRef.current,
        answer,
        targetSocketId: senderSocketId
      });
    }
  }, [socket, createPeerConnection]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  // Update refs when memoized functions are defined (runs after functions are declared)
  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
    handleOfferRef.current = handleOffer;
    handleAnswerRef.current = handleAnswer;
    handleIceCandidateRef.current = handleIceCandidate;
  }, [createPeerConnection, handleOffer, handleAnswer, handleIceCandidate]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    try {
      if (!isScreenSharing) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing is not available. HTTPS is required in production.');
        }
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          setIsScreenSharing(true);

          videoTrack.onended = () => {
            toggleScreenShare();
          };
        }
      } else {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          setIsScreenSharing(false);
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const startRecording = async () => {
    if (!localStream && !remoteStream) return;

    try {
      const combinedStream = new MediaStream();
      
      if (localStream) {
        localStream.getTracks().forEach(track => combinedStream.addTrack(track));
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => combinedStream.addTrack(track));
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setIsRecording(false);
        isRecordingRef.current = false;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
    }
  };

  const endCall = () => {
    cleanup();
    if (onEndCall) {
      onEndCall();
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-900 items-center justify-center text-white p-8">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Error</h2>
          <p className="mb-6">{error}</p>
          <Button onClick={() => {
            setError(null);
            setIsInitializing(true);
            socketInitializedRef.current = false;
            socketInitializedRef.current = false;
            if (onEndCall) {
              onEndCall();
            }
          }}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isInitializing) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-900 items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing video call...</p>
          <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Video Area */}
      <div className="flex-1 relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Remote Video */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Waiting for other participant...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video */}
        <div className="relative bg-black rounded-lg overflow-hidden w-full h-full">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ 
              opacity: localStream && isVideoEnabled ? 1 : 0,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: localStream && isVideoEnabled ? 1 : 0
            }}
            onLoadedMetadata={() => {
              console.log('✅ Video metadata loaded');
              if (localVideoRef.current) {
                localVideoRef.current.play().catch(err => console.error('Auto-play failed:', err));
              }
            }}
            onCanPlay={() => {
              console.log('✅ Video can play');
            }}
            onPlaying={() => {
              console.log('✅ Video is playing');
            }}
            onError={(e) => {
              console.error('❌ Video element error:', e);
            }}
          />
          {(!localStream || !isVideoEnabled) && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white bg-gray-900 z-10">
              <div className="text-center">
                {!localStream ? (
                  <>
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Loading your video...</p>
                    <p className="text-xs mt-2 opacity-75">Please allow camera access</p>
                  </>
                ) : (
                  <>
                    <VideoOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Camera is off</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-center gap-4">
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleAudio}
          className="rounded-full"
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        <Button
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleVideo}
          className="rounded-full"
        >
          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          variant={isScreenSharing ? "default" : "outline"}
          size="lg"
          onClick={toggleScreenShare}
          className="rounded-full"
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>

        {!isRecording ? (
          <Button
            variant="outline"
            size="lg"
            onClick={startRecording}
            className="rounded-full"
          >
            <Video className="h-5 w-5 mr-2" />
            Record
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="lg"
            onClick={stopRecording}
            className="rounded-full"
          >
            <Video className="h-5 w-5 mr-2" />
            Stop Recording
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          onClick={endCall}
          className="rounded-full"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>

      {/* Connection Status */}
      <div className="bg-gray-800 px-4 py-2 text-center text-sm text-white">
        {isConnected ? (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-green-400">● Connected</span>
            {localStream && (
              <span className="text-green-400">
                • Video: {isVideoEnabled ? 'On' : 'Off'} • Audio: {isAudioEnabled ? 'On' : 'Off'}
              </span>
            )}
            {peerConnectionRef.current && (
              <span className="text-blue-400">
                • {peerConnectionRef.current.connectionState}
              </span>
            )}
          </div>
        ) : (
          <span className="text-red-400">● Connecting...</span>
        )}
      </div>

      {/* Recording Download */}
      {recordingUrl && (
        <Card className="m-4">
          <CardContent className="p-4">
            <p className="mb-2">Recording completed!</p>
            <Button
              onClick={() => {
                const a = document.createElement('a');
                a.href = recordingUrl;
                a.download = `recording-${meetingId}-${Date.now()}.webm`;
                a.click();
              }}
            >
              Download Recording
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

