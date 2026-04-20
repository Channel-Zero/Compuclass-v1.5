# CompuClass - Complete Documentation

## 📱 Project Overview

CompuClass is a React Native mobile application built with Expo for managing educational content, quizzes, and student progress tracking with interactive 3D PC component visualization.

---

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React Native with Expo SDK 54
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: Google Gemini API for quiz generation
- **3D Rendering**: Three.js with expo-gl and expo-three
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State Management**: React Context API
- **Offline Support**: SQLite with expo-sqlite

---

## 📦 Dependencies

### Core Dependencies
```json
{
  "expo": "54.0.21",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "@supabase/supabase-js": "^2.75.0"
}
```

### Navigation
```json
{
  "@react-navigation/native": "^7.1.17",
  "@react-navigation/bottom-tabs": "^7.4.7",
  "@react-navigation/stack": "^7.4.8",
  "react-native-screens": "~4.16.0",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-gesture-handler": "~2.28.0"
}
```

### 3D Visualization
```json
{
  "expo-gl": "~13.6.0",
  "expo-three": "~7.0.0",
  "three": "0.158.0"
}
```

### Storage & Offline
```json
{
  "@react-native-async-storage/async-storage": "^2.2.0",
  "@react-native-community/netinfo": "11.4.1",
  "expo-sqlite": "~16.0.8"
}
```

### File Handling
```json
{
  "expo-document-picker": "~14.0.7",
  "expo-file-system": "~19.0.17",
  "expo-sharing": "~14.0.7"
}
```

---

## 🗂️ Project Structure

```
-CompuClass/
├── assets/                    # Static assets
│   ├── models/               # 3D model files (.glb)
│   ├── 3D_models/           # Additional 3D assets
│   └── images/              # App images
├── components/               # Reusable components
│   ├── RealAR.js            # 3D PC model viewer
│   ├── MotherboardAR.js     # Motherboard 3D viewer
│   ├── CPUAR.js             # CPU 3D viewer
│   ├── RamAR.js             # RAM 3D viewer
│   ├── GPUAR.js             # GPU 3D viewer
│   ├── StorageAR.js         # Storage 3D viewer
│   ├── PSUAR.js             # PSU 3D viewer
│   └── Sidebar.js           # Navigation sidebar
├── config/                   # Configuration files
│   └── supabase.js          # Supabase client setup
├── context/                  # React Context providers
│   └── ThemeContext.js      # Theme management
├── hooks/                    # Custom React hooks
│   └── useOffline.js        # Offline detection
├── screens/                  # App screens
│   ├── OnboardingScreen.js
│   ├── LoginScreen.js
│   ├── SignUpScreen.js
│   ├── DashboardScreen.js
│   ├── PCLabScreen.js       # 3D PC Lab
│   ├── QuizScreen.js
│   ├── ProfileScreen.js
│   ├── SearchScreen.js
│   ├── LecturerDashboardScreen.js
│   ├── FolderContentScreen.js
│   ├── ContentUploadScreen.js
│   ├── QuizCreationScreen.js
│   ├── QuizDetailScreen.js
│   ├── ClassManagementScreen.js
│   ├── ClassDetailScreen.js
│   ├── StudentProgressScreen.js
│   ├── StudentMaterialsScreen.js
│   ├── SettingsScreen.js
│   └── Windows11SimulatorScreen.js
├── services/                 # API services
│   ├── authService.js       # Authentication
│   ├── lecturerService.js   # Lecturer features
│   ├── aiService.js         # AI quiz generation
│   └── offlineService.js    # Offline sync
├── .env                      # Environment variables
├── App.js                    # Main app component
├── app.json                  # Expo configuration
├── babel.config.js          # Babel configuration
└── package.json             # Dependencies

```

---

## 🔐 Environment Setup

### Required Environment Variables (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

---

## 🗄️ Database Schema

### Tables

#### profiles
```sql
- id (UUID, PK, references auth.users)
- full_name (TEXT)
- role (TEXT, default: 'student')
- created_at (TIMESTAMP)
```

#### folders
```sql
- id (UUID, PK)
- name (TEXT)
- description (TEXT)
- lecturer_id (UUID, FK)
- created_at (TIMESTAMP)
```

#### documents
```sql
- id (UUID, PK)
- title (TEXT)
- file_url (TEXT)
- file_name (TEXT)
- file_type (TEXT)
- file_size (INTEGER)
- folder_id (UUID, FK)
- lecturer_id (UUID, FK)
- created_at (TIMESTAMP)
```

#### quizzes
```sql
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- passing_score (INTEGER, default: 70)
- folder_id (UUID, FK)
- created_at (TIMESTAMP)
```

#### quiz_questions
```sql
- id (UUID, PK)
- quiz_id (UUID, FK)
- question (TEXT)
- options (JSONB)
- correct_answer (TEXT)
- order_index (INTEGER)
- created_at (TIMESTAMP)
```

#### classes
```sql
- id (UUID, PK)
- name (TEXT)
- description (TEXT)
- lecturer_id (UUID, FK)
- created_at (TIMESTAMP)
```

#### class_students
```sql
- id (UUID, PK)
- class_id (UUID, FK)
- student_id (UUID, FK)
- joined_at (TIMESTAMP)
- UNIQUE(class_id, student_id)
```

#### quiz_assignments
```sql
- id (UUID, PK)
- quiz_id (UUID, FK)
- class_id (UUID, FK)
- assigned_at (TIMESTAMP)
```

#### quiz_attempts
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- quiz_id (UUID, FK)
- score (INTEGER)
- completed_at (TIMESTAMP)
```

#### material_views
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- document_id (UUID, FK)
- created_at (TIMESTAMP)
```

---

## 🎨 Features

### For Students
- ✅ Browse learning materials and documents
- ✅ Take quizzes and track progress
- ✅ Access PC lab with 3D component visualization
- ✅ Interactive 3D models (drag to rotate)
- ✅ Windows 11 simulator for learning
- ✅ Dark mode support
- ✅ Offline access to downloaded content

### For Lecturers
- ✅ Create and manage folders for course content
- ✅ Upload documents (PDF, PowerPoint, etc.)
- ✅ Create quizzes manually or with AI assistance
- ✅ Track student progress and quiz attempts
- ✅ Manage classes and assign students
- ✅ Share quizzes with classes
- ✅ View analytics and reports

### AI-Powered Features
- ✅ AI Quiz Generation from PDF documents
- ✅ Automatic question generation using Google Gemini
- ✅ Multiple question types support
- ✅ Customizable question counts

---

## 🖥️ 3D PC Lab Implementation

### Component: RealAR.js

#### Features
- 3D model rendering with Three.js
- Touch controls (drag to rotate)
- Auto-rotation animation
- Multi-level fallback system
- WebView fallback for compatibility

#### Loading Priority
1. **Local Asset**: `assets/models/personal_computer.glb`
2. **GitHub Fallback**: Remote GLB file
3. **WebView Fallback**: Web-based 3D viewer

#### Usage in PCLabScreen
```jsx
// Inline view (300px container)
<View style={styles.realARContainer}>
  <RealAR />
</View>

// Fullscreen view
if (isFullscreen) {
  return (
    <View style={styles.fullscreenContainer}>
      <TouchableOpacity onPress={() => setIsFullscreen(false)}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <RealAR />
    </View>
  );
}
```

#### Individual Component Viewers
- **MotherboardAR**: Motherboard 3D model
- **CPUAR**: CPU 3D model
- **RamAR**: RAM 3D model
- **GPUAR**: GPU 3D model
- **StorageAR**: Storage 3D model
- **PSUAR**: Power Supply 3D model

---

## 🚀 Installation & Setup

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd -CompuClass
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Setup Database
Run the SQL schema in your Supabase SQL Editor (see README.md)

### 5. Run Application
```bash
npm start
```

### 6. Scan QR Code
Use Expo Go app on your mobile device

---

## 🔧 Configuration Files

### app.json
```json
{
  "expo": {
    "name": "CompuClass",
    "slug": "CompuClass",
    "version": "1.0.0",
    "orientation": "portrait",
    "plugins": ["expo-sqlite"]
  }
}
```

### babel.config.js
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

### package.json (main entry)
```json
{
  "main": "node_modules/expo/AppEntry.js"
}
```

---

## 🎯 User Roles

### Student
- Email: Any email (not lecturer@compuclass.com)
- Access: Dashboard, Materials, Quizzes, PC Lab, Profile

### Lecturer
- Email: lecturer@compuclass.com
- Access: Lecturer Dashboard, Content Management, Quiz Creation, Class Management, Student Progress

---

## 📱 Navigation Structure

### Student Navigation
```
Bottom Tabs:
├── Dashboard (Home)
├── Search
└── Profile

Hidden Screens:
├── PC Lab
├── Windows 11 Simulator
├── Quiz
├── Troubleshoot
├── Materials
└── Settings
```

### Lecturer Navigation
```
Bottom Tabs:
├── Lecturer Dashboard
├── Search
└── Profile

Stack Screens:
├── Folder Content
├── Content Upload
├── Quiz Creation
├── Quiz Detail
├── Class Management
├── Class Detail
└── Student Progress
```

---

## 🔒 Security

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their own data
- Lecturers have additional permissions
- Storage bucket policies protect file access

### Authentication
- Supabase Auth with email/password
- JWT tokens for API requests
- Secure session management
- Auto-logout on token expiration

---

## 📊 Console Logging

### App Initialization
- 🚀 App initializing...
- 🔍 Checking user session...
- ✅ User authenticated successfully
- ✅ App initialization complete

### 3D Model Loading
- ⏳ Loading 3D PC Model...
- ✅ Local GLB model loaded
- ⚠️ Trying GitHub...
- ✅ GitHub GLB model loaded
- 🌐 Using WebView fallback

### Navigation
- 🧭 Navigating to: [screen]
- 🔙 Back to login screen
- 🚪 Logging out...

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "main has not been registered"
**Solution**: Ensure `package.json` has:
```json
"main": "node_modules/expo/AppEntry.js"
```

#### 2. 3D Model Not Loading
**Check**:
- File exists at `assets/models/personal_computer.glb`
- Internet connection for GitHub fallback
- Console logs for specific errors

#### 3. Texture Loading Warnings
**Status**: Safe to ignore - suppressed in code
**Impact**: Model renders without textures

#### 4. Supabase Connection Issues
**Check**:
- `.env` file exists and has correct values
- Supabase project is active
- RLS policies are configured

---

## 📈 Performance Optimization

### 3D Rendering
- 60fps target with requestAnimationFrame
- Efficient model loading with caching
- Texture warning suppression
- WebView fallback for low-end devices

### Offline Support
- SQLite for local data storage
- NetInfo for connection detection
- Automatic sync when online
- Cached content for offline access

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Login/Signup flow
- [ ] Student dashboard loads
- [ ] Lecturer dashboard loads
- [ ] 3D models render in PC Lab
- [ ] Component cards open individual models
- [ ] Fullscreen mode works
- [ ] Touch controls (drag to rotate)
- [ ] Quiz creation and taking
- [ ] File upload and download
- [ ] Offline mode functionality
- [ ] Dark mode toggle

---

## 📝 Known Issues

1. **PDF text extraction**: Uses Gemini API (PDFs sent as base64)
2. **File upload**: Uses legacy expo-file-system API
3. **3D textures**: May not load on all devices (fallback provided)
4. **WebView 3D**: Requires internet connection

---

## 🔄 Future Enhancements

### Planned Features
- [ ] True AR with camera integration
- [ ] Multiplayer quiz competitions
- [ ] Video content support
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Export progress reports
- [ ] Social features (forums, chat)
- [ ] Gamification (badges, leaderboards)

---

## 📄 License

This project is private and proprietary.

---

## 👥 Contributors

- Development Team
- UI/UX Design
- Content Creation
- Testing & QA

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review console logs
3. Check Supabase dashboard
4. Contact development team

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: ✅ Production Ready
