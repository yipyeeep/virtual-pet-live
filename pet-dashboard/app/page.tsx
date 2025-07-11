"use client";
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

type PetState = {
  happiness: number;
  activity: 'idle' | 'playing' | 'sleeping' | 'eating';
  lastUpdate: number;
};

type PetEvent = {
  type: string;
  state?: PetState;
  timestamp?: number;
};

export default function PetDashboard() {
  const [petState, setPetState] = useState<PetState>({
    happiness: 50,
    activity: 'idle',
    lastUpdate: Date.now()
  });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [events, setEvents] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Socket.IO connection
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080');

    socket.on('connect', () => {
      setConnectionStatus('Connected');
      setEvents(prev => [...prev, 'Connected to pet stream']);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setEvents(prev => [...prev, 'Disconnected from pet stream']);
    });

    socket.on('pet_update', (data: PetEvent) => {
      if (data.type === 'PET_STATE_UPDATE' && data.state) {
        setPetState(data.state);
        setEvents(prev => [...prev, `Pet ${data.state?.activity}: happiness ${data.state?.happiness}/100`]);
      }
    });

    return () => {
      socket.disconnect();
    }
  }, []);

  // Pet rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationTime = 0;

    const renderPet = () => {
      // Clear canvas
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Pet body (circle)
      const petSize = 50 + (petState.happiness / 100) * 20; // Size based on happiness
      ctx.fillStyle = getActivityColor(petState.activity);
      ctx.beginPath();
      
      // Animation based on activity
      let offsetY = 0;
      if (petState.activity === 'playing') {
        offsetY = Math.sin(animationTime * 0.1) * 10; // Bounce
      } else if (petState.activity === 'sleeping') {
        offsetY = Math.sin(animationTime * 0.02) * 3; // Slow breathing
      }
      
      ctx.arc(centerX, centerY + offsetY, petSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Pet eyes
      ctx.fillStyle = '#000';
      const eyeSize = petState.activity === 'sleeping' ? 2 : 8;
      ctx.fillRect(centerX - 15, centerY - 10 + offsetY, eyeSize, eyeSize);
      ctx.fillRect(centerX + 7, centerY - 10 + offsetY, eyeSize, eyeSize);
      
      // Activity indicator
      ctx.fillStyle = '#333';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(getActivityEmoji(petState.activity), centerX, centerY + 80);
      
      animationTime++;
      animationRef.current = requestAnimationFrame(renderPet);
    };

    renderPet();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [petState]);

  const getActivityColor = (activity: string): string => {
    switch (activity) {
      case 'playing': return '#4CAF50';
      case 'sleeping': return '#9C27B0';
      case 'eating': return '#FF9800';
      default: return '#2196F3';
    }
  };

  const getActivityEmoji = (activity: string): string => {
    switch (activity) {
      case 'playing': return '🎾';
      case 'sleeping': return '💤';
      case 'eating': return '🍖';
      default: return '😊';
    }
  };

  const getHappinessColor = (happiness: number): string => {
    if (happiness > 70) return '#4CAF50';
    if (happiness > 40) return '#FF9800';
    return '#F44336';
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🐾 Virtual Pet Live Dashboard</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Pet Render */}
        <div style={{ 
          border: '2px solid #ccc', 
          borderRadius: '10px', 
          padding: '20px'
        }}>
          <h2>Live Pet View</h2>
          <canvas 
            ref={canvasRef}
            width={300}
            height={200}
            style={{ border: '1px solid #ddd', borderRadius: '5px' }}
          />
          <p style={{ textAlign: 'center', marginTop: '10px' }}>
            Status: <strong>{connectionStatus}</strong>
          </p>
        </div>

        {/* Pet Stats */}
        <div style={{ 
          border: '2px solid #ccc', 
          borderRadius: '10px', 
          backgroundColor: '#322',
          padding: '20px'
        }}>
          <h2>Pet Stats</h2>
          <div style={{ fontSize: '18px', lineHeight: '1.6' }}>
            <p>
              <strong>Happiness:</strong> 
              <span style={{ color: getHappinessColor(petState.happiness) }}>
                {petState.happiness}/100
              </span>
            </p>
            <p><strong>Activity:</strong> {petState.activity}</p>
            <p suppressHydrationWarning>
              <strong>Last Update:</strong> {new Date(petState.lastUpdate).toLocaleString()}
            </p>
          </div>
          
          {/* Happiness Bar */}
          <div style={{ 
            width: '100%', 
            height: '20px',
            borderRadius: '10px',
            overflow: 'hidden',
            marginTop: '15px'
          }}>
            <div style={{
              width: `${petState.happiness}%`,
              height: '100%',
              backgroundColor: getHappinessColor(petState.happiness),
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div style={{ 
        border: '2px solid #ccc', 
        borderRadius: '10px', 
        padding: '20px'
      }}>
        <h2>Activity Log</h2>
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto',
          padding: '10px',
          borderRadius: '5px'
        }}>
          {events.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {events.slice(-10).reverse().map((event, i) => (
                <li key={i} style={{ 
                  marginBottom: '5px',
                  padding: '5px',
                  borderRadius: '3px',
                  fontSize: '14px'
                }}>
                  {event}
                </li>
              ))}
            </ul>
          ) : (
            <p>No activity yet...</p>
          )}
        </div>
      </div>
    </div>
  );
}