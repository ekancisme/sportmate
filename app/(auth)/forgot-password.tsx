import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

const MIN_PASSWORD = 8;

export default function ForgotPasswordScreen() {
  const { requestPasswordReset, resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const validateEmail = (value: string) => {
    const t = value.trim();
    if (!t) return 'Vui lòng nhập email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'Email không hợp lệ';
    return null;
  };

  const handleSendCode = async () => {
    setError(null);
    setInfo(null);
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    const result = await requestPasswordReset(email.trim());
    if (!result.ok) {
      setError(result.error || 'Không thể gửi mã');
      return;
    }
    setInfo('Nếu email đã đăng ký, bạn sẽ nhận mã trong vài phút. Kiểm tra hộp thư (và mục Spam).');
    setStep('code');
  };

  const handleReset = async () => {
    setError(null);
    const errEmail = validateEmail(email);
    if (errEmail) {
      setError(errEmail);
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Mã phải gồm đúng 6 chữ số');
      return;
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD) {
      setError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD} ký tự`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    const result = await resetPassword({
      email: email.trim(),
      code: code.trim(),
      newPassword,
    });
    if (!result.ok) {
      setError(result.error || 'Đặt lại mật khẩu thất bại');
      return;
    }
    setInfo('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.');
    setTimeout(() => {
      router.replace('/(auth)');
    }, 1200);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Quay lại đăng nhập</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.logo}>SportMate</Text>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? 'Nhập email đã đăng ký — chúng tôi gửi mã 6 số để đặt lại mật khẩu.'
              : 'Nhập mã từ email và mật khẩu mới.'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Email đã đăng ký"
              placeholderTextColor="#777"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={step === 'email'}
            />
            <Text style={styles.inputIcon}>＠</Text>
          </View>

          {step === 'code' && (
            <>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Mã 6 số"
                  placeholderTextColor="#777"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
                <Text style={styles.inputIcon}>#</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor="#777"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Text style={styles.inputIcon}>🔒</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#777"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <Text style={styles.inputIcon}>🔒</Text>
              </View>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          {info && <Text style={styles.infoText}>{info}</Text>}

          {step === 'email' ? (
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSendCode}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Gửi mã qua email</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleReset}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Đặt lại mật khẩu</Text>
              )}
            </Pressable>
          )}
        </View>
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
    minHeight: '100%',
  },
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    color: '#ff4d4f',
    fontSize: 13,
    fontWeight: '600',
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
    maxWidth: 320,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: '#101010',
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
  infoText: {
    color: '#95de64',
    fontSize: 12,
    marginTop: 6,
  },
});
