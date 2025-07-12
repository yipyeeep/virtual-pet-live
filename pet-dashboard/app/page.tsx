/**
 * Virtual Pet Dashboard - Next.js App Router
 * 
 * Real-time dashboard displaying pet state with 2D Canvas rendering.
 * Connects to WebSocket server for live updates and shows animated pet
 * with activity-based behaviors, happiness stats, and event log.
 */

// pet-dashboard/app/page.tsx
"use client";
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

type PetState = {
  happiness: number;
  activity: 'idle' | 'playing' | 'sleeping' | 'eating' | 'loading';
  lastUpdate: number;
};

type PetEvent = {
  type: string;
  state?: PetState;
  timestamp?: number;
};

export default function PetDashboard() {
  const [petState, setPetState] = useState<PetState>({
    happiness: 0,
    activity: 'loading',
    lastUpdate: Date.now()
  });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [events, setEvents] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.error('NEXT_PUBLIC_WS_URL is not defined');
      setConnectionStatus('Configuration Error');
      return;
    }
  
    const socket = io(wsUrl);

    // Connection event handlers
    socket.on('connect', () => {
      setConnectionStatus('Connected');
      setEvents(prev => [...prev, 'Connected to pet stream']);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setEvents(prev => [...prev, 'Disconnected from pet stream']);
    });

    // Pet state update handler
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

  // Canvas animation loop for pet rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationTime = 0;

    const renderPet = () => {
      // Clear canvas with background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Pet body - size reflects happiness level
      const petSize = 50 + (petState.happiness / 100) * 20;
      ctx.fillStyle = getActivityColor(petState.activity);
      ctx.beginPath();
      
      // Activity-based animations
      let offsetY = 0;
      if (petState.activity === 'playing') {
        offsetY = Math.sin(animationTime * 0.1) * 10; // Bouncing animation
      } else if (petState.activity === 'sleeping') {
        offsetY = Math.sin(animationTime * 0.02) * 3; // Slow breathing
      }
      
      ctx.arc(centerX, centerY + offsetY, petSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Pet eyes - closed when sleeping
      ctx.fillStyle = '#000';
      const eyeSize = petState.activity === 'sleeping' ? 2 : 8;
      ctx.fillRect(centerX - 15, centerY - 10 + offsetY, eyeSize, eyeSize);
      ctx.fillRect(centerX + 7, centerY - 10 + offsetY, eyeSize, eyeSize);
      
      // Activity emoji indicator
      ctx.fillStyle = '#333';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(getActivityEmoji(petState.activity), centerX, centerY + 80);
      
      animationTime++;
      animationRef.current = requestAnimationFrame(renderPet);
    };

    renderPet();

    // Cleanup animation frame on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [petState]);

  /**
   * Get pet color based on current activity
   */
  const getActivityColor = (activity: string): string => {
    switch (activity) {
      case 'playing': return '#4CAF50';
      case 'sleeping': return '#9C27B0';
      case 'eating': return '#FF9800';
      default: return '#2196F3';
    }
  };

  /**
   * Get emoji representation of activity
   */
  const getActivityEmoji = (activity: string): string => {
    switch (activity) {
      case 'playing': return '🎾';
      case 'sleeping': return '💤';
      case 'eating': return '🍖';
      default: return '😊';
    }
  };

  /**
   * Get happiness bar color based on level
   */
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
        {/* Live Pet Visualization */}
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

        {/* Pet Statistics Panel */}
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
          
          {/* Animated happiness progress bar */}
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

      {/* Recent Activity Log */}
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
              {/* Show last 10 events, most recent first */}
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