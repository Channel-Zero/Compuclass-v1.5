import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, Image, Clipboard, ToastAndroid, Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiService } from '../services/aiService';
import { RateLimitError } from '../utils/rateLimiter';

const BLUE = '#2563EB'; const WHITE = '#FFFFFF'; const BG = '#F3F4F6';
const TEXT = '#111827'; const MUTED = '#6B7280'; const BUBBLE_AI = '#EFF6FF';
const CHAT_STORAGE_KEY = 'compubot_chat_history';

const QUICK_PROMPTS = [
  { label: '🖥️ What is a CPU?',        text: 'What is a CPU and what does it do?' },
  { label: '💾 RAM vs Storage',         text: 'What is the difference between RAM and storage?' },
  { label: '🔧 PC won\'t turn on',      text: 'My PC won\'t turn on. How do I troubleshoot it?' },
  { label: '📋 Quiz tips',              text: 'Give me tips to prepare for a computer hardware quiz.' },
  { label: '🔌 What is a PSU?',         text: 'What is a PSU and why is it important?' },
  { label: '🧩 Motherboard explained',  text: 'Explain what a motherboard does in simple terms.' },
];

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE, transform: [{ translateY: dot }] }} />
      ))}
    </View>
  );
}

export default function ChatbotScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  const context = route?.params?.context || null;

  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY).then(saved => {
      if (saved) setMessages(JSON.parse(saved));
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0)
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = useCallback(async (text, imageBase64 = null) => {
    const trimmed = (text || input).trim();
    if ((!trimmed && !imageBase64) || loading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: trimmed,
      image: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setSelectedImage(null);
    setLoading(true);
    scrollToBottom();

    try {
      const recentMessages = updatedMessages.slice(-10);
      const reply = await aiService.chatWithAI(recentMessages, context, imageBase64);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: reply, timestamp: new Date().toISOString() }]);
    } catch (error) {
      const text = error instanceof RateLimitError ? error.userMessage : 'Sorry, I ran into an issue. Please try again.';
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text, timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, messages, loading, context]);

  const clearChat = () => {
    setMessages([]);
    AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const copyMessage = (text) => {
    Clipboard.setString(text);
    if (Platform.OS === 'android') ToastAndroid.show('Copied!', ToastAndroid.SHORT);
    else Alert.alert('Copied!');
  };

  const speakMessage = (text, id) => {
    if (speakingId === id) {
      Speech.stop();
      setSpeakingId(null);
    } else {
      Speech.stop();
      setSpeakingId(id);
      Speech.speak(text, { onDone: () => setSpeakingId(null), onError: () => setSpeakingId(null) });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) setSelectedImage(result.assets[0]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled) setSelectedImage(result.assets[0]);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && <View style={styles.avatar}><Ionicons name="hardware-chip" size={14} color={WHITE} /></View>}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => copyMessage(item.text)}
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}
        >
          {item.image && <Image source={{ uri: item.image }} style={styles.msgImage} resizeMode="cover" />}
          {item.text ? <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text> : null}
          <View style={styles.msgMeta}>
            <Text style={[styles.timestamp, isUser && { color: WHITE + 'AA' }]}>{formatTime(item.timestamp)}</Text>
            {!isUser && (
              <TouchableOpacity onPress={() => speakMessage(item.text, item.id)} style={{ marginLeft: 6 }}>
                <Ionicons name={speakingId === item.id ? 'volume-high' : 'volume-medium-outline'} size={13} color={speakingId === item.id ? BLUE : MUTED} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="hardware-chip" size={16} color={WHITE} />
          </View>
          <View>
            <Text style={styles.headerTitle}>CompuBot</Text>
            <Text style={styles.headerSub}>AI Learning Assistant</Text>
          </View>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={18} color={MUTED} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles" size={36} color={BLUE} />
            </View>
            <Text style={styles.emptyTitle}>Ask CompuBot anything</Text>
            <Text style={styles.emptySub}>Get help with PC components, troubleshooting, quizzes, and more.</Text>
            <View style={styles.quickGrid}>
              {QUICK_PROMPTS.map((p, i) => (
                <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(p.text)}>
                  <Text style={styles.quickChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              loading ? (
                <View style={styles.typingRow}>
                  <View style={styles.avatar}><Ionicons name="hardware-chip" size={14} color={WHITE} /></View>
                  <View style={styles.typingBubble}><TypingDots /></View>
                </View>
              ) : null
            }
          />
        )}

        {selectedImage && (
          <View style={styles.imagePreviewBar}>
            <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
              <Ionicons name="close-circle" size={20} color={MUTED} />
            </TouchableOpacity>
            <Text style={styles.imagePreviewText}>Image ready to send</Text>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
          <TouchableOpacity onPress={takePhoto} style={styles.iconBtn}>
            <Ionicons name="camera-outline" size={22} color={MUTED} />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={22} color={MUTED} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor={MUTED}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, ((!input.trim() && !selectedImage) || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input, selectedImage?.base64)}
            disabled={(!input.trim() && !selectedImage) || loading}
          >
            <Ionicons name="send" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  headerSub: { fontSize: 11, color: MUTED },
  clearBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 48 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: BLUE + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 8 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  quickChip: { backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#E5E7EB' },
  quickChipText: { fontSize: 12, fontWeight: '600', color: TEXT },
  messageList: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: BUBBLE_AI, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: TEXT, lineHeight: 21 },
  bubbleTextUser: { color: WHITE },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  timestamp: { fontSize: 10, color: MUTED },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typingBubble: { backgroundColor: BUBBLE_AI, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  imagePreviewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 },
  imagePreview: { width: 48, height: 48, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: 4, left: 52 },
  imagePreviewText: { fontSize: 12, color: MUTED },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: BLUE + '50' },
});
