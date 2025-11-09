import { useEffect, useRef, useState } from 'react';
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
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // STUN/TURN servers configuration
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    initializeSocket();
    return () => {
      cleanup();
    };
  }, [meetingId]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeSocket = async () => {
    try {
      const apiBaseUrl = window.location.origin;
      const socketInstance = io(apiBaseUrl, {
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('✅ Connected to signaling server');
        setIsConnected(true);
        socketInstance.emit('join-meeting', {
          meetingId,
          userId: user?.id || 'anonymous'
        });
      });

      socketInstance.on('joined-meeting', async ({ otherUsers }) => {
        console.log('✅ Joined meeting, other users:', otherUsers);
        await startLocalStream();
        if (otherUsers.length > 0) {
          await createPeerConnection();
        }
      });

      socketInstance.on('user-joined', async () => {
        console.log('👤 Another user joined');
        await createPeerConnection();
      });

      socketInstance.on('offer', async ({ offer, senderSocketId }) => {
        console.log('📥 Received offer');
        await handleOffer(offer, senderSocketId);
      });

      socketInstance.on('answer', async ({ answer }) => {
        console.log('📥 Received answer');
        await handleAnswer(answer);
      });

      socketInstance.on('ice-candidate', async ({ candidate }) => {
        console.log('📥 Received ICE candidate');
        await handleIceCandidate(candidate);
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
    } catch (error) {
      console.error('Error initializing socket:', error);
    }
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const createPeerConnection = async () => {
    try {
      const pc = new RTCPeerConnection(rtcConfiguration);
      
      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote stream');
        setRemoteStream(event.streams[0]);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            meetingId,
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
          meetingId,
          offer,
          targetSocketId: null
        });
      }
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, senderSocketId: string) => {
    if (!peerConnectionRef.current) {
      await createPeerConnection();
    }

    const pc = peerConnectionRef.current!;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket) {
      socket.emit('answer', {
        meetingId,
        answer,
        targetSocketId: senderSocketId
      });
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

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
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const endCall = () => {
    cleanup();
    if (onEndCall) {
      onEndCall();
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socket) {
      socket.disconnect();
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

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
        <div className="relative bg-black rounded-lg overflow-hidden">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Loading your video...</p>
              </div>
            </div>
          )}
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="h-12 w-12 text-white opacity-50" />
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
          <span className="text-green-400">● Connected</span>
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

