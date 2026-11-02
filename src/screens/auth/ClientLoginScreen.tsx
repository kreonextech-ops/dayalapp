import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, User, Lock, Eye, EyeOff, CheckSquare, Square, ShieldCheck } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function ClientLoginScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLogged, setKeepLogged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signInClient } = useAuth();

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Required', 'Please enter your username or registered phone number.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const res = await signInClient(username, password);
    setIsSubmitting(false);

    if (res.success) {
      navigation.replace('ClientApp');
    } else {
      Alert.alert('Login Failed', res.error || 'Client record not found.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft color={Colors.text} size={24} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Dayal Constructions & Co.</Text>
            <Text style={styles.tagline}>BORN TO BUILD</Text>
          </View>

          <Text style={styles.title}>Client Portal Login</Text>
          <Text style={styles.subtitle}>Track your project milestones, drawings, payments and team chat.</Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <User color={Colors.textMuted} size={20} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Login ID (Username / Phone)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your username or phone"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Lock color={Colors.textMuted} size={20} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? <EyeOff color={Colors.textMuted} size={20} /> : <Eye color={Colors.textMuted} size={20} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setKeepLogged(!keepLogged)}
            >
              {keepLogged ? 
                <CheckSquare color={Colors.primaryDark} size={20} /> : 
                <Square color={Colors.textMuted} size={20} />
              }
              <Text style={styles.checkboxText}>Keep me logged in</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.loginButtonText}>Login to Client Portal</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBanner}>
            <ShieldCheck size={16} color="#059669" />
            <Text style={styles.infoBannerText}>
              Portal credentials are issued by your project manager or Dayal office administrator.
            </Text>
          </View>
          
          <View style={styles.footerContainer}>
             <Text style={styles.footerTextPrimary}>Dayal Constructions & Co.</Text>
             <Text style={styles.footerTextSecondary}>BORN TO BUILD</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tagline: {
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textMuted,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 32,
    lineHeight: 20,
  },
  inputContainer: {
    gap: 16,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  forgotText: {
    fontSize: 14,
    color: Colors.primaryDark,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.textMuted,
    fontSize: 12,
  },
  googleButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  googleButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 16,
    fontWeight: '500',
  },
  footerContainer: {
    marginTop: 'auto',
    marginBottom: 24,
  },
  footerTextPrimary: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  footerTextSecondary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  }
});
