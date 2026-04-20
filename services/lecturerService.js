import { supabase } from '../config/supabase';
import { aiService } from './aiService';

export const lecturerService = {
  async createFolder(name, description = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('folders')
        .insert({ name, description, lecturer_id: user.id })
        .select()
        .single();
      if (error) {
        console.error('❌ Create folder error:', error.message);
        throw error;
      }
      console.log('✅ Folder created:', name);
      return data;
    } catch (error) {
      console.error('❌ Create folder exception:', error);
      throw error;
    }
  },

  async getFolders() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('lecturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('❌ Get folders error:', error.message);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Get folders exception:', error);
      throw error;
    }
  },

  async uploadDocument(folderId, file, title) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      
      // Read file using fetch and arrayBuffer
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uint8Array, {
          contentType: file.mimeType,
          upsert: false
        });
      
      if (uploadError) {
        console.error('❌ Document upload error:', uploadError.message);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Insert document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.mimeType,
          file_size: file.size,
          folder_id: folderId,
          lecturer_id: user.id
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Document insert error:', error.message);
        throw error;
      }
      console.log('✅ Document uploaded:', title);
      return data;
    } catch (error) {
      console.error('❌ Upload document exception:', error);
      throw error;
    }
  },

  async getDocuments(folderId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Documents error:', error);
      return [];
    }
    
    return data || [];
  },

  async createQuiz(folderId, title, questions) {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          title,
          description: '',
          passing_score: 70,
          folder_id: folderId
        })
        .select()
        .single();
      if (error) {
        console.error('❌ Create quiz error:', error.message);
        throw error;
      }

      const questionInserts = questions.map((q, idx) => ({
        quiz_id: data.id,
        question: q.question,
        options: q.options,
        correct_answer: q.options[q.correctAnswer],
        order_index: idx
      }));

      const { error: qError } = await supabase
        .from('quiz_questions')
        .insert(questionInserts);
      if (qError) {
        console.error('❌ Insert quiz questions error:', qError.message);
        throw qError;
      }
      console.log('✅ Quiz created:', title, 'with', questions.length, 'questions');
      return data;
    } catch (error) {
      console.error('❌ Create quiz exception:', error);
      throw error;
    }
  },

  async getQuizzes(folderId) {
    try {
      // Validate folderId is a valid UUID
      if (!folderId || folderId === 'default') {
        return [];
      }
      
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          quiz_questions(count)
        `)
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Quizzes error:', error);
        return [];
      }
      
      return (data || []).map(quiz => ({
        ...quiz,
        quiz_questions: Array(quiz.quiz_questions?.[0]?.count || 0).fill({})
      }));
    } catch (err) {
      console.error('Quizzes exception:', err);
      return [];
    }
  },

  async deleteFolder(folderId) {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);
      if (error) {
        console.error('❌ Delete folder error:', error.message);
        throw error;
      }
      console.log('✅ Folder deleted:', folderId);
    } catch (error) {
      console.error('❌ Delete folder exception:', error);
      throw error;
    }
  },

  async deleteDocument(documentId) {
    try {
      // Get document to find file path
      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', documentId)
        .single();
      
      if (fetchError) {
        console.error('❌ Fetch document error:', fetchError.message);
      }
      
      if (doc?.file_url) {
        // Extract file path from URL
        const urlParts = doc.file_url.split('/documents/');
        if (urlParts[1]) {
          const filePath = urlParts[1].split('?')[0];
          
          // Delete from storage
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([filePath]);
          
          if (storageError) {
            console.error('❌ Delete from storage error:', storageError.message);
          }
        }
      }
      
      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      
      if (error) {
        console.error('❌ Delete document error:', error.message);
        throw error;
      }
      console.log('✅ Document deleted:', documentId);
    } catch (error) {
      console.error('❌ Delete document exception:', error);
      throw error;
    }
  },

  async deleteQuiz(quizId) {
    try {
      const { error: questionsError } = await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
      if (questionsError) {
        console.error('❌ Delete quiz questions error:', questionsError.message);
      }
      
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) {
        console.error('❌ Delete quiz error:', error.message);
        throw error;
      }
      console.log('✅ Quiz deleted:', quizId);
    } catch (error) {
      console.error('❌ Delete quiz exception:', error);
      throw error;
    }
  },

  async getQuizDetail(quizId) {
    try {
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      
      if (quizError) {
        console.error('❌ Get quiz error:', quizError.message);
        throw quizError;
      }
      
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');
      
      if (questionsError) {
        console.error('❌ Get quiz questions error:', questionsError.message);
        throw questionsError;
      }
      
      return {
        ...quiz,
        quiz_questions: questions || []
      };
    } catch (error) {
      console.error('❌ Get quiz detail exception:', error);
      throw error;
    }
  },

  async shareQuizToClasses(quizId, classIds) {
    try {
      // Insert quiz assignments for each class
      const assignments = classIds.map(classId => ({
        quiz_id: quizId,
        class_id: classId,
        assigned_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('quiz_assignments')
        .insert(assignments);
      
      if (error) {
        console.error('❌ Share quiz error:', error.message);
        throw error;
      }
      
      console.log('✅ Quiz shared to', classIds.length, 'classes');
      return { success: true, assignedTo: classIds.length };
    } catch (error) {
      console.error('❌ Share quiz exception:', error);
      throw error;
    }
  },

  // Student Management Functions
  async getStudents() {
    const { data, error } = await supabase.rpc('get_students_with_emails');
    
    if (error) {
      console.error('Students error:', error);
      return [];
    }
    
    return data || [];
  },

  async addStudent(email) {
    try {
      // Create or update user profile to student role
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          full_name: email.split('@')[0],
          role: 'student',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Add student upsert error:', error.message);
        // If profile doesn't exist, create a placeholder
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: `temp_${Date.now()}`,
            full_name: email.split('@')[0],
            role: 'student'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Add student insert error:', insertError.message);
          throw insertError;
        }
        console.log('✅ Student added:', email);
        return newProfile;
      }
      
      console.log('✅ Student added:', email);
      return data;
    } catch (error) {
      console.error('❌ Add student exception:', error);
      throw error;
    }
  },

  async getStudentProgress() {
    try {
      const students = await this.getStudents();
      console.log('👥 Total students:', students?.length);
      
      if (!students || !Array.isArray(students)) {
        return {};
      }
      
      const progressData = {};
      
      for (const student of students) {
        if (!student || !student.id) continue;
        
        console.log('🔍 Fetching progress for:', student.email, student.id);
        
        // Get quiz attempts
        const { data: quizAttempts, error: attemptsError } = await supabase
          .from('quiz_attempts')
          .select('score, completed_at')
          .eq('user_id', student.id);
        
        if (attemptsError) {
          console.error('❌ Quiz attempts error for', student.email, ':', attemptsError.message);
        }
        
        console.log('📊 Quiz attempts for', student.email, ':', quizAttempts?.length || 0, quizAttempts);
        
        // Get material views
        const { data: materialViews } = await supabase
          .from('material_views')
          .select('created_at')
          .eq('user_id', student.id);
        
        const scores = quizAttempts?.map(a => a.score) || [];
        const averageScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
          : 0;
        
        const lastActivity = quizAttempts?.length > 0 
          ? new Date(Math.max(...quizAttempts.map(a => new Date(a.completed_at)))).toLocaleDateString()
          : 'Never';
        
        progressData[student.id] = {
          quizzesCompleted: quizAttempts?.length || 0,
          averageScore,
          materialsViewed: materialViews?.length || 0,
          lastActivity
        };
        
        console.log('✅ Progress for', student.email, ':', progressData[student.id]);
      }
      
      return progressData;
    } catch (error) {
      console.error('❌ Progress error:', error);
      return {};
    }
  },

  async getStudentDetail(studentId) {
    try {
      const { data: student, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      if (error) {
        console.error('❌ Get student detail error:', error.message);
        throw error;
      }
      
      const { data: quizAttempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*, quizzes(title)')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });
      
      if (attemptsError) {
        console.error('❌ Get quiz attempts error:', attemptsError.message);
      }
      
      return { student, quizAttempts: quizAttempts || [] };
    } catch (error) {
      console.error('❌ Get student detail exception:', error);
      throw error;
    }
  },

  // Class Management Functions
  async createClass(name, description = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name,
          description,
          lecturer_id: user.id
        })
        .select()
        .single();
      if (error) {
        console.error('❌ Create class error:', error.message);
        throw error;
      }
      console.log('✅ Class created:', name);
      return data;
    } catch (error) {
      console.error('❌ Create class exception:', error);
      throw error;
    }
  },

  async getClasses() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get classes with student count
      const { data: classes, error } = await supabase
        .from('classes')
        .select(`
          *,
          class_students(count)
        `)
        .eq('lecturer_id', user.id);
      
      if (error) {
        console.error('❌ Get classes error:', error.message);
        return [];
      }
      
      // Format the data with student count
      return classes.map(cls => ({
        ...cls,
        student_count: cls.class_students?.[0]?.count || 0
      }));
    } catch (error) {
      console.error('❌ Get classes exception:', error);
      return [];
    }
  },

  async assignStudentsToClass(classId, studentIds) {
    try {
      // Insert student assignments
      const assignments = studentIds.map(studentId => ({
        class_id: classId,
        student_id: studentId,
        joined_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('class_students')
        .insert(assignments);
      
      if (error) {
        console.error('❌ Assign students error:', error.message);
        throw error;
      }
      
      console.log('✅ Assigned', studentIds.length, 'students to class');
      return { success: true };
    } catch (error) {
      console.error('❌ Assign students exception:', error);
      throw error;
    }
  },

  async getClassStudents(classId) {
    try {
      const { data: enrollments, error } = await supabase
        .from('class_students')
        .select('student_id, joined_at')
        .eq('class_id', classId);
      
      if (error) {
        console.error('❌ Get class students error:', error.message);
        return [];
      }
      
      const students = await Promise.all(
        (enrollments || []).map(async (e) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', e.student_id)
            .single();
          
          return {
            id: e.student_id,
            full_name: profile?.full_name || 'Unknown',
            email: profile?.email || '',
            joined_at: e.joined_at
          };
        })
      );
      
      return students;
    } catch (error) {
      console.error('❌ Get class students exception:', error);
      return [];
    }
  },

  async removeStudentFromClass(classId, studentId) {
    try {
      const { error } = await supabase
        .from('class_students')
        .delete()
        .eq('class_id', classId)
        .eq('student_id', studentId);
      
      if (error) {
        console.error('❌ Remove student error:', error.message);
        throw error;
      }
      console.log('✅ Student removed from class');
      return { success: true };
    } catch (error) {
      console.error('❌ Remove student exception:', error);
      throw error;
    }
  },

  async getClassDetail(classId) {
    try {
      console.log('🔍 Fetching class detail for:', classId);
      
      // Get class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
      
      if (classError) {
        console.error('❌ Get class error:', classError.message);
        throw classError;
      }
      
      // Get enrolled students
      const { data: enrollments, error: studentsError } = await supabase
        .from('class_students')
        .select('student_id, joined_at')
        .eq('class_id', classId);
      
      if (studentsError) {
        console.error('❌ Get enrollments error:', studentsError.message);
        throw studentsError;
      }
      
      // Get student profiles separately
      const students = await Promise.all(
        (enrollments || []).map(async (e) => {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', e.student_id)
            .single();
          
          if (profileError) {
            console.error('❌ Get student profile error:', profileError.message);
          }
          
          return {
            id: e.student_id,
            full_name: profile?.full_name || 'Unknown',
            joined_at: e.joined_at
          };
        })
      );
      
      console.log('✅ Class detail fetched successfully');
      return { class: classData, students };
    } catch (error) {
      console.error('❌ Get class detail exception:', error);
      throw error;
    }
  },

  async generateAIQuiz(file, title, questionCount = 5) {
    return await aiService.generateQuizFromFile(file, title, questionCount);
  },

  // Real AI implementation would look like this:
  /*
  async generateAIQuizReal(file, title) {
    try {
      // Extract text from document
      const text = await this.extractTextFromFile(file);
      
      // Call AI API (OpenAI, Claude, etc.)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: `Generate 5 multiple choice questions based on this content: ${text}`
          }]
        })
      });
      
      const aiResponse = await response.json();
      return this.parseAIQuestions(aiResponse.choices[0].message.content);
    } catch (error) {
      throw new Error('AI generation failed: ' + error.message);
    }
  }
  */
};
