// =============================================================================
// 4. ENHANCED DASHBOARD WITH CHARTS - FIXED
// =============================================================================

// pet-dashboard/app/page.tsx
/**
 * Enhanced Virtual Pet Dashboard with Comprehensive Analytics
 * 
 * Real-time dashboard with Chart.js visualizations for happiness trends,
 * activity distribution, command usage, and system performance metrics.
 */

"use client";
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

// Chart.js imports with proper registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

type PetState = {
  happiness: number;
  activity: 'idle' | 'playing' | 'sleeping' | 'eating' | 'loading';
  lastUpdate: number;
};

interface PetUpdate {
  type: 'PET_STATE_UPDATE';
  state: PetState;
  timestamp: number;
}

type MetricsSummary = {
  happiness: {
    current: number;
    average: number;
    trend: Array<{newValue: number, timestamp: number}>;
  };
  activity: {
    idle: number;
    playing: number;
    sleeping: number;
    eating: number;
  };
  commands: {
    commandCounts: Record<string, number>;
    totalCommands: number;
    totalUsers: number;
  };
  system: {
    averageResponseTime: number;
    uptime: number;
  };
};

export default function EnhancedPetDashboard() {
  const [petState, setPetState] = useState<PetState>({
    happiness: 0,
    activity: 'loading',
    lastUpdate: Date.now()
  });
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [events, setEvents] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Fetch metrics from API
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:8090'}/api/metrics/summary`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  // WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.error('NEXT_PUBLIC_WS_URL is not defined');
      setConnectionStatus('Configuration Error');
      return;
    }
  
    const socket = io(wsUrl);

    socket.on('connect', () => {
      setConnectionStatus('Connected');
      setEvents(prev => [...prev, 'Connected to pet stream']);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setEvents(prev => [...prev, 'Disconnected from pet stream']);
    });

    socket.on('pet_update', (data: PetUpdate) => {
      if (data.type === 'PET_STATE_UPDATE' && data.state) {
        setPetState(data.state);
        setEvents(prev => [...prev, `Pet ${data.state?.activity}: happiness ${data.state?.happiness}/100`]);
      }
    });

    return () => {
      socket.disconnect();
    }
  }, []);

  // Fetch metrics every 5 seconds
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Canvas animation (same as before)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationTime = 0;

    const renderPet = () => {
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      let petSize = 50 + (petState.happiness / 100) * 20;
      if (petState.activity === 'eating') {
        petSize += Math.sin(animationTime * 0.1) * 2;
      }
      ctx.fillStyle = getActivityColor(petState.activity);
      ctx.beginPath();
      
      let offsetY = 0;
      if (petState.activity === 'playing') {
        offsetY = Math.sin(animationTime * 0.1) * 10;
      } else if (petState.activity === 'sleeping') {
        offsetY = Math.sin(animationTime * 0.02) * 3;
      }
      
      ctx.arc(centerX, centerY + offsetY, petSize, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000';
      const eyeSize = petState.activity === 'sleeping' ? 2 : 8;
      ctx.fillRect(centerX - 15, centerY - 10 + offsetY, eyeSize, eyeSize);
      ctx.fillRect(centerX + 7, centerY - 10 + offsetY, eyeSize, eyeSize);
      
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

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🐾 Virtual Pet Analytics Dashboard</h1>
      
      {/* Metrics Overview Cards */}
      {metrics && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div style={{ 
            background: '#311', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3>📊 Commands Today</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
              {metrics.commands.totalCommands}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              From {metrics.commands.totalUsers} users
            </div>
          </div>
          
          <div style={{ 
            background: '#131', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3>❤️ Happiness</h3>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getHappinessColor(metrics.happiness.current)
            }}>
              {metrics.happiness.current}/100
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Avg: {metrics.happiness.average}
            </div>
          </div>
          
          <div style={{ 
            background: '#113', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3>⚡ Response Time</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
              {metrics.system.averageResponseTime.toFixed(1)} ms
            </div>
          </div>

          <div style={{ 
            background: '#222', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3>⏱️ Uptime</h3>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
              {formatUptime(metrics.system.uptime)}
            </div>
          </div>
        </div>
      )}

      {/* Canvas Rendering of Pet */}
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        style={{
          display: 'block',
          margin: '20px auto',
          border: '2px dashed #ccc',
          backgroundColor: '#fff',
          borderRadius: '12px'
        }}
      />

      {/* Event Log */}
      <div style={{
        maxHeight: '120px',
        overflowY: 'auto',
        background: '#123',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        marginBottom: '20px'
      }}>
        <strong>🧾 Event Log:</strong>
        <ul>
          {events.slice(-10).reverse().map((event, index) => (
            <li key={index}>{event}</li>
          ))}
        </ul>
      </div>

      {/* Charts */}
      {metrics && (
        <div style={{ marginTop: '40px' }}>
          <h2>📈 Analytics</h2>

          {/* Happiness Trend Chart */}
          <div style={{ marginBottom: '40px' }}>
            <h4>Happiness Trend</h4>
            <Line
              data={{
                labels: metrics.happiness.trend.map(t => new Date(t.timestamp).toLocaleTimeString()),
                datasets: [
                  {
                    label: 'Happiness',
                    data: metrics.happiness.trend.map(t => t.newValue),
                    fill: false,
                    borderColor: '#007bff',
                    tension: 0.1
                  }
                ]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: { min: 0, max: 100 }
                }
              }}
            />
          </div>

          {/* Activity Distribution */}
          <div style={{ marginBottom: '40px' }}>
            <h4>Activity Breakdown</h4>
            <Pie
              data={{
                labels: ['Idle', 'Playing', 'Sleeping', 'Eating'],
                datasets: [
                  {
                    data: [
                      metrics.activity.idle,
                      metrics.activity.playing,
                      metrics.activity.sleeping,
                      metrics.activity.eating
                    ],
                    backgroundColor: ['#6c757d', '#4caf50', '#9c27b0', '#ff9800']
                  }
                ]
              }}
            />
          </div>

          {/* Command Usage Bar */}
          <div style={{ marginBottom: '40px' }}>
            <h4>Command Usage</h4>
            <Bar
              data={{
                labels: Object.keys(metrics.commands.commandCounts),
                datasets: [
                  {
                    label: 'Commands Used',
                    data: Object.values(metrics.commands.commandCounts),
                    backgroundColor: '#17a2b8'
                  }
                ]
              }}
              options={{
                indexAxis: 'y',
                responsive: true,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>
      )}

      <footer style={{ textAlign: 'center', marginTop: '40px', fontSize: '12px', color: '#888' }}>
        Status: {connectionStatus} • Powered by 🐾 AI Pet Core
      </footer>
    </div>
  );
}