# CompuClass - Educational Learning Platform

A React Native mobile application built with Expo for managing educational content, quizzes, and student progress tracking.

## Features

### For Students
- Browse learning materials and documents
- Take quizzes and track progress
- Access PC lab simulations
- Windows 11 simulator for learning
- Dark mode support

### For Lecturers
- Create and manage folders for course content
- Upload documents (PDF, PowerPoint, etc.)
- Create quizzes manually or with AI assistance
- Track student progress
- Manage classes and assign students
- Share quizzes with classes

### AI-Powered Features
- **AI Quiz Generation**: Automatically generate quiz questions from uploaded PDF documents using Google Gemini API
- Supports multiple question types with customizable question counts

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL database, Authentication, Storage)
- **AI**: Google Gemini API for quiz generation
- **Navigation**: React Navigation
- **State Management**: React Context API
- **Offline Support**: SQLite with expo-sqlite

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo Go app on your mobile device
- Supabase account
- Google Gemini API key

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd -CompuClass
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Add your credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

## Database Setup

Run the following SQL in your Supabase SQL Editor:

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

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Storage policy
CREATE POLICY "Anyone can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Anyone can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');

-- Function to get students with emails
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

## Running the App

1. Start the development server:
```bash
npm start
```

2. Scan the QR code with Expo Go app on your phone

## Default Accounts

- **Lecturer**: lecturer@compuclass.com
- **Student**: Any other email

## Project Structure

```
-CompuClass/
├── assets/          # Images and static files
├── components/      # Reusable components
├── config/          # Configuration files (Supabase)
├── context/         # React Context providers
├── hooks/           # Custom React hooks
├── screens/         # App screens
├── services/        # API services
├── .env             # Environment variables (not in git)
├── .env.example     # Example environment file
├── App.js           # Main app component
└── package.json     # Dependencies
```

## Key Services

- **authService.js**: Authentication logic
- **lecturerService.js**: Lecturer-specific features (folders, quizzes, classes)
- **aiService.js**: AI quiz generation using Gemini API
- **offlineService.js**: Offline data synchronization

## Security Notes

- Never commit `.env` file to git
- Supabase RLS policies protect data access
- API keys are stored in environment variables
- All sensitive operations require authentication

## Known Issues

- PDF text extraction uses Gemini API (PDFs are sent as base64)
- File upload uses legacy expo-file-system API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is private and proprietary.
