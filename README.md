# ✦ Genexam

**Your syllabus, solved with AI.** Any board, any class, any exam.

Paste a YouTube lecture link, type your syllabus, or attach a photo/notes file — Genexam's AI tutor reads it and builds everything: study plans, chapter notes, important questions, quizzes and full practice papers.

## How it works
1. **Add a model** — click *Add model* in the top bar. Choose a provider (OpenRouter, OpenAI, Groq, Gemini, Ollama…), paste your API key, then either **Auto fetch** the model list (FREE badges on free models) or type a Model ID.
2. **Tell it your syllabus** — paste a link, type it out, or upload a photo of your syllabus/paper.
3. **Ask for anything** — study plan, notes, MCQ quiz, practice paper, doubt solving. All in one chat.

## Privacy
- Your API key never leaves your browser (stored in localStorage).
- Requests go **directly** to your provider; if the provider blocks browser calls (CORS), they're retried through a tiny serverless proxy (`/api/proxy`) that forwards them — nothing is stored.

## Tech
React + Vite + Tailwind + Zustand. Deploy: Cloudflare Pages (`npm run build` → `dist`, functions auto-deployed from `/functions`).

## Dev
```bash
npm install
npm run dev    # http://localhost:5199
```
