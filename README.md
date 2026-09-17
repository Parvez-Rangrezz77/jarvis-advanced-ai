<div align="center">

# 🤖 J.A.R.V.I.S. — Advanced AI Assistant

### *Just A Rather Very Intelligent System*

**A real-time, voice-controlled AI desktop assistant powered by Google Gemini's Live API with screen vision, persistent memory, system control, and internet intelligence.**

[![Electron](https://img.shields.io/badge/Electron-42-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/Gemini_Live_API-Realtime-8B5CF6?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

<img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" width="800" alt="JARVIS Dashboard" />

</div>

---

## ✨ What is JARVIS?

JARVIS is a **fully autonomous desktop AI assistant** that listens to your voice in real-time, sees your screen, controls your PC, searches the live internet, sends WhatsApp messages, manages VS Code, and remembers everything — all through natural Hinglish/English conversation.

Built on **Google Gemini's Multimodal Live API** (WebSocket bi-directional audio + video streaming), it runs as an Electron desktop app with a cinematic HUD interface inspired by Iron Man's AI.

---

## 🚀 Core Features

### 🎙️ Real-Time Voice Conversation
- **Bi-directional audio streaming** via Gemini Live WebSocket API
- Natural conversation in **Hinglish** (Hindi + English mix) and English
- Cinematic AI voice with configurable voice profiles
- Interrupt JARVIS mid-sentence — just start talking

### 👁️ Screen Vision Sentinel
- **Real-time desktop screen capture** streamed to Gemini as video frames
- JARVIS can *see* what's on your screen and react to it
- Read error messages, identify UI elements, verify task completion visually
- Works across all apps — browser, VS Code, file explorer, anything

### 🧠 Persistent Memory System
- **Pinned memories** — permanently saved facts that survive restarts
- **User profile learning** — remembers your preferences, name, habits
- **Conversation summaries** — auto-summarizes past sessions
- **Behavioral learnings** — learns from your corrections and never repeats mistakes

### 🌐 Live Internet Intelligence
- **Web Search** — real-time DuckDuckGo search for news, weather, stocks, sports
- **Webpage Scraper** — reads and extracts clean text from any URL
- Never says "I don't have internet access" — it actually does

### 💻 Full System Control
- **App launcher** — open any installed application by voice
- **System commands** — execute PowerShell/CMD commands directly
- **File management** — create, delete, move, copy files and folders
- **Keyboard automation** — type text, trigger shortcuts, control input

### 📱 WhatsApp Auto Messenger
- Send WhatsApp messages hands-free by voice
- *"Rahul ko WhatsApp karo, bol do kal milte hain"* — done automatically
- Clipboard-based text injection for perfect Hinglish/emoji support

### 🖥️ VS Code Complete Control
- Open projects, files, specific line numbers
- Install extensions, run terminal commands
- Scaffold entire project structures by voice
- Full keyboard shortcut automation

### 🎨 Cinematic HUD Dashboard
- **Iron Man-inspired** telemetry interface with animated canvas graphics
- Real-time audio waveform visualizer
- System stats, memory indicators, agent status panels
- Boot sequence animation on startup
- Multiple agent personas with unique themes

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ELECTRON SHELL                     │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  main.cjs   │  │ preload.cjs│  │  memory.cjs  │  │
│  │ IPC Handlers│  │ API Bridge │  │ Persistent   │  │
│  │ System Cmds │  │            │  │ JSON Store   │  │
│  └──────┬──────┘  └─────┬──────┘  └──────────────┘  │
│         │               │                            │
├─────────┼───────────────┼────────────────────────────┤
│         │    RENDERER PROCESS (React + Vite)          │
│  ┌──────┴───────────────┴──────────────────────────┐ │
│  │              Dashboard.tsx                       │ │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────────┐  │ │
│  │  │ AiCore   │ │ScreenVision│ │ BootSequence  │  │ │
│  │  │ Canvas   │ │ Sentinel   │ │ Animation     │  │ │
│  │  │ HUD      │ │            │ │               │  │ │
│  │  └──────────┘ └────────────┘ └───────────────┘  │ │
│  │                                                  │ │
│  │  ┌──────────────────────────────────────────────┐│ │
│  │  │           gemini-live.ts                     ││ │
│  │  │  WebSocket ↔ Gemini Live API                 ││ │
│  │  │  Audio Streaming + Tool Execution            ││ │
│  │  └──────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  Google Gemini Live    │
            │  WebSocket API         │
            │  (Audio + Vision)      │
            └────────────────────────┘
```

---

## 📁 Project Structure

```
JARVIS-Advanced-AI/
├── electron/
│   ├── main.cjs          # Electron main process — IPC handlers, system commands
│   ├── preload.cjs       # Context bridge — secure API exposure to renderer
│   └── memory.cjs        # Persistent JSON memory store
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx  # Main HUD — agent selection, controls, status
│   │   ├── AiCore.tsx     # Animated canvas telemetry visualizer
│   │   ├── ScreenVision.tsx # Screen capture & vision streaming engine
│   │   ├── BootSequence.tsx # Cinematic startup animation
│   │   ├── AuthScreen.tsx   # API key entry screen
│   │   └── ChromeCompanion.tsx # Browser companion panel
│   ├── lib/
│   │   ├── gemini-live.ts    # Gemini Live WebSocket manager & tool executor
│   │   ├── agents-config.ts  # Agent personas, system prompts, cognitive rules
│   │   ├── memory.ts         # Frontend memory API wrappers
│   │   ├── audio.ts          # Audio processing utilities
│   │   ├── screen-capture.ts # Desktop capture helpers
│   │   └── screen-vision.ts  # Vision frame processing
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   ├── sounds/            # UI sound effects
│   └── chrome-extension/  # Chrome companion extension
├── scripts/
│   └── run-electron.cjs   # Electron dev launcher with port cleanup
├── .env.example           # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** v18+ — [Download](https://nodejs.org/)
- **Google Gemini API Key** — [Get one free](https://aistudio.google.com/apikey)
- **Windows 10/11** (primary platform for system control features)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Parvez-Rangrezz77/jarvis-advanced-ai.git
cd jarvis-advanced-ai

# 2. Install dependencies
npm install

# 3. Set up your API key
cp .env.example .env
# Edit .env and paste your Gemini API key

# 4. Launch JARVIS
npm run electron:dev
```

JARVIS will boot with the cinematic sequence and start listening. Just talk!

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run electron:dev` | Launch JARVIS as Electron desktop app (dev mode) |
| `npm run dev` | Run frontend only (Vite dev server on port 3000) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type checking (`tsc --noEmit`) |

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **AI Engine** | Google Gemini 3.1 Flash Live (WebSocket Streaming) |
| **Desktop Shell** | Electron 42 |
| **Frontend** | React 19 + TypeScript 5.8 |
| **Bundler** | Vite 6 |
| **Styling** | Tailwind CSS 4 |
| **Animations** | Motion (Framer Motion) + Canvas 2D |
| **Icons** | Lucide React |
| **Memory** | Persistent JSON file store (Electron userData) |

---

## 🗣️ Voice Commands (Examples)

```
"JARVIS, YouTube par React tutorial kholo"
"Desktop par ek naya folder banao 'MyProject'"
"JARVIS, aaj ka weather batao"
"Rahul ko WhatsApp message bhejo — kal milte hain"
"VS Code mein mera project kholo"
"PC ka IP address batao"
"JARVIS, yaad rakhna mera exam 25 September ko hai"
"Screen par kya error aa raha hai? Fix karo"
```

---

## 🔒 Security

- `.env` files containing API keys are **strictly gitignored**
- No API keys are hardcoded in source code
- Electron's `contextBridge` ensures secure IPC between main and renderer processes
- `nodeIntegration` is disabled; `contextIsolation` is enabled

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ and Gemini AI**

*"Sometimes you gotta run before you can walk."* — Tony Stark

</div>