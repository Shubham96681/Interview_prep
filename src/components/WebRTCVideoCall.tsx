import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { apiService } from '@/lib/apiService';
import MeetingChat from './MeetingChat';

interface WebRTCVideoCallProps {
  meetingId: string;
  sessionId?: string;
  onEndCall?: () => void;
}

export default function WebRTCVideoCall({ meetingId, sessionId, onEndCall }: WebRTCVideoCallProps) {
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
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // All refs - must be called in same order
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localScreenShareStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenShareStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRecordingRef = useRef(false);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const recordingAnimationFrameRef = useRef<number | null>(null);
  const recordingLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingScreenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const socketInitializedRef = useRef(false);
  const isFirstParticipantRef = useRef(false); // Track if we're the first participant (only first one records)
  const meetingIdRef = useRef(meetingId);
  const createPeerConnectionRef = useRef<() => Promise<void>>();
  const handleOfferRef = useRef<(offer: RTCSessionDescriptionInit, senderSocketId: string) => Promise<void>>();
  const handleAnswerRef = useRef<(answer: RTCSessionDescriptionInit) => Promise<void>>();
  const handleIceCandidateRef = useRef<(candidate: RTCIceCandidateInit) => Promise<void>>();
  const cleanupRef = useRef<() => void>();
  const startRecordingRef = useRef<(() => Promise<void>) | null>(null);

  // STUN/TURN servers configuration - optimized for low latency like Zoom/Google Meet
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10, // Pre-gather ICE candidates for faster connection
    iceTransportPolicy: 'all', // Use both relay and direct connections
    bundlePolicy: 'max-bundle', // Bundle all media on single transport (lower latency)
    rtcpMuxPolicy: 'require' // Require RTCP multiplexing (lower latency)
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
    
    // Clean up recording canvas and video elements
    if (recordingAnimationFrameRef.current) {
      cancelAnimationFrame(recordingAnimationFrameRef.current);
      recordingAnimationFrameRef.current = null;
    }
    if (recordingLocalVideoRef.current) {
      recordingLocalVideoRef.current.srcObject = null;
      recordingLocalVideoRef.current = null;
    }
    if (recordingRemoteVideoRef.current) {
      recordingRemoteVideoRef.current.srcObject = null;
      recordingRemoteVideoRef.current = null;
    }
    if (recordingScreenShareVideoRef.current) {
      recordingScreenShareVideoRef.current.srcObject = null;
      recordingScreenShareVideoRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(err => console.warn('Error closing audio context:', err));
      audioContextRef.current = null;
    }
    audioDestinationRef.current = null;
    if (recordingCanvasRef.current) {
      const ctx = recordingCanvasContextRef.current;
      if (ctx) {
        ctx.clearRect(0, 0, recordingCanvasRef.current.width, recordingCanvasRef.current.height);
      }
      recordingCanvasRef.current = null;
      recordingCanvasContextRef.current = null;
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
    
    // Clear remote stream ref
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
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
      
      // Optimized constraints matching Zoom/Google Meet standards
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 640 },      // Full HD preferred, 640p minimum
          height: { ideal: 1080, min: 480 },     // Full HD preferred, 480p minimum
          frameRate: { ideal: 30, min: 15 },     // 30 FPS preferred, 15 FPS minimum
          aspectRatio: { ideal: 16/9 },          // Standard widescreen
          facingMode: 'user'                     // Front-facing camera
        },
        audio: {
          echoCancellation: true,                // Remove echo
          noiseSuppression: true,                // Remove background noise
          autoGainControl: true,                 // Automatic volume adjustment
          sampleRate: 48000,                     // High-quality audio (48kHz)
          channelCount: { ideal: 2 },            // Stereo if available
          latency: 0.01,                         // Low latency audio (10ms)
          // Advanced audio processing (Chrome-specific)
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false
        } as any // TypeScript workaround for Chrome-specific constraints
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

        socketInstance.on('joined-meeting', async ({ otherUsers, socketId }) => {
          console.log('✅ Joined meeting, other users:', otherUsers, 'my socketId:', socketId);
          
          // Determine if we're the first participant (only first one should record)
          // If there are no other users when we join, we're the first
          isFirstParticipantRef.current = otherUsers.length === 0;
          console.log(`📹 Recording role: ${isFirstParticipantRef.current ? 'RECORDER (first participant)' : 'NON-RECORDER (second participant)'}`);
          
          // Ensure local stream is started
          if (!localStreamRef.current) {
            try {
              await startLocalStreamMemo();
            } catch (err) {
              console.error('Error starting local stream:', err);
            }
          }
          
          // Create peer connection
          setTimeout(() => {
            if (createPeerConnectionRef.current) {
              createPeerConnectionRef.current().catch(err => {
                console.error('Error creating peer connection:', err);
              });
            }
          }, 100);
          
          // If there are other users, send them an offer after peer connection is created
          // This happens when joining an existing meeting
          if (otherUsers.length > 0) {
            console.log('👥 Other users in room, will send offer after peer connection is created...');
            // Wait for peer connection to be created, then send offer
            setTimeout(async () => {
              if (peerConnectionRef.current && socketInstance) {
                const pc = peerConnectionRef.current;
                // Wait a bit more to ensure peer connection is fully ready
                await new Promise(resolve => setTimeout(resolve, 200));
                if (pc.signalingState === 'stable') {
                  try {
                    console.log('📤 Sending offer to existing users...');
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socketInstance.emit('offer', {
                      meetingId: meetingIdRef.current,
                      offer,
                      targetSocketId: null // Broadcast to all in room
                    });
                    console.log('✅ Offer sent to existing users');
                  } catch (err) {
                    console.error('Error sending offer to existing users:', err);
                  }
                } else {
                  console.log('⚠️ Peer connection not ready, state:', pc.signalingState);
                }
              }
            }, 700);
          } else {
            // No other users - we're the first one
            // We'll send an offer when someone joins (handled in user-joined event)
            console.log('👤 We are the first user, will send offer when someone joins');
            // But also, send an offer after peer connection is ready, in case the server
            // didn't include other users in the list (timing issue)
            setTimeout(async () => {
              if (peerConnectionRef.current && socketInstance) {
                const pc = peerConnectionRef.current;
                await new Promise(resolve => setTimeout(resolve, 300));
                if (pc.signalingState === 'stable' && !pc.localDescription) {
                  try {
                    console.log('📤 Sending initial offer (first user, no other users detected)...');
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socketInstance.emit('offer', {
                      meetingId: meetingIdRef.current,
                      offer,
                      targetSocketId: null // Broadcast to all in room
                    });
                    console.log('✅ Initial offer sent');
                  } catch (err) {
                    console.error('Error sending initial offer:', err);
                  }
                }
              }
            }, 800);
          }
        });

        socketInstance.on('user-joined', async ({ socketId }) => {
          console.log('👤 Another user joined:', socketId);
          // When a new user joins, if we already have a peer connection,
          // send them an offer
          if (peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            // We can only create a new offer if we're in stable state
            // If we already have a local description, we can't create another offer on the same connection
            // So we need to wait for the new user to send us an offer
            if (pc.signalingState === 'stable' && !pc.localDescription) {
              try {
                console.log('📤 Sending offer to new user:', socketId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socketInstance.emit('offer', {
                  meetingId: meetingIdRef.current,
                  offer,
                  targetSocketId: socketId
                });
                console.log('✅ Offer sent to new user');
              } catch (err) {
                console.error('Error sending offer to new user:', err);
              }
            } else if (pc.localDescription) {
              // We already have a local description, so we can't send another offer
              // The new user will create their peer connection and send us an offer
              console.log('👤 Already have local description, waiting for new user to send offer...');
            } else {
              console.log('👤 Peer connection not in stable state:', pc.signalingState, ', waiting...');
            }
          } else {
            // Create peer connection first, then it will send offer
            console.log('👤 Creating peer connection for new user...');
            setTimeout(() => {
              if (createPeerConnectionRef.current) {
                createPeerConnectionRef.current().catch(err => {
                  console.error('Error creating peer connection:', err);
                });
              }
            }, 100);
          }
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
          if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
          }
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
      console.log('📹 Setting remote stream to video element. Tracks:', remoteStream.getTracks().length);
      
      // Log track details
      remoteStream.getTracks().forEach(track => {
        console.log(`📹 Track: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
      });
      
      const videoElement = remoteVideoRef.current;
      videoElement.srcObject = remoteStream;
      
      // Force video to play
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log('✅ Remote video playing');
        } catch (err: any) {
          console.error('❌ Error playing remote video:', err);
          // Try again after a short delay
          setTimeout(() => {
            videoElement.play().catch(e => console.error('Retry play failed:', e));
          }, 500);
        }
      };
      
      // Try to play when metadata is loaded
      videoElement.onloadedmetadata = () => {
        console.log('✅ Remote video metadata loaded');
        playVideo();
      };
      
      // Try to play when video can play
      videoElement.oncanplay = () => {
        console.log('✅ Remote video can play');
        playVideo();
      };
      
      // Log when video actually starts playing
      videoElement.onplay = () => {
        console.log('✅ Remote video started playing');
      };
      
      // Try to play immediately
      playVideo();
      
      // Monitor track changes
      remoteStream.getTracks().forEach(track => {
        track.onmute = () => {
          console.log(`📹 Remote ${track.kind} track muted`);
        };
        track.onunmute = () => {
          console.log(`📹 Remote ${track.kind} track unmuted`);
        };
        track.onended = () => {
          console.log(`📹 Remote ${track.kind} track ended`);
        };
      });
    } else if (!remoteStream && remoteVideoRef.current) {
      console.log('📹 Clearing remote video element');
      remoteVideoRef.current.srcObject = null;
    }
    return () => {
      // Don't clear here - let cleanup handle it
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
      
      // Optimize peer connection for low latency and high quality
      // Set bandwidth constraints (adaptive based on network)
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
          // Configure bandwidth for optimal quality/latency balance
          // These settings match Zoom/Google Meet standards
          pc.getSenders().forEach(async (sender) => {
            if (sender.track && sender.track.kind === 'video') {
              const params = sender.getParameters();
              if (!params.encodings) {
                params.encodings = [{}];
              }
              
              // Adaptive bitrate: start high, let browser adapt
              params.encodings[0] = {
                ...params.encodings[0],
                maxBitrate: 2500000, // 2.5 Mbps max (high quality)
                maxFramerate: 30,    // 30 FPS (smooth video)
                scaleResolutionDownBy: 1 // Start at full resolution
              };
              
              // Try to enable simulcast (multiple quality layers) if supported
              if (params.encodings.length === 1 && 'setSimulcast' in sender) {
                // Simulcast: send multiple quality layers for adaptive streaming
                params.encodings = [
                  { rid: 'high', maxBitrate: 2500000, maxFramerate: 30, scaleResolutionDownBy: 1 },
                  { rid: 'medium', maxBitrate: 1000000, maxFramerate: 20, scaleResolutionDownBy: 2 },
                  { rid: 'low', maxBitrate: 500000, maxFramerate: 15, scaleResolutionDownBy: 4 }
                ];
              }
              
              try {
                await sender.setParameters(params);
                console.log('✅ Video encoding parameters optimized:', params.encodings);
              } catch (err) {
                console.warn('⚠️ Could not set encoding parameters:', err);
              }
            } else if (sender.track && sender.track.kind === 'audio') {
              const params = sender.getParameters();
              if (!params.encodings) {
                params.encodings = [{}];
              }
              
              // Optimize audio for low latency
              params.encodings[0] = {
                ...params.encodings[0],
                maxBitrate: 128000 // 128 kbps (high quality audio)
              };
              
              try {
                await sender.setParameters(params);
                console.log('✅ Audio encoding parameters optimized');
              } catch (err) {
                console.warn('⚠️ Could not set audio encoding parameters:', err);
              }
            }
          });
        }
      });
      
      // Add local stream tracks with optimized settings
      currentStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind, track.enabled, track.label);
        const sender = pc.addTrack(track, currentStream!);
        
        // Immediately configure encoding for video tracks
        if (track.kind === 'video' && 'getParameters' in sender) {
          // Set initial parameters
          setTimeout(async () => {
            try {
              const params = sender.getParameters();
              if (!params.encodings) {
                params.encodings = [{}];
              }
              params.encodings[0] = {
                maxBitrate: 2500000,
                maxFramerate: 30,
                scaleResolutionDownBy: 1
              };
              await sender.setParameters(params);
            } catch (err) {
              // Ignore if not supported
            }
          }, 100);
        }
      });

      // Handle remote stream - collect all tracks into a single stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote track:', event.track.kind, event.track.id, event.track.label);
        
        // Check if this is a screen share track
        const trackSettings = event.track.getSettings ? event.track.getSettings() : {};
        const isScreenShare = event.track.kind === 'video' && 
          (trackSettings.displaySurface === 'monitor' || 
           trackSettings.displaySurface === 'window' ||
           trackSettings.displaySurface === 'browser' ||
           event.track.label.toLowerCase().includes('screen') ||
           event.track.label.toLowerCase().includes('display'));
        
        if (isScreenShare) {
          console.log('🖥️ Remote screen share detected!');
          // Store remote screen share stream
          if (!remoteScreenShareStreamRef.current) {
            remoteScreenShareStreamRef.current = new MediaStream();
          }
          remoteScreenShareStreamRef.current.addTrack(event.track);
          setIsRemoteScreenSharing(true);
          
          // If recording is active, update the screen share video element
          if (isRecordingRef.current && recordingScreenShareVideoRef.current) {
            recordingScreenShareVideoRef.current.srcObject = remoteScreenShareStreamRef.current;
            console.log('📹 Updated recording screen share video with remote stream');
          }
          
          // Handle screen share track ending
          event.track.onended = () => {
            console.log('🖥️ Remote screen share ended');
            setIsRemoteScreenSharing(false);
            remoteScreenShareStreamRef.current = null;
            if (recordingScreenShareVideoRef.current) {
              recordingScreenShareVideoRef.current.srcObject = null;
            }
          };
        } else {
          // Regular video/audio track
          // Get or create remote stream
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
            console.log('📹 Created new remote stream');
          }
          
          // Add track to remote stream
          remoteStreamRef.current.addTrack(event.track);
          console.log('📹 Added track to remote stream. Total tracks:', remoteStreamRef.current.getTracks().length);
          
          // Update state with the stream
          const updatedStream = new MediaStream(remoteStreamRef.current.getTracks());
          setRemoteStream(updatedStream);
          
          // Update remote video element
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = updatedStream;
            remoteVideoRef.current.play().catch(err => {
              console.error('Error playing remote video:', err);
            });
          }
          
          // Log track details
          event.track.onended = () => {
            console.log('📹 Remote track ended:', event.track.kind);
          };
          
          event.track.onmute = () => {
            console.log('📹 Remote track muted:', event.track.kind);
          };
          
          event.track.onunmute = () => {
            console.log('📹 Remote track unmuted:', event.track.kind);
          };
          
          // Ensure track is enabled
          if (!event.track.enabled) {
            console.log('📹 Enabling remote track:', event.track.kind);
            event.track.enabled = true;
          }
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('🧊 Sending ICE candidate...');
          socket.emit('ice-candidate', {
            meetingId: meetingIdRef.current,
            candidate: event.candidate,
            targetSocketId: null // null means broadcast to all in room
          });
        } else if (!event.candidate) {
          console.log('🧊 ICE gathering complete (no more candidates)');
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('✅ Peer connection established!');
          // Auto-start recording when connection is established (only if we're the first participant)
          const isFirstParticipant = isFirstParticipantRef.current;
          const hasLocalStream = !!(localStreamRef.current || localStream);
          const hasRemoteStream = !!(remoteStreamRef.current || remoteStream);
          const notRecording = !isRecordingRef.current && !recordingStarted;
          
          console.log('🔍 Connection state handler - recording check:', {
            isFirstParticipant,
            hasLocalStream,
            hasRemoteStream,
            notRecording,
            hasStartRecordingRef: !!startRecordingRef.current,
            isRecordingRef: isRecordingRef.current,
            recordingStarted
          });
          
          if (isFirstParticipant && notRecording && hasLocalStream && startRecordingRef.current) {
            setTimeout(() => {
              if (!isRecordingRef.current && !recordingStarted && startRecordingRef.current) {
                console.log('🎬 Auto-starting recording (peer connection established, first participant)...');
                startRecordingRef.current();
              } else {
                console.log('⚠️ Recording start cancelled in connection handler:', {
                  isRecording: isRecordingRef.current,
                  recordingStarted,
                  hasRef: !!startRecordingRef.current
                });
              }
            }, 1000); // Wait 1 second to ensure streams are ready
          } else if (!isFirstParticipant) {
            console.log('📹 Not recording: we are not the first participant (second participant does not record)');
          } else {
            console.log('⚠️ Cannot start recording in connection handler:', {
              isFirstParticipant,
              notRecording,
              hasLocalStream,
              hasStartRecordingRef: !!startRecordingRef.current
            });
          }
        } else if (pc.connectionState === 'failed') {
          console.error('❌ Peer connection failed');
        } else if (pc.connectionState === 'disconnected') {
          console.warn('⚠️ Peer connection disconnected');
        }
      };
      
      // Handle ICE connection state changes - optimized for low latency
      pc.oniceconnectionstatechange = async () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('✅ ICE connection established!');
          
          // Optimize connection once established
          pc.getSenders().forEach(async (sender) => {
            if (sender.track && sender.track.kind === 'video') {
              try {
                const params = sender.getParameters();
                if (!params.encodings) {
                  params.encodings = [{}];
                }
                
                // Ensure optimal settings are applied
                params.encodings[0] = {
                  ...params.encodings[0],
                  maxBitrate: 2500000,
                  maxFramerate: 30
                };
                
                await sender.setParameters(params);
                console.log('✅ Video encoding optimized after connection');
              } catch (err) {
                // Ignore errors
              }
            }
          });
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('⚠️ ICE connection failed, attempting restart...');
          // Try to restart ICE
          try {
            await pc.restartIce();
            console.log('🔄 ICE restart initiated');
          } catch (err) {
            console.error('❌ Failed to restart ICE:', err);
          }
        }
      };
      
      // Optimize ICE gathering for faster connection
      pc.onicegatheringstatechange = () => {
        console.log('🧊 ICE gathering state:', pc.iceGatheringState);
        if (pc.iceGatheringState === 'complete') {
          console.log('✅ ICE gathering complete (no more candidates)');
        }
      };

      peerConnectionRef.current = pc;

      // Create and send offer if we're the first to join
      // Only send offer if we don't already have a local description
      if (socket && pc.signalingState === 'stable') {
        console.log('📤 Creating and sending offer...');
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log('📤 Offer created, sending to server...');
          socket.emit('offer', {
            meetingId: meetingIdRef.current,
            offer,
            targetSocketId: null // null means broadcast to all in room
          });
          console.log('✅ Offer sent to server');
        } catch (error) {
          console.error('❌ Error creating/sending offer:', error);
        }
      } else {
        console.log('📤 Skipping offer creation - signaling state:', pc.signalingState);
      }
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  }, [localStream, socket, startLocalStreamMemo]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, senderSocketId: string) => {
    console.log('📥 Received offer from:', senderSocketId);
    
    if (!peerConnectionRef.current) {
      console.log('📥 No peer connection, creating one...');
      await createPeerConnection();
    }

    const pc = peerConnectionRef.current!;
    
    // Check if we already have a remote description (race condition protection)
    if (pc.remoteDescription) {
      console.log('⚠️ Already have remote description, ignoring duplicate offer');
      return;
    }
    
    try {
      console.log('📥 Setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      console.log('📥 Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('📥 Answer created, sending to server...');

      if (socket) {
        socket.emit('answer', {
          meetingId: meetingIdRef.current,
          answer,
          targetSocketId: senderSocketId
        });
        console.log('✅ Answer sent to:', senderSocketId);
      }
    } catch (error: any) {
      console.error('❌ Error handling offer:', error);
      // If error is because we already have a remote description, that's okay
      if (error.message && error.message.includes('already')) {
        console.log('ℹ️ Remote description already set, continuing...');
      }
    }
  }, [socket, createPeerConnection]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('📥 Received answer');
    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current;
      
      // Check current state
      console.log('📥 Current connection state:', pc.connectionState);
      console.log('📥 Current signaling state:', pc.signalingState);
      console.log('📥 Current remote description:', pc.remoteDescription ? 'exists' : 'none');
      
      // Check if we already have this answer
      if (pc.remoteDescription) {
        console.log('⚠️ Already have remote description, checking if it matches...');
        // If we already have a remote description, the answer might be a duplicate
        // This can happen in race conditions - it's usually safe to ignore
        return;
      }
      
      // Only set remote description if we're in the right state
      if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'stable') {
        try {
          console.log('📥 Setting remote description from answer...');
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description set from answer');
          console.log('📥 New signaling state:', pc.signalingState);
        } catch (error: any) {
          console.error('❌ Error setting remote description from answer:', error);
          // If already set, that's okay
          if (error.message && (error.message.includes('already') || error.message.includes('stable'))) {
            console.log('ℹ️ Remote description already set or in wrong state');
          }
        }
      } else {
        console.warn('⚠️ Received answer but in wrong signaling state:', pc.signalingState);
        // Try to set it anyway - sometimes the state check is too strict
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Successfully set remote description despite state check');
        } catch (err) {
          console.error('❌ Failed to set remote description:', err);
        }
      }
    } else {
      console.warn('⚠️ Received answer but no peer connection exists');
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log('🧊 Received ICE candidate');
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added');
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ Received ICE candidate but no peer connection exists');
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
          video: {
            displaySurface: 'monitor',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          } as MediaTrackConstraints,
          audio: true
        });

        // Store screen share stream for recording
        localScreenShareStreamRef.current = screenStream;

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          setIsScreenSharing(true);

          videoTrack.onended = () => {
            localScreenShareStreamRef.current = null;
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
          localScreenShareStreamRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const startRecording = useCallback(async () => {
    // Store ref for access in event handlers
    startRecordingRef.current = startRecording;
    
    // Get streams from refs (most up-to-date) or state
    const currentLocalStream = localStreamRef.current || localStream;
    const currentRemoteStream = remoteStreamRef.current || remoteStream;
    
    if (!currentLocalStream && !currentRemoteStream) {
      console.warn('⚠️ Cannot start recording: no streams available');
      return;
    }

    // Don't start if already recording
    if (isRecordingRef.current || mediaRecorderRef.current) {
      console.log('⚠️ Recording already in progress');
      return;
    }

    try {
      console.log('🎬 Starting combined video recording (Zoom-style)...');
      
      // Get screen share streams (if any)
      const currentLocalScreenShare = localScreenShareStreamRef.current;
      const currentRemoteScreenShare = remoteScreenShareStreamRef.current;
      const hasScreenShare = !!(currentLocalScreenShare || currentRemoteScreenShare);
      
      console.log('📹 Screen share status:', {
        local: !!currentLocalScreenShare,
        remote: !!currentRemoteScreenShare,
        hasScreenShare
      });
      
      // Create hidden video elements for recording
      const localVideo = document.createElement('video');
      localVideo.srcObject = currentLocalStream || null;
      localVideo.autoplay = true;
      localVideo.playsInline = true;
      localVideo.muted = true; // Mute to avoid feedback
      recordingLocalVideoRef.current = localVideo;
      
      const remoteVideo = document.createElement('video');
      remoteVideo.srcObject = currentRemoteStream || null;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.muted = true; // Mute to avoid feedback
      recordingRemoteVideoRef.current = remoteVideo;
      
      // Create screen share video element (if screen sharing)
      let screenShareVideo: HTMLVideoElement | null = null;
      if (hasScreenShare) {
        screenShareVideo = document.createElement('video');
        // Prefer local screen share, fallback to remote
        screenShareVideo.srcObject = (currentLocalScreenShare || currentRemoteScreenShare) || null;
        screenShareVideo.autoplay = true;
        screenShareVideo.playsInline = true;
        screenShareVideo.muted = true;
        recordingScreenShareVideoRef.current = screenShareVideo;
        console.log('📹 Screen share video element created for recording');
      }

      // Wait for all videos (including screen share) to be ready
      const videoPromises = [
        new Promise<void>((resolve) => {
          if (currentLocalStream) {
            let resolved = false;
            const checkReady = async () => {
              if (resolved) return;
              try {
                // Wait for metadata
                if (localVideo.readyState >= 2) {
                  await localVideo.play();
                  // Wait for video to actually start playing and have frames
                  let attempts = 0;
                  const waitForFrames = () => {
                    if (localVideo.readyState >= 2 && localVideo.videoWidth > 0 && localVideo.videoHeight > 0) {
                      console.log('✅ Local video ready for recording:', localVideo.videoWidth, 'x', localVideo.videoHeight, 'readyState:', localVideo.readyState);
                      resolved = true;
                      resolve();
                    } else if (attempts < 20) {
                      attempts++;
                      setTimeout(waitForFrames, 100);
                    } else {
                      console.warn('⚠️ Local video timeout, continuing anyway');
                      resolved = true;
                      resolve();
                    }
                  };
                  waitForFrames();
                } else {
                  localVideo.onloadedmetadata = checkReady;
                  localVideo.oncanplay = checkReady;
                }
              } catch (err) {
                console.error('Error playing local video:', err);
                if (!resolved) {
                  resolved = true;
                  resolve(); // Continue anyway
                }
              }
            };
            localVideo.onloadedmetadata = checkReady;
            localVideo.oncanplay = checkReady;
            // Fallback timeout
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                console.warn('⚠️ Local video timeout, continuing anyway');
                resolve();
              }
            }, 3000);
          } else {
            resolve();
          }
        }),
        new Promise<void>((resolve) => {
          if (currentRemoteStream) {
            let resolved = false;
            const checkReady = async () => {
              if (resolved) return;
              try {
                // Wait for metadata
                if (remoteVideo.readyState >= 2) {
                  await remoteVideo.play();
                  // Wait for video to actually start playing and have frames
                  let attempts = 0;
                  const waitForFrames = () => {
                    if (remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0 && remoteVideo.videoHeight > 0) {
                      console.log('✅ Remote video ready for recording:', remoteVideo.videoWidth, 'x', remoteVideo.videoHeight, 'readyState:', remoteVideo.readyState);
                      resolved = true;
                      resolve();
                    } else if (attempts < 20) {
                      attempts++;
                      setTimeout(waitForFrames, 100);
                    } else {
                      console.warn('⚠️ Remote video timeout, continuing anyway');
                      resolved = true;
                      resolve();
                    }
                  };
                  waitForFrames();
                } else {
                  remoteVideo.onloadedmetadata = checkReady;
                  remoteVideo.oncanplay = checkReady;
                }
              } catch (err) {
                console.error('Error playing remote video:', err);
                if (!resolved) {
                  resolved = true;
                  resolve(); // Continue anyway
                }
              }
            };
            remoteVideo.onloadedmetadata = checkReady;
            remoteVideo.oncanplay = checkReady;
            // Fallback timeout
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                console.warn('⚠️ Remote video timeout, continuing anyway');
                resolve();
              }
            }, 3000);
          } else {
            resolve();
          }
        })
      ];
      
      // Add screen share video ready promise if screen sharing
      if (screenShareVideo && hasScreenShare) {
        videoPromises.push(
          new Promise<void>((resolve) => {
            let resolved = false;
            const checkReady = async () => {
              if (resolved) return;
              try {
                if (screenShareVideo && screenShareVideo.readyState >= 2) {
                  await screenShareVideo.play();
                  let attempts = 0;
                  const waitForFrames = () => {
                    if (screenShareVideo && screenShareVideo.readyState >= 2 && screenShareVideo.videoWidth > 0 && screenShareVideo.videoHeight > 0) {
                      console.log('✅ Screen share video ready for recording:', screenShareVideo.videoWidth, 'x', screenShareVideo.videoHeight);
                      resolved = true;
                      resolve();
                    } else if (attempts < 20) {
                      attempts++;
                      setTimeout(waitForFrames, 100);
                    } else {
                      console.warn('⚠️ Screen share video timeout, continuing anyway');
                      resolved = true;
                      resolve();
                    }
                  };
                  waitForFrames();
                } else if (screenShareVideo) {
                  screenShareVideo.onloadedmetadata = checkReady;
                  screenShareVideo.oncanplay = checkReady;
                }
              } catch (err) {
                console.error('Error playing screen share video:', err);
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              }
            };
            if (screenShareVideo) {
              screenShareVideo.onloadedmetadata = checkReady;
              screenShareVideo.oncanplay = checkReady;
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  console.warn('⚠️ Screen share video timeout, continuing anyway');
                  resolve();
                }
              }, 3000);
            } else {
              resolve();
            }
          })
        );
      }
      
      await Promise.all(videoPromises);
      
      // Additional wait to ensure videos are actually rendering frames
      await new Promise(r => setTimeout(r, 500));

      // Determine optimal canvas resolution based on video sources
      let canvasWidth = 1920; // Full HD width
      let canvasHeight = 1080; // Full HD height
      
      // If screen sharing, use screen share dimensions (full screen)
      if (hasScreenShare && screenShareVideo && screenShareVideo.videoWidth > 0 && screenShareVideo.videoHeight > 0) {
        canvasWidth = Math.max(1920, screenShareVideo.videoWidth);
        canvasHeight = Math.max(1080, screenShareVideo.videoHeight);
        console.log('📐 Using screen share-based canvas size:', canvasWidth, 'x', canvasHeight);
      } else if (localVideo.videoWidth > 0 && localVideo.videoHeight > 0) {
        // Use the larger video dimension as base
        const maxWidth = Math.max(localVideo.videoWidth, remoteVideo.videoWidth || 0);
        const maxHeight = Math.max(localVideo.videoHeight, remoteVideo.videoHeight || 0);
        if (maxWidth > 0 && maxHeight > 0) {
          // For side-by-side, we need double width
          canvasWidth = Math.max(1920, maxWidth * 2);
          canvasHeight = Math.max(1080, maxHeight);
          console.log('📐 Using video-based canvas size:', canvasWidth, 'x', canvasHeight);
        }
      }

      // Create canvas for combining videos with high resolution
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      recordingCanvasRef.current = canvas;
      
      const ctx = canvas.getContext('2d', { 
        alpha: false, // No transparency for better performance
        desynchronized: true // Better performance
      });
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      recordingCanvasContextRef.current = ctx;
      
      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Set canvas background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Function to draw videos on canvas (Zoom-style: screen share full screen, participants in small windows)
      // CRITICAL: This must run continuously at 30 FPS for smooth video
      const drawVideos = () => {
        if (!recordingCanvasContextRef.current || !recordingCanvasRef.current) {
          console.warn('⚠️ Canvas context or canvas not available, stopping draw loop');
          return;
        }
        
        if (!isRecordingRef.current) {
          // Stop drawing if not recording
          return;
        }
        
        const ctx = recordingCanvasContextRef.current;
        const canvas = recordingCanvasRef.current;
        
        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Check if videos are ready and have valid dimensions
        const hasLocal = currentLocalStream && localVideo.readyState >= 2 && localVideo.videoWidth > 0 && localVideo.videoHeight > 0;
        const hasRemote = currentRemoteStream && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0 && remoteVideo.videoHeight > 0;
        const hasScreenShare = screenShareVideo && screenShareVideo.readyState >= 2 && screenShareVideo.videoWidth > 0 && screenShareVideo.videoHeight > 0;
        
        // Ensure videos are playing
        if (hasLocal && localVideo.paused) {
          localVideo.play().catch(err => console.warn('Could not play local video:', err));
        }
        if (hasRemote && remoteVideo.paused) {
          remoteVideo.play().catch(err => console.warn('Could not play remote video:', err));
        }
        if (hasScreenShare && screenShareVideo && screenShareVideo.paused) {
          screenShareVideo.play().catch(err => console.warn('Could not play screen share video:', err));
        }
        
        // Zoom-style layout: Screen share takes full screen, participants in small windows at bottom
        if (hasScreenShare && screenShareVideo) {
          // Draw screen share full screen (main content)
          const screenAspect = screenShareVideo.videoWidth / screenShareVideo.videoHeight;
          let screenWidth = canvas.width;
          let screenHeight = canvas.width / screenAspect;
          let screenX = 0;
          let screenY = (canvas.height - screenHeight) / 2;
          
          // If height exceeds canvas, scale down
          if (screenHeight > canvas.height) {
            screenHeight = canvas.height;
            screenWidth = screenHeight * screenAspect;
            screenX = (canvas.width - screenWidth) / 2;
            screenY = 0;
          }
          
          ctx.drawImage(screenShareVideo, screenX, screenY, screenWidth, screenHeight);
          
          // Draw participant videos as small windows at bottom (Zoom-style)
          const participantSize = 200; // Size of participant windows
          const padding = 10;
          const bottomY = canvas.height - participantSize - padding;
          
          if (hasRemote) {
            // Remote participant (left side at bottom)
            const remoteAspect = remoteVideo.videoWidth / remoteVideo.videoHeight;
            let remoteWidth = participantSize;
            let remoteHeight = participantSize / remoteAspect;
            if (remoteHeight > participantSize) {
              remoteHeight = participantSize;
              remoteWidth = remoteHeight * remoteAspect;
            }
            const remoteX = padding;
            const remoteY = bottomY + (participantSize - remoteHeight) / 2;
            
            // Draw with rounded corners (optional visual enhancement)
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(remoteX, remoteY, remoteWidth, remoteHeight, 8);
            ctx.clip();
            ctx.drawImage(remoteVideo, remoteX, remoteY, remoteWidth, remoteHeight);
            ctx.restore();
          }
          
          if (hasLocal) {
            // Local participant (right side at bottom)
            const localAspect = localVideo.videoWidth / localVideo.videoHeight;
            let localWidth = participantSize;
            let localHeight = participantSize / localAspect;
            if (localHeight > participantSize) {
              localHeight = participantSize;
              localWidth = localHeight * localAspect;
            }
            const localX = canvas.width - localWidth - padding;
            const localY = bottomY + (participantSize - localHeight) / 2;
            
            // Draw with rounded corners
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(localX, localY, localWidth, localHeight, 8);
            ctx.clip();
            ctx.drawImage(localVideo, localX, localY, localWidth, localHeight);
            ctx.restore();
          }
        } else {
          // No screen share - use side-by-side layout for participants
          if (hasLocal && hasRemote) {
            // Side-by-side layout: each video takes half the width, maintaining aspect ratio
            const videoWidth = canvas.width / 2;
            
            // Calculate aspect ratio for remote video
            const remoteAspect = remoteVideo.videoWidth / remoteVideo.videoHeight;
            let remoteDrawWidth = videoWidth;
            let remoteDrawHeight = videoWidth / remoteAspect;
            let remoteX = 0;
            let remoteY = (canvas.height - remoteDrawHeight) / 2;
            
            // If height exceeds canvas, scale down
            if (remoteDrawHeight > canvas.height) {
              remoteDrawHeight = canvas.height;
              remoteDrawWidth = remoteDrawHeight * remoteAspect;
              remoteX = (videoWidth - remoteDrawWidth) / 2;
              remoteY = 0;
            }
            
            // Draw remote video (left side)
            ctx.drawImage(remoteVideo, remoteX, remoteY, remoteDrawWidth, remoteDrawHeight);
            
            // Calculate aspect ratio for local video
            const localAspect = localVideo.videoWidth / localVideo.videoHeight;
            let localDrawWidth = videoWidth;
            let localDrawHeight = videoWidth / localAspect;
            let localX = videoWidth;
            let localY = (canvas.height - localDrawHeight) / 2;
            
            // If height exceeds canvas, scale down
            if (localDrawHeight > canvas.height) {
              localDrawHeight = canvas.height;
              localDrawWidth = localDrawHeight * localAspect;
              localX = videoWidth + (videoWidth - localDrawWidth) / 2;
              localY = 0;
            }
            
            // Draw local video (right side)
            ctx.drawImage(localVideo, localX, localY, localDrawWidth, localDrawHeight);
          } else if (hasLocal) {
            // Only local video - center it and maintain aspect ratio
            const scale = Math.min(canvas.width / localVideo.videoWidth, canvas.height / localVideo.videoHeight);
            const width = localVideo.videoWidth * scale;
            const height = localVideo.videoHeight * scale;
            const x = (canvas.width - width) / 2;
            const y = (canvas.height - height) / 2;
            ctx.drawImage(localVideo, x, y, width, height);
          } else if (hasRemote) {
            // Only remote video - center it and maintain aspect ratio
            const scale = Math.min(canvas.width / remoteVideo.videoWidth, canvas.height / remoteVideo.videoHeight);
            const width = remoteVideo.videoWidth * scale;
            const height = remoteVideo.videoHeight * scale;
            const x = (canvas.width - width) / 2;
            const y = (canvas.height - height) / 2;
            ctx.drawImage(remoteVideo, x, y, width, height);
          }
        }
      };

      // IMPORTANT: Set recording flag BEFORE starting draw loop
      // This ensures the draw loop doesn't exit immediately
      isRecordingRef.current = true;
      setIsRecording(true);
      
      // Start drawing loop immediately - this must run continuously for smooth video
      console.log('🎬 Starting canvas draw loop for recording...');
      
      // Store draw function reference to ensure it can access current state
      let drawLoopActive = true;
      let monitorInterval: NodeJS.Timeout | null = null;
      
      const startDrawLoop = () => {
        if (!drawLoopActive || !isRecordingRef.current) {
          console.log('🛑 Draw loop stopped (recording ended or loop deactivated)');
          return;
        }
        
        if (!recordingCanvasContextRef.current || !recordingCanvasRef.current) {
          console.warn('⚠️ Canvas not available, retrying draw loop...');
          setTimeout(startDrawLoop, 100);
          return;
        }
        
        drawVideos();
        // Schedule next frame
        recordingAnimationFrameRef.current = requestAnimationFrame(startDrawLoop);
      };
      
      // Start the loop
      startDrawLoop();
      
      // Monitor the loop to ensure it keeps running
      monitorInterval = setInterval(() => {
        if (!isRecordingRef.current) {
          drawLoopActive = false;
          if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
          }
          return;
        }
        
        // Check if animation frame is still scheduled
        if (recordingAnimationFrameRef.current === null) {
          console.warn('⚠️ Canvas draw loop stopped, restarting...');
          drawLoopActive = true;
          startDrawLoop();
        }
      }, 2000); // Check every 2 seconds

      // Create AudioContext to properly mix both participants' audio (Zoom-style)
      // This ensures both voices are audible and balanced
      console.log('🎵 Creating AudioContext for proper audio mixing...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000, // High quality audio (Zoom uses 48kHz)
      });
      audioContextRef.current = audioContext;
      
      // Create destination node for mixed audio
      const audioDestination = audioContext.createMediaStreamDestination();
      audioDestinationRef.current = audioDestination;
      
      // Get audio tracks from both participants
      const localAudioTrack = currentLocalStream?.getAudioTracks()[0];
      const remoteAudioTrack = currentRemoteStream?.getAudioTracks()[0];
      
      // Also get screen share audio if available
      const screenShareAudioTrack = (currentLocalScreenShare || currentRemoteScreenShare)?.getAudioTracks()[0];
      
      // Create audio source nodes and mix them properly
      if (localAudioTrack && localAudioTrack.enabled) {
        const localSource = audioContext.createMediaStreamSource(new MediaStream([localAudioTrack]));
        const localGain = audioContext.createGain();
        localGain.gain.value = 1.0; // Full volume for local audio
        localSource.connect(localGain);
        localGain.connect(audioDestination);
        console.log('✅ Connected local audio to mixer');
      }
      
      if (remoteAudioTrack && remoteAudioTrack.enabled) {
        const remoteSource = audioContext.createMediaStreamSource(new MediaStream([remoteAudioTrack]));
        const remoteGain = audioContext.createGain();
        remoteGain.gain.value = 1.0; // Full volume for remote audio
        remoteSource.connect(remoteGain);
        remoteGain.connect(audioDestination);
        console.log('✅ Connected remote audio to mixer');
      }
      
      // Add screen share audio if available
      if (screenShareAudioTrack && screenShareAudioTrack.enabled) {
        const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenShareAudioTrack]));
        const screenGain = audioContext.createGain();
        screenGain.gain.value = 0.8; // Slightly lower volume for screen share audio
        screenSource.connect(screenGain);
        screenGain.connect(audioDestination);
        console.log('✅ Connected screen share audio to mixer');
      }
      
      // Get the mixed audio track from the destination
      const mixedAudioTrack = audioDestination.stream.getAudioTracks()[0];
      console.log('✅ Audio mixing complete - both participants voices will be audible');

      // Create combined stream from canvas video + audio tracks
      // Use 30 FPS for smooth video (matches Zoom/Google Meet standard)
      // Higher FPS (60) would increase latency and resource usage
      // CRITICAL: The canvas must be actively drawing for captureStream to work
      const canvasStream = canvas.captureStream(30); // 30 FPS - optimal balance
      console.log('📹 Canvas stream created with', canvasStream.getVideoTracks().length, 'video track(s)');
      
      // Verify the canvas stream is active
      const canvasVideoTrack = canvasStream.getVideoTracks()[0];
      if (canvasVideoTrack) {
        console.log('✅ Canvas video track:', {
          enabled: canvasVideoTrack.enabled,
          readyState: canvasVideoTrack.readyState,
          settings: canvasVideoTrack.getSettings()
        });
        
        // Monitor track state
        canvasVideoTrack.onended = () => {
          console.error('❌ Canvas video track ended unexpectedly!');
        };
        
        canvasVideoTrack.onmute = () => {
          console.warn('⚠️ Canvas video track muted');
        };
        
        canvasVideoTrack.onunmute = () => {
          console.log('✅ Canvas video track unmuted');
        };
      } else {
        console.error('❌ No video track in canvas stream!');
      }
      const combinedStream = new MediaStream();
      
      // Add canvas video track (combined video showing both participants + screen share if active)
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (videoTrack) {
        combinedStream.addTrack(videoTrack);
        console.log('📹 Added combined canvas video track to recording');
      }
      
      // Add mixed audio track (properly mixed using AudioContext - both voices audible)
      if (mixedAudioTrack) {
        combinedStream.addTrack(mixedAudioTrack);
        console.log('🎵 Added mixed audio track to recording (both participants voices mixed)');
      } else {
        console.warn('⚠️ No mixed audio track available for recording');
      }

      if (combinedStream.getTracks().length === 0) {
        console.warn('⚠️ No tracks available for recording');
        return;
      }

      // Try to use the best available codec
      let mimeType = 'video/webm;codecs=vp8,opus';
      const codecs = [
        'video/webm;codecs=vp9,opus', // VP9 for better quality
        'video/webm;codecs=vp8,opus', // VP8 fallback
        'video/webm;codecs=h264,opus', // H.264 if supported
        'video/webm' // Fallback
      ];
      
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          console.log('✅ Using codec:', codec);
          break;
        }
      }
      
      // Optimize MediaRecorder settings for Zoom/Google Meet quality
      // Use adaptive bitrate - let browser optimize based on content
      const recorderOptions: MediaRecorderOptions = {
        mimeType: mimeType,
        videoBitsPerSecond: 4000000, // 4 Mbps for high quality (Zoom uses 3-4 Mbps)
        audioBitsPerSecond: 192000   // 192 kbps for high-quality audio
      };
      
      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      
      console.log('📹 MediaRecorder configured:', {
        mimeType,
        videoBitsPerSecond: recorder.videoBitsPerSecond,
        audioBitsPerSecond: recorder.audioBitsPerSecond,
        canvasSize: `${canvas.width}x${canvas.height}`,
        frameRate: '30 FPS'
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('📹 Recording data chunk received:', event.data.size, 'bytes');
        } else {
          console.warn('⚠️ Received empty data chunk');
        }
      };
      
      // Monitor recorder state
      recorder.onstart = () => {
        console.log('✅ MediaRecorder started, state:', recorder.state);
        
        // Mark session as in_progress when recording starts (both participants joined)
        if (sessionId && (remoteStream || remoteStreamRef.current)) {
          try {
            console.log('✅ Both participants joined - marking session as in_progress...');
            apiService.updateSessionStatus(sessionId, 'in_progress').catch(error => {
              console.error('❌ Error marking session as in_progress:', error);
            });
          } catch (error) {
            console.error('❌ Error marking session as in_progress:', error);
          }
        }
      };
      
      recorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
      };
      
      recorder.onpause = () => {
        console.warn('⚠️ MediaRecorder paused');
      };
      
      recorder.onresume = () => {
        console.log('▶️ MediaRecorder resumed');
      };

      recorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing...');
        
        // Stop draw loop
        drawLoopActive = false;
        if (monitorInterval) {
          clearInterval(monitorInterval);
          monitorInterval = null;
        }
        
        // Stop animation frame
        if (recordingAnimationFrameRef.current) {
          cancelAnimationFrame(recordingAnimationFrameRef.current);
          recordingAnimationFrameRef.current = null;
        }
        
        // Clean up video elements
        if (recordingLocalVideoRef.current) {
          recordingLocalVideoRef.current.srcObject = null;
          recordingLocalVideoRef.current = null;
        }
        if (recordingRemoteVideoRef.current) {
          recordingRemoteVideoRef.current.srcObject = null;
          recordingRemoteVideoRef.current = null;
        }
        if (recordingScreenShareVideoRef.current) {
          recordingScreenShareVideoRef.current.srcObject = null;
          recordingScreenShareVideoRef.current = null;
        }
        
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(err => console.warn('Error closing audio context:', err));
          audioContextRef.current = null;
        }
        audioDestinationRef.current = null;
        
        // Clean up canvas
        recordingCanvasRef.current = null;
        recordingCanvasContextRef.current = null;
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setIsRecording(false);
        isRecordingRef.current = false;

        // Upload recording to server if sessionId is available
        if (sessionId && blob.size > 0) {
          setIsUploading(true);
          setUploadError(null);
          try {
            console.log('📤 Uploading recording to server...', { sessionId, size: blob.size });
            const response = await apiService.uploadRecording(sessionId, blob);
            if (response.success && response.data) {
              console.log('✅ Recording uploaded successfully:', response.data.recordingUrl);
              // Update recording URL to server URL
              setRecordingUrl(response.data.recordingUrl);
              // Clean up local blob URL
              URL.revokeObjectURL(url);
            } else {
              console.error('❌ Failed to upload recording:', response.error);
              setUploadError(response.error || 'Failed to upload recording');
              // Keep local URL as fallback
            }
          } catch (error: any) {
            console.error('❌ Error uploading recording:', error);
            setUploadError(error.message || 'Failed to upload recording');
            // Keep local URL as fallback
          } finally {
            setIsUploading(false);
          }
        } else {
          console.log('⚠️ Skipping upload: sessionId not available or empty blob', { sessionId, blobSize: blob.size });
        }
      };

      recorder.onerror = (event: any) => {
        console.error('❌ Recording error:', event.error);
        setIsRecording(false);
        isRecordingRef.current = false;
      };

      // Start recording with timeslice for regular data chunks
      // timeslice: Request data every 100ms for smoother recording
      // Without timeslice, data is only available when recording stops
      try {
        recorder.start(100); // Request data every 100ms for better quality
        console.log('✅ MediaRecorder started with 100ms timeslice');
        
        // Verify recorder is actually recording
        setTimeout(() => {
          if (recorder.state === 'recording') {
            console.log('✅ MediaRecorder confirmed recording, state:', recorder.state);
          } else {
            console.error('❌ MediaRecorder not recording! State:', recorder.state);
          }
        }, 500);
      } catch (err) {
        console.error('❌ Error starting MediaRecorder:', err);
        throw err;
      }
      mediaRecorderRef.current = recorder;
      // Recording flag already set above before draw loop started
      setRecordingStarted(true);
      console.log('✅ Combined video recording started successfully');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [localStream, remoteStream, sessionId]);

  // Auto-start recording when connection is established and streams are ready
  useEffect(() => {
    // Only auto-start if:
    // 1. We are the first participant (only first one records)
    // 2. We have a peer connection
    // 3. We have at least local stream
    // 4. We haven't started recording yet
    const shouldStartRecording = () => {
      const isFirstParticipant = isFirstParticipantRef.current;
      const hasPeerConnection = peerConnectionRef.current !== null;
      const hasLocalStream = !!(localStreamRef.current || localStream);
      const notRecording = !isRecordingRef.current && !recordingStarted;
      const connectionReady = hasPeerConnection && (
        peerConnectionRef.current?.connectionState === 'connected' ||
        peerConnectionRef.current?.connectionState === 'connecting' ||
        peerConnectionRef.current?.iceConnectionState === 'connected' ||
        peerConnectionRef.current?.iceConnectionState === 'checking'
      );
      
      const result = isFirstParticipant && hasPeerConnection && hasLocalStream && notRecording && connectionReady;
      
      if (hasPeerConnection && hasLocalStream && notRecording) {
        console.log('🔍 Recording check:', {
          isFirstParticipant,
          hasPeerConnection,
          hasLocalStream,
          notRecording,
          connectionState: peerConnectionRef.current?.connectionState,
          iceConnectionState: peerConnectionRef.current?.iceConnectionState,
          hasRemoteStream: !!(remoteStream || remoteStreamRef.current),
          shouldStart: result
        });
      }
      
      return result;
    };

    if (!shouldStartRecording()) {
      return;
    }

    // Priority 1: Start recording when remote stream is received (both participants connected)
    if (remoteStream || remoteStreamRef.current) {
      console.log('⏱️ Scheduling auto-start recording (remote stream detected, waiting 1.5s)...');
      const timer = setTimeout(() => {
        // Check connection state again - it should be 'connected' by now
        const connectionState = peerConnectionRef.current?.connectionState;
        const iceState = peerConnectionRef.current?.iceConnectionState;
        console.log('⏱️ Timer fired - checking conditions:', {
          connectionState,
          iceState,
          shouldStart: shouldStartRecording(),
          isRecording: isRecordingRef.current,
          recordingStarted,
          hasStartRecording: !!startRecordingRef.current
        });
        
        if (shouldStartRecording() && !isRecordingRef.current && startRecordingRef.current) {
          console.log('🎬 Auto-starting recording (remote stream received - both participants connected)...');
          startRecordingRef.current();
        } else {
          console.log('⚠️ Recording start cancelled - conditions changed:', {
            shouldStart: shouldStartRecording(),
            isRecording: isRecordingRef.current,
            recordingStarted,
            hasStartRecording: !!startRecordingRef.current,
            connectionState,
            iceState
          });
        }
      }, 1500); // Wait 1.5 seconds after remote stream to ensure everything is ready
      return () => clearTimeout(timer);
    }
    
    // Priority 2: Start recording with local stream only (solo recording or waiting for remote)
    // Wait a bit longer to see if remote stream arrives
    console.log('⏱️ Scheduling auto-start recording (local stream only, waiting 2.5s for remote)...');
    const timer = setTimeout(() => {
      if (shouldStartRecording() && !isRecordingRef.current) {
        // Check again if remote stream arrived while waiting
        if (remoteStream || remoteStreamRef.current) {
          console.log('🎬 Auto-starting recording (remote stream detected after wait - both participants connected)...');
        } else {
          console.log('🎬 Auto-starting recording (local stream ready - solo recording or waiting for remote participant)...');
        }
        startRecording();
      } else {
        console.log('⚠️ Recording start cancelled - conditions changed:', {
          shouldStart: shouldStartRecording(),
          isRecording: isRecordingRef.current,
          recordingStarted
        });
      }
    }, 2500); // Wait 2.5 seconds to see if remote stream arrives, then start anyway
    
    return () => clearTimeout(timer);
  }, [
    localStream,
    remoteStream,
    isRecording,
    recordingStarted,
    startRecording
  ]);

  // Update startRecordingRef whenever startRecording changes
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
    }
  };

  const endCall = async () => {
    // Check if both participants joined (remoteStream exists means other participant was connected)
    const bothParticipantsJoined = !!(remoteStream || remoteStreamRef.current);
    
    // Stop recording before ending call to ensure it's uploaded
    if (mediaRecorderRef.current && isRecordingRef.current) {
      console.log('🛑 Stopping recording before ending call...');
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      
      // Wait for recording to stop and upload to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Mark session as completed if both participants joined and sessionId is available
    if (sessionId && bothParticipantsJoined) {
      try {
        console.log('✅ Both participants joined - marking session as completed...');
        // First update status to in_progress if not already set (to track start time)
        // Then mark as completed
        const response = await apiService.updateSessionStatus(sessionId, 'completed');
        if (response.success) {
          console.log('✅ Session marked as completed successfully');
        } else {
          console.error('❌ Failed to mark session as completed:', response.error);
        }
      } catch (error) {
        console.error('❌ Error marking session as completed:', error);
      }
    } else {
      if (!sessionId) {
        console.log('⚠️ Cannot mark session as completed - sessionId not available');
      }
      if (!bothParticipantsJoined) {
        console.log('⚠️ Cannot mark session as completed - both participants did not join');
      }
    }
    
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
    <div className="w-full h-full flex flex-col bg-gray-900 overflow-hidden">
      {/* Video Area */}
      <div className="flex-1 relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-0 overflow-auto">
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
      <div className="bg-gray-800 p-4 flex items-center justify-center gap-4 flex-shrink-0 z-10">
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

        <Button
          variant={isChatOpen ? "default" : "outline"}
          size="lg"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="rounded-full"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>

        {!isRecording ? (
          <Button
            variant="outline"
            size="lg"
            onClick={startRecording}
            className="rounded-full"
            disabled={recordingStarted} // Disable if auto-recording already started
          >
            <Video className="h-5 w-5 mr-2" />
            {recordingStarted ? 'Recording...' : 'Record'}
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
      <div className="bg-gray-800 px-4 py-2 text-center text-sm text-white flex-shrink-0">
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
            {isUploading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Uploading recording to server...</p>
              </div>
            ) : uploadError ? (
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">Upload failed: {uploadError}</p>
                <p className="text-xs text-gray-500 mb-2">You can still download the recording locally:</p>
                <Button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = recordingUrl;
                    a.download = `recording-${meetingId}-${Date.now()}.webm`;
                    a.click();
                  }}
                  variant="outline"
                >
                  Download Recording
                </Button>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-green-600">✅ Recording saved to server!</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (recordingUrl.startsWith('http') || recordingUrl.startsWith('/')) {
                        window.open(recordingUrl, '_blank');
                      } else {
                        const a = document.createElement('a');
                        a.href = recordingUrl;
                        a.download = `recording-${meetingId}-${Date.now()}.webm`;
                        a.click();
                      }
                    }}
                  >
                    {recordingUrl.startsWith('http') || recordingUrl.startsWith('/') ? 'View Recording' : 'Download Recording'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat Component */}
      <MeetingChat
        socket={socket}
        meetingId={meetingId}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />
    </div>
  );
}

