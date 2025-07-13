/**
 * Discord Bot for Virtual Pet System
 * 
 * Handles Discord slash commands for pet interactions (feed, play, reset, stats).
 * Manages pet state persistence in Redis and publishes updates to dashboard.
 * Provides temporary activity states that auto-reset to idle after duration.
 * 
 */

// pet-bot/src/bot.ts
/**
 * Enhanced Discord Bot with Comprehensive Metrics Tracking
 * 
 * Tracks command execution, user interactions, response times,
 * and publishes metrics to Redis for dashboard analytics.
 */

import * as dotenv from 'dotenv';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { createClient } from 'redis';
import { PetState, PetUpdate } from './types/pet';

dotenv.config();

// Redis clients
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const redisMetrics = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis error:', err));
redisMetrics.on('error', (err) => console.log('Redis metrics error:', err));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Constants
const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';
const METRICS_CHANNEL = 'metrics_updates';

const initialState: PetState = {
  happiness: 50,
  activity: 'idle',
  lastUpdate: Date.now()
};

/**
 * Log command execution metrics
 */
async function logCommandMetrics(command: string, userId: string, responseTime: number) {
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  
  // Track command counts
  await redisMetrics.hIncrBy('pet:metrics:commands', command, 1);
  await redisMetrics.hIncrBy(`pet:metrics:daily:${today}`, `commands:${command}`, 1);
  await redisMetrics.hIncrBy(`pet:metrics:hourly:${today}:${hour}`, command, 1);
  
  // Track user activity
  await redisMetrics.hIncrBy('pet:metrics:users', userId, 1);
  
  // Track response times
  await redisMetrics.lPush('pet:metrics:response_times', JSON.stringify({
    command,
    responseTime,
    timestamp: Date.now()
  }));
  
  // Keep only last 1000 response times
  await redisMetrics.lTrim('pet:metrics:response_times', 0, 999);
  
  // Publish metrics update
  await redisMetrics.publish(METRICS_CHANNEL, JSON.stringify({
    type: 'COMMAND_EXECUTED',
    command,
    userId,
    responseTime,
    timestamp: Date.now()
  }));
}

/**
 * Log happiness change for trend tracking
 */
async function logHappinessChange(oldHappiness: number, newHappiness: number, cause: string) {
  await redisMetrics.lPush('pet:metrics:happiness_history', JSON.stringify({
    oldValue: oldHappiness,
    newValue: newHappiness,
    change: newHappiness - oldHappiness,
    cause,
    timestamp: Date.now()
  }));
  
  // Keep only last 2000 happiness records (roughly 24-48 hours)
  await redisMetrics.lTrim('pet:metrics:happiness_history', 0, 1999);
}

async function getPetState(): Promise<PetState> {
  const state = await redisClient.get(PET_STATE_KEY);
  return state ? JSON.parse(state) : initialState;
}

async function setPetState(newState: PetState) {
  await redisClient.set(PET_STATE_KEY, JSON.stringify(newState));
  
  // Publish state update
  await redisClient.publish(PET_CHANNEL, JSON.stringify({
    type: 'PET_STATE_UPDATE',
    state: newState,
    timestamp: Date.now()
  }));
}

client.on('ready', async () => {
  console.log(`Pet Bot logged in as ${client.user!.tag}!`);
  
  await redisClient.connect();
  await redisMetrics.connect();
  console.log('Connected to Redis!');
  
  // Register enhanced commands
  const commands = [
    new SlashCommandBuilder()
      .setName('feed')
      .setDescription('Feed your virtual pet'),
    
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play with your virtual pet'),

    new SlashCommandBuilder()
      .setName('reset')
      .setDescription('Reset your virtual pet to initial state'),
    
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Check your pet\'s current stats'),
      
    new SlashCommandBuilder()
      .setName('metrics')
      .setDescription('View pet system metrics and analytics')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
  
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands
    });
    console.log('Enhanced slash commands registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const startTime = Date.now();
  const petState = await getPetState();
  
  switch (interaction.commandName) {
    case 'feed':
      const newHappiness = Math.min(100, petState.happiness + 15);
      const fedState: PetState = {
        ...petState,
        happiness: newHappiness,
        activity: 'eating',
        lastUpdate: Date.now()
      };
      
      await setPetState(fedState);
      await logHappinessChange(petState.happiness, newHappiness, 'fed');
      await interaction.reply(`🍖 You fed your pet! Happiness: ${newHappiness}/100`);
      
      // Auto-reset activity
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 5000);
      break;
      
    case 'play':
      const playHappiness = Math.min(100, petState.happiness + 10);
      const playState: PetState = {
        ...petState,
        happiness: playHappiness,
        activity: 'playing',
        lastUpdate: Date.now()
      };
      
      await setPetState(playState);
      await logHappinessChange(petState.happiness, playHappiness, 'played');
      await interaction.reply(`🎾 You played with your pet! Happiness: ${playHappiness}/100`);
      
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 8000);
      break;

    case 'reset':
      await logHappinessChange(petState.happiness, 50, 'reset');
      await setPetState(initialState);
      await interaction.reply(`🤖 You reset your pet! Happiness: 50/100`);
      break;
      
    case 'stats':
      await interaction.reply(`📊 **Pet Stats:**\nHappiness: ${petState.happiness}/100\nActivity: ${petState.activity}\nLast Update: ${new Date(petState.lastUpdate).toLocaleString()}`);
      break;
      
    case 'metrics':
      // Get basic metrics for Discord display
      const totalCommands = await redisMetrics.hGetAll('pet:metrics:commands');
      const totalUsers = await redisMetrics.hLen('pet:metrics:users');
      const today = new Date().toISOString().split('T')[0];
      const todayCommands = await redisMetrics.hGetAll(`pet:metrics:daily:${today}`);
      
      let metricsText = `📈 **Pet System Metrics:**\n`;
      metricsText += `**Total Commands:** ${Object.values(totalCommands).reduce((a, b) => Number(a) + Number(b), 0)}\n`;
      metricsText += `**Active Users:** ${totalUsers}\n`;
      metricsText += `**Today's Activity:** ${Object.values(todayCommands).reduce((a, b) => Number(a) + Number(b), 0)} commands\n`;
      metricsText += `**Current Happiness:** ${petState.happiness}/100\n`;
      metricsText += `\n🔗 **Full Analytics:** Check the dashboard for detailed charts and trends!`;
      
      await interaction.reply(metricsText);
      break;
  }
  
  // Log command execution metrics
  const responseTime = Date.now() - startTime;
  await logCommandMetrics(interaction.commandName, interaction.user.id, responseTime);
});

client.login(process.env.BOT_TOKEN);