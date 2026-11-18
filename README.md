# CompuClass

> A computer literacy learning platform for students and lecturers — built as a mobile app and web experience.

**Established 2025** · CompuClass Group

🌐 **Live Web Demo**: [compuclass-v15.vercel.app](https://compuclass-v15.vercel.app/windows)

---

## What is CompuClass?

CompuClass is an educational platform designed to teach computer literacy through interactive simulations, AI-powered quizzes, gamified learning, and structured course content. It targets students who are new to computers, giving them a safe environment to learn Windows, PC assembly, troubleshooting, and more — without needing a physical lab.

---

## Features

### For Students
- Interactive **Windows 11 Simulator** — learn the OS without a real PC
- **3D Visualiser** — inspect 3D models of computer components (CPU, RAM, motherboard and more) with full rotation and interaction
- **PC Assembly** — drag-and-drop simulation where students physically assemble a PC by placing components in the correct slots, step by step
- Take quizzes and track your scores
- Access course materials uploaded by lecturers
- Works offline with local data sync
- **Multilingual AI Chatbot** — supports all 11 South African official languages for students not comfortable in English

### For Lecturers
- Create and manage course folders and content
- Upload documents (PDF, PowerPoint, etc.)
- **AI Quiz Generation** — generate quiz questions from uploaded PDFs using Google Gemini
- Manage classes and assign students
- Track student progress and quiz attempts
- Share quizzes with specific classes

---

## Games

CompuClass includes two educational games for students who prefer to learn passively through play.

### CompuRunner
An endless runner where the goal is to survive as long as possible — the longer you play, the higher your score. At set intervals the game pauses and asks a computer literacy question. Answer correctly to keep your energy up. Answer wrong and you lose energy. When your energy runs out, the game ends. It rewards both gaming skill and knowledge.

### Maze Game
A maze-based quiz game where answering questions correctly unlocks the path to the next step. The game has multiple levels covering different topics — computer basics, software, and hardware. Students must answer correctly to progress through each level. The game also supports **live multiplayer** — students can host a game and challenge their friends in real time, competing on the same questions simultaneously.

---

## Multilingual Chatbot

The built-in AI chatbot supports **all 11 South African official languages**, making the platform accessible to students who are not confident in English. Students can ask questions about course content, computer concepts, or get help navigating the app in their home language.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo |
| Web | React (deployed on Vercel) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI | Google Gemini API |
| Navigation | React Navigation |
| State | React Context API |
| Offline | expo-sqlite |

---

## Getting Started

### Prerequisites
- Node.js v16+
- Expo Go app (for mobile testing)
- Supabase account
- Google Gemini API key

### Installation

```bash
git clone <repo-url>
cd CompuClass
npm install
cp .env.example .env
```

Fill in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### Run

```bash
npm start
```

Scan the QR code with Expo Go, or press `w` for web.

---

## Database Setup

Run this SQL in your Supabase SQL Editor to set up all tables, RLS policies, storage and functions:

<details>
<summary>Click to expand full SQL setup</summary>

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lecturer_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create quizzes table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create quiz_questions table
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lecturer_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create class_students table
CREATE TABLE class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Create quiz_assignments table
CREATE TABLE quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- Create quiz_attempts table
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  quiz_id UUID REFERENCES quizzes(id),
  score INTEGER,
  completed_at TIMESTAMP DEFAULT NOW()
);

-- Create material_views table
CREATE TABLE material_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  document_id UUID REFERENCES documents(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Lecturers can view all students" ON profiles FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage own folders" ON folders FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Everyone can view documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage documents" ON documents FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Everyone can view quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Everyone can view quiz questions" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "Lecturers can manage classes" ON classes FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Everyone can view class students" ON class_students FOR SELECT USING (true);
CREATE POLICY "Students can view own attempts" ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can view own material views" ON material_views FOR SELECT USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
CREATE POLICY "Anyone can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Anyone can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');

-- Helper function
CREATE OR REPLACE FUNCTION get_students_with_emails()
RETURNS TABLE (id UUID, full_name TEXT, email VARCHAR(255), role TEXT, created_at TIMESTAMP) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, u.email::VARCHAR(255), p.role, p.created_at
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.role = 'student';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

</details>

---

## Project Structure

```
CompuClass/
├── assets/          # Icons, images
├── components/      # Reusable UI components
├── config/          # Supabase client setup
├── context/         # Theme and auth context
├── hooks/           # Custom hooks (offline, etc.)
├── screens/         # All app screens
├── services/        # Auth, AI, lecturer, offline services
├── App.js           # Entry point
└── package.json
```

---

## Security

- `.env` is gitignored — never commit credentials
- Supabase Row Level Security (RLS) enforces data access per user
- Gemini API calls are proxied server-side
- All auth operations go through Supabase Auth

---

## Team

Created and owned by the CompuClass Group.

| Name |
|---|
| Kamogelo Bambo |
| Lindokuhle Chili |
| Mila Hlungulu |
| Lutho Buyaphi |
| Thabo Kumalo |

---

## License

© 2025 CompuClass Group. All rights reserved. Unauthorized copying or distribution is prohibited.
