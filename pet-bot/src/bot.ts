/**
 * Discord Bot for Virtual Pet System
 * 
 * Handles Discord slash commands for pet interactions (feed, play, reset, stats).
 * Manages pet state persistence in Redis and publishes updates to dashboard.
 * Provides temporary activity states that auto-reset to idle after duration.
 * 
 */

// pet-bot/src/bot.ts
import * as dotenv from 'dotenv';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { createClient } from 'redis';
import { PetState, PetUpdate } from './types/pet';

dotenv.config();

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis error:', err));

// Discord client with required intents
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Pet state constants
const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';

const initialState: PetState = {
  happiness: 50,
  activity: 'idle',
  lastUpdate: Date.now()
}

/**
 * Retrieves current pet state from Redis
 * @returns Promise<PetState> - Current pet state or default if not found
 */
async function getPetState() {
  const state = await redisClient.get(PET_STATE_KEY);
  return state ? JSON.parse(state) : {
    happiness: 50,
    activity: 'idle',
    lastUpdate: Date.now()
  };
}

/**
 * Updates pet state in Redis and publishes to dashboard
 * @param newState - New pet state to save
 */
async function setPetState(newState: PetState) {
  await redisClient.set(PET_STATE_KEY, JSON.stringify(newState));
  
  // Notify dashboard of state change
  await redisClient.publish(PET_CHANNEL, JSON.stringify({
    type: 'PET_STATE_UPDATE',
    state: newState,
    timestamp: Date.now()
  }));
}

// Bot ready event - register commands
client.on('ready', async () => {
  console.log(`Pet Bot logged in as ${client.user!.tag}!`);
  
  await redisClient.connect();
  console.log('Connected to Redis!');
  
  // Define slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('feed')
      .setDescription('Feed your virtual pet'),
    
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play with your virtual pet'),

    new SlashCommandBuilder()
      .setName('reset')
      .setDescription('Reset your virutal pet to initial state'),
    
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Check your pet\'s current stats')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
  
  try {
    // Register commands globally
    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands
    });
    console.log('Slash commands registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const petState = await getPetState();
  
  switch (interaction.commandName) {
    case 'feed':
      // Increase happiness by 15, cap at 100
      const newHappiness = Math.min(100, petState.happiness + 15);
      const fedState = {
        ...petState,
        happiness: newHappiness,
        activity: 'eating',
        lastUpdate: Date.now()
      };
      
      await setPetState(fedState);
      await interaction.reply(`🍖 You fed your pet! Happiness: ${newHappiness}/100`);
      
      // Auto-reset activity after eating duration
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 5000);
      break;
      
    case 'play':
      // Increase happiness by 10, cap at 100
      const playHappiness = Math.min(100, petState.happiness + 10);
      const playState = {
        ...petState,
        happiness: playHappiness,
        activity: 'playing',
        lastUpdate: Date.now()
      };
      
      await setPetState(playState);
      await interaction.reply(`🎾 You played with your pet! Happiness: ${playHappiness}/100`);
      
      // Auto-reset activity after play duration
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 8000);
      break;

    case 'reset':
      // Reset pet to initial state
      await (setPetState(initialState));
      await interaction.reply(`🤖 You reseted your pet! Happiness: 50`);
      break;
      
    case 'stats':
      // Display current pet statistics
      await interaction.reply(`📊 **Pet Stats:**\nHappiness: ${petState.happiness}/100\nActivity: ${petState.activity}\nLast Update: ${new Date(petState.lastUpdate).toLocaleString()}`);
      break;
  }
});

// Start the bot
client.login(process.env.BOT_TOKEN);