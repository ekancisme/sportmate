import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

const MIN_PASSWORD_LEN = 8;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateLogin(identifier: string, password: string): string | null {
  if (!identifier.trim()) return 'Vui lòng nhập email hoặc tên đăng nhập';
  if (!password) return 'Vui lòng nhập mật khẩu';
  return null;
}

function validateRegister(
  fullName: string,
  email: string,
  phone: string,
  password: string,
  confirm: string,
  agreed: boolean,
): string | null {
  const name = fullName.trim();
  if (name.length < 2) return 'Họ tên phải có ít nhất 2 ký tự';
  if (!email.trim()) return 'Vui lòng nhập email';
  if (!isValidEmail(email)) return 'Email không hợp lệ';
  const p = phone.trim();
  if (p && !/^[\d\s\-\+\(\)]+$/.test(p)) return 'Số điện thoại không hợp lệ';
  if (!password || password.length < MIN_PASSWORD_LEN) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LEN} ký tự`;
  }
  if (password !== confirm) return 'Mật khẩu xác nhận không khớp';
  if (!agreed) return 'Vui lòng đồng ý Điều khoản sử dụng';
  return null;
}

export default function AuthScreen() {
  const { login, register, loading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('sportmate_login');
        if (stored) {
          const parsed = JSON.parse(stored) as {
            identifier?: string;
            password?: string;
            remember?: boolean;
          };
          if (parsed.identifier) setLoginIdentifier(parsed.identifier);
          if (parsed.password) setLoginPassword(parsed.password);
          if (parsed.remember) setRemember(true);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'login') {
      const v = validateLogin(loginIdentifier, loginPassword);
      if (v) {
        setError(v);
        return;
      }
      const result = await login({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });
      if (!result.ok) {
        setError(result.error || 'Có lỗi xảy ra');
        return;
      }
      try {
        if (remember) {
          await AsyncStorage.setItem(
            'sportmate_login',
            JSON.stringify({
              identifier: loginIdentifier.trim(),
              password: loginPassword,
              remember: true,
            }),
          );
        } else {
          await AsyncStorage.removeItem('sportmate_login');
        }
      } catch {
        // ignore
      }
      router.replace('/(tabs)');
    } else {
      const v = validateRegister(
        regUsername,
        regEmail,
        regPhone,
        regPassword,
        regConfirmPassword,
        agreed,
      );
      if (v) {
        setError(v);
        return;
      }
      const result = await register({
        fullName: regUsername.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        password: regPassword,
      });
      if (!result.ok) {
        setError(result.error || 'Có lỗi xảy ra');
        return;
      }
      router.replace('/(tabs)');
    }
  };

  const isLogin = mode === 'login';

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.illustration}>
          <View style={styles.illustrationCircle} />
          <View style={styles.illustrationPath} />
          <View style={styles.illustrationPeak} />
        </View>

        <View style={styles.header}>
          <Text style={styles.logo}>SportMate</Text>
          <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Get Started'}</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Sign in to access your SportMate account.'
              : 'Create a free account to join matches and connect teammates.'}
          </Text>
        </View>

        <View style={styles.card}>
          {isLogin ? (
            <>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email or username"
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={loginIdentifier}
                  onChangeText={setLoginIdentifier}
                />
                <Text style={styles.inputIcon}>＠</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#777"
                  secureTextEntry
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                />
                <Text style={styles.inputIcon}>🔒</Text>
              </View>

              <View style={styles.rowBetween}>
                <Pressable
                  style={styles.rowCenter}
                  onPress={() => setRemember((prev) => !prev)}>
                  <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                    {remember && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </Pressable>
              </View>
              <Pressable style={styles.forgotRow} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.linkMuted}>Forgot password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#777"
                  value={regUsername}
                  onChangeText={setRegUsername}
                />
                <Text style={styles.inputIcon}>👤</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Valid email"
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />
                <Text style={styles.inputIcon}>＠</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone number (optional)"
                  placeholderTextColor="#777"
                  keyboardType="phone-pad"
                  value={regPhone}
                  onChangeText={setRegPhone}
                />
                <Text style={styles.inputIcon}>📱</Text>
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Strong password"
                  placeholderTextColor="#777"
                  secureTextEntry
                  value={regPassword}
                  onChangeText={setRegPassword}
                />
                <Text style={styles.inputIcon}>🔒</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#777"
                  secureTextEntry
                  value={regConfirmPassword}
                  onChangeText={setRegConfirmPassword}
                />
                <Text style={styles.inputIcon}>🔒</Text>
              </View>

              <Pressable
                style={[styles.rowCenter, styles.termsRow]}
                onPress={() => setAgreed((prev) => !prev)}>
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Text style={styles.checkboxIcon}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  By checking the box you agree to our{' '}
                  <Text style={styles.linkAccent}>Terms and Conditions</Text>.
                </Text>
              </Pressable>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Next ▸</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={styles.switchAuthRow}
          onPress={() => {
            setError(null);
            setMode(isLogin ? 'register' : 'login');
          }}>
          <Text style={styles.switchAuthText}>
            {isLogin ? 'New member? ' : 'Already a member? '}
            <Text style={styles.linkAccent}>{isLogin ? 'Register now' : 'Log In'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  illustration: {
    width: 160,
    height: 110,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationCircle: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#ff4d4f',
    top: 10,
    left: 12,
  },
  illustrationPath: {
    position: 'absolute',
    width: 120,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-12deg' }],
  },
  illustrationPeak: {
    position: 'absolute',
    width: 32,
    height: 24,
    backgroundColor: '#ff4d4f',
    borderRadius: 6,
    top: 8,
    right: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ff4d4f',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#aaaaaa',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: '#101010',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#181818',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#ffffff',
  },
  inputIcon: {
    marginLeft: 8,
    fontSize: 14,
    color: '#777777',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
    paddingHorizontal: 4,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  checkboxChecked: {
    backgroundColor: '#ff4d4f',
    borderColor: '#ff4d4f',
  },
  checkboxIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxLabel: {
    color: '#cccccc',
    fontSize: 11,
    flex: 1,
    flexWrap: 'wrap',
  },
  linkMuted: {
    color: '#bbbbbb',
    fontSize: 11,
    textAlign: 'center',
  },
  forgotRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  linkAccent: {
    color: '#ff4d4f',
    fontWeight: '600',
  },
  termsRow: {
    marginTop: 4,
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: '#ff4d4f',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#ff7875',
    fontSize: 12,
    marginTop: 6,
  },
  switchAuthRow: {
    marginTop: 18,
  },
  switchAuthText: {
    color: '#cccccc',
    fontSize: 13,
  },
});

