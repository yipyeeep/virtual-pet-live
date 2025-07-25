# 🐾 AI Virtual Pet Livestream  

A real-time, AI-powered virtual pet that interacts via Discord, autonomously evolves its behavior, and streams to a Next.js dashboard. Daily AI-generated highlight reels summarize its adventures!  

![Demo GIF](https://example.com/pet-demo.gif) *Example: Pet playing in dashboard*

## 🌟 Features  
- **Discord-Controlled Pet**: `/feed`, `/play`, `/train` commands  
- **Autonomous AI**: LLM-driven mood/behavior changes (Mistral 7B)  
- **Live 3D Stream**: Three.js rendering with WebSocket updates  
- **Daily Recaps**: AI-generated videos (FFmpeg + GPT-4 narration)  

## 🛠️ Tech Stack  
| Component           | Technology          |  
|---------------------|---------------------|  
| **Frontend**        | Next.js, Three.js   |  
| **Backend**         | Node.js, Socket.IO  |  
| **Database**        | Redis (State/Events)|  
| **AI**              | Mistral 7B, GPT-4   |  
| **Infrastructure**  | Docker, GitHub Actions |  

## 🚀 Quick Start  
bash

# 1. Clone repo  
git clone https://github.com/your-repo/ai-virtual-pet.git  

# 2. Set up environment  
set up .env with bot token
# Fill in Discord/Redis/AI keys  

# 3. Run with Docker  
## Development (uses .env + override automatically)
docker-compose up

## Production (explicit files)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up --build

## Staging
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.staging up

Access:

Dashboard: http://localhost:3000

Discord Bot: Invite via OAuth2 link

📂 Project Structure
text
/  
├── discord-bot/       # Pet interaction logic  
├── websocket-server/  # Redis ↔ Next.js bridge  
├── nextjs-dashboard/  # 3D stream + UI  
├── ai-agent/          # Behavior generation  
└── docker-compose.yml # Full environment  

🤝 Contributing

1. Fork the repo

2. Create a branch (git checkout -b feature/awesome-pet)

3. Submit a PR!

📜 License
MIT © [HongYipCheng]

---

### **Key Sections to Customize**  
1. **Demo Media**: Replace placeholder GIF with actual screenshots/videos.  
2. **Environment Setup**: Add specific API key instructions (Discord bot token, OpenAI, etc.).  
3. **Roadmap**: Optional "Planned Features" section to attract contributors.  

### Notes of deployment for self
1. docker-compose.yml: - NEXT_PUBLIC_WS_URL=http://websocket-server:8080 -> - NEXT_PUBLIC_WS_URL=http://localhost:8080
2. pet-dashboard/Dockerfile: CMD ["npm", "start"] -> CMD ["npm", "run", "dev"]