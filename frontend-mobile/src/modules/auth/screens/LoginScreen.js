import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../shared/theme/colors";
import { gradients, glassColors } from "../../../shared/theme/glass";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import { useAuth } from "../../../auth/AuthContext";

const logo = require("../../../../assets/images/logo.png");

export default function LoginScreen() {
  const { login, loading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Entrance animation (visual only)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  async function handleLogin() {
    try {
      await login(username, password);
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Animated.View
            style={{
              alignItems: "center",
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <View
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: "rgba(255,255,255,0.8)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#4f46e5",
                shadowOpacity: 0.15,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 10,
              }}
            >
              <Image
                source={logo}
                resizeMode="contain"
                style={{
                  width: 100,
                  height: 100,
                }}
              />
            </View>

            <Text
              style={{
                marginTop: 24,
                fontSize: 34,
                fontWeight: "900",
                color: glassColors.accentDeep,
              }}
            >
              Marigold
            </Text>

            <Text
              style={{
                marginTop: 4,
                fontSize: 16,
                letterSpacing: 4,
                fontWeight: "800",
                color: colors.muted,
              }}
            >
              SCHOOL ERP
            </Text>

            <GlassCard
              style={{
                width: "100%",
                borderRadius: 28,
                marginTop: 34,
              }}
            >
              <View style={{ padding: 22 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "900",
                    textAlign: "center",
                    color: colors.text,
                  }}
                >
                  Welcome Back
                </Text>

                <Text
                  style={{
                    textAlign: "center",
                    marginTop: 8,
                    marginBottom: 24,
                    color: colors.muted,
                  }}
                >
                  Login to manage your school account
                </Text>

                <InputBox
                  icon="person-outline"
                  placeholder="Username (e.g. ADM-USER)"
                  value={username}
                  onChangeText={setUsername}
                />

                <InputBox
                  icon="lock-closed-outline"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={24}
                        color="#64748b"
                      />
                    </TouchableOpacity>
                  }
                />

                <TouchableOpacity
                  style={{
                    alignSelf: "flex-end",
                    marginBottom: 24,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "900",
                    }}
                  >
                    Forgot Password?
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    shadowColor: "#6366f1",
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8,
                  }}
                >
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 60,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 18,
                            fontWeight: "900",
                            marginRight: 10,
                          }}
                        >
                          Login
                        </Text>

                        <Ionicons
                          name="arrow-forward"
                          size={22}
                          color="#fff"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InputBox({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  rightIcon,
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.6)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.85)",
        paddingHorizontal: 14,
        height: 60,
        marginBottom: 16,
      }}
    >
      <Ionicons
        name={icon}
        size={22}
        color={colors.primary}
        style={{ marginRight: 12 }}
      />

      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={{
          flex: 1,
          fontSize: 16,
          color: colors.text,
          fontWeight: "700",
        }}
      />

      {rightIcon}
    </View>
  );
}
