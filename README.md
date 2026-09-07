# ⏳ LastTime — MP Board Class 10th Exam Prep

AI-powered study app for **MP Board Class 10th Trimashik (Quarterly) Exam 2026-27**.
Apna AI model lao (API key + base URL), aur syllabus se padho, practice karo, full exam do — AI checking ke saath.

## 🚀 Chalane ke liye

```bash
npm install
npm run dev
```

Phir browser mein kholo: **http://localhost:5199** (ya jo port terminal mein dikhe)

Production build:

```bash
npm run build
npm run preview
```

## ⚙️ Setup (pehli baar)

1. **Settings** page kholo → **Add Model**
2. Preset chuno (OpenAI / OpenRouter / Groq / Gemini / Ollama) ya custom base URL do
3. API key + Model ID daalo → **Test connection** → **Save**
4. Jitne chahe models add karo — header se switch kar sakte ho
5. 👁 **Vision checkbox** un models ke liye tick karo jo images dekh sakte hain (gpt-4o, gemini-2.0-flash, etc.)

## ✨ Features

- **Syllabus** — 6 subjects, 46 chapters (video se nikala gaya quarterly syllabus)
- **Samjho** — kisi bhi chapter ko AI se detail mein samjhao; text, image, YouTube link sab feed kar sakte ho
- **Practice** — chapter se PYQ-style questions, apne answers likho, AI examiner banke checks karega
- **Exam Studio** — poora question paper generate karo (marks/time/difficulty choice); sample paper ki **photo** do toh uska format copy hota hai
- **AI Checking** — submit karo → step-wise marks, per-question feedback, grade, weak topics
- **AI Tutor** — free chat with images + YouTube/web link auto-reading (transcript nikaal ke AI ko samajh aata hai)

## 🔒 Privacy

Sab data (API keys, papers, chats) **sirf browser ke localStorage** mein. Koi backend nahi — requests seedha tumhare AI provider ko jaati hain.

## 🛠 Tech

React 18 + TypeScript + Vite + Tailwind CSS + Zustand + react-markdown + KaTeX (math rendering)
