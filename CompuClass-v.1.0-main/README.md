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
- **AI**: Google Gemini via a Supabase Edge Function (`supabase/functions/gemini`)
- **Navigation**: React Navigation
- **State Management**: React Context API

## Prerequisites

- Node.js 22 or newer
- npm
- Expo Go app on your mobile device
- Supabase account
- A Gemini API key stored as a Supabase secret (not in the app)

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

3. Create a `.env` file in `CompuClass-v.1.0-main/` (next to `app.json`):
```bash
cp .env.example .env
```

4. Add your Supabase credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Do not put a Gemini API key in `.env`. The app calls the `gemini` Edge Function, which reads the `GEMINI_API_KEY` Supabase secret.

## Database Setup

- **Existing project (Compu-ClassV1):** run `supabase/migrations/20261006140000_security_hardening.sql` only. Do not re-run `supabase-setup.sql`.
- **New Supabase project:** run `supabase-setup.sql` once, then run that same migration. The live gradebook and maze RPCs are not in git, so a new project will not have them. See `DEPLOYMENT.md` Part 7, including leaked-password protection.

Every signup is a student. Promote a lecturer from the SQL editor:

```sql
UPDATE public.profiles SET role = 'lecturer' WHERE id = '<user-uuid>';
```

Deploy the AI function and rotate the old Google key. See `DEPLOYMENT.md` Part 7.

## Running the App

1. Start the development server:
```bash
npm start
```

2. Scan the QR code with Expo Go app on your phone

## Accounts

New accounts are students. A lecturer is an existing user whose `profiles.role` was set to `lecturer` in the Supabase SQL editor.

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
- **aiService.js**: Calls the Supabase `gemini` Edge Function
- **fileAccess.js**: Upload checks and signed storage URLs

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
