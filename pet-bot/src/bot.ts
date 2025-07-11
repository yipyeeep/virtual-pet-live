// src/bot.ts
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { createClient } from 'redis';
import { PetState, PetUpdate } from './types/pet';

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis error:', err));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Pet state management
const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';

async function getPetState() {
  const state = await redisClient.get(PET_STATE_KEY);
  return state ? JSON.parse(state) : {
    happiness: 50,
    activity: 'idle',
    lastUpdate: Date.now()
  };
}

async function setPetState(newState: PetState) {
  await redisClient.set(PET_STATE_KEY, JSON.stringify(newState));
  
  // Publish update to dashboard
  await redisClient.publish(PET_CHANNEL, JSON.stringify({
    type: 'PET_STATE_UPDATE',
    state: newState,
    timestamp: Date.now()
  }));
}

client.on('ready', async () => {
  console.log(`Pet Bot logged in as ${client.user!.tag}!`);
  
  await redisClient.connect();
  console.log('Connected to Redis!');
  
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('feed')
      .setDescription('Feed your virtual pet'),
    
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play with your virtual pet'),
    
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Check your pet\'s current stats')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
  
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands
    });
    console.log('Slash commands registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const petState = await getPetState();
  
  switch (interaction.commandName) {
    case 'feed':
      const newHappiness = Math.min(100, petState.happiness + 15);
      const fedState = {
        ...petState,
        happiness: newHappiness,
        activity: 'eating',
        lastUpdate: Date.now()
      };
      
      await setPetState(fedState);
      await interaction.reply(`🍖 You fed your pet! Happiness: ${newHappiness}/100`);
      
      // Reset activity after eating
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 5000);
      break;
      
    case 'play':
      const playHappiness = Math.min(100, petState.happiness + 10);
      const playState = {
        ...petState,
        happiness: playHappiness,
        activity: 'playing',
        lastUpdate: Date.now()
      };
      
      await setPetState(playState);
      await interaction.reply(`🎾 You played with your pet! Happiness: ${playHappiness}/100`);
      
      // Reset activity after playing
      setTimeout(async () => {
        const currentState = await getPetState();
        await setPetState({ ...currentState, activity: 'idle' });
      }, 8000);
      break;
      
    case 'stats':
      await interaction.reply(`📊 **Pet Stats:**\nHappiness: ${petState.happiness}/100\nActivity: ${petState.activity}\nLast Update: ${new Date(petState.lastUpdate).toLocaleString()}`);
      break;
  }
});

client.login(process.env.BOT_TOKEN);