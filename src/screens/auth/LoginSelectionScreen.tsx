import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Users, User } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function LoginSelectionScreen({ navigation }: any) {
  const { role, loading } = useAuth();

  useEffect(() => {
    if (!loading && role) {
      navigation.replace('MainApp');
    }
  }, [role, loading]);

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ marginTop: 10, color: Colors.textMuted }}>Loading...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Banner Area with favicondayal */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerOverlay}>
          <View style={styles.brandRow}>
            <Image 
              source={require('../../../assets/favicondayal.jpeg')} 
              style={styles.brandLogo} 
              resizeMode="contain" 
            />
            <View>
              <Text style={styles.logoText}>Dayal Constructions & Co.</Text>
              <Text style={styles.tagline}>BORN TO BUILD</Text>
            </View>
          </View>
          
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>Manage. Build. Grow.</Text>
            <Text style={styles.heroSubtitle}>A smarter way to manage your projects, clients and team.</Text>
          </View>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Choose Your Login Type</Text>
        <Text style={styles.subtitle}>Select how you want to access the app</Text>

        <TouchableOpacity 
          style={styles.optionCardPrimary}
          onPress={() => navigation.navigate('EmployeeLogin')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainerPrimary}>
            <Users color="#fff" size={24} />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitlePrimary}>Employee / Staff Login</Text>
            <Text style={styles.optionDescPrimary}>Access CRM, projects, tasks and internal tools</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionCardSecondary}
          onPress={() => navigation.navigate('ClientLogin')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainerSecondary}>
            <User color={Colors.primaryDark} size={24} />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitleSecondary}>Client Login</Text>
            <Text style={styles.optionDescSecondary}>Track your project, view updates, payments and documents</Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.footerText}>© 2026 Dayal Constructions & Co.{'\n'}All Rights Reserved.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bannerContainer: {
    flex: 0.52,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'flex-end',
  },
  bannerOverlay: {
    padding: 24,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  logoText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  heroTextContainer: {
    marginBottom: 10,
  },
  heroTitle: {
    color: Colors.surface,
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 19,
  },
  contentContainer: {
    flex: 0.48,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    padding: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  optionCardPrimary: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainerPrimary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitlePrimary: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  optionDescPrimary: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 16,
  },
  optionCardSecondary: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  iconContainerSecondary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTitleSecondary: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  optionDescSecondary: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 'auto',
    lineHeight: 16,
  },
});
