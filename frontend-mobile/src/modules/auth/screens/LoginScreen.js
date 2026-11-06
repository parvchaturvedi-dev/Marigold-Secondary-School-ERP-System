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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "../../../shared/theme/colors";
import { useAuth } from "../../../auth/AuthContext";

const logo = require("../../../../assets/images/logo.png");
const REMEMBERED_USERNAME_KEY = "mgps_erp_remembered_username";

export default function LoginScreen() {
  const { login, loading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(REMEMBERED_USERNAME_KEY)
      .then((savedUsername) => {
        if (active && savedUsername) {
          setUsername(savedUsername);
          setRememberMe(true);
        }
      })
      .catch((error) => {
        console.warn("Could not load remembered username:", error?.message || error);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin() {
    try {
      if (rememberMe && username.trim()) {
        await AsyncStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }
    } catch (error) {
      console.warn("Could not save remembered username:", error?.message || error);
    }

    try {
      await login(username, password);
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 24,
          }}
        >
          <Animated.View
            style={{
              alignItems: "stretch",
              width: "100%",
              opacity: fadeAnim,
            }}
          >
            <View
              style={{
                width: "100%",
                height: 160,
                borderRadius: 28,
                backgroundColor: "#fff3ed",
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 122,
                  height: 122,
                  borderRadius: 61,
                  backgroundColor: "#ffe0d2",
                }}
              />
              <Image source={logo} resizeMode="contain" style={{ width: 106, height: 106 }} />
              <View style={{ position: "absolute", top: 20, left: 28 }}>
                <Ionicons name="sparkles" size={20} color="#f27654" />
              </View>
              <View style={{ position: "absolute", right: 34, bottom: 20 }}>
                <Ionicons name="book-outline" size={27} color="#ef7656" />
              </View>
            </View>

            <Text
              style={{
                marginTop: 22,
                fontSize: 29,
                fontWeight: "900",
                color: "#171923",
              }}
            >
              Welcome!
            </Text>

            <Text
              style={{
                marginTop: 4,
                marginBottom: 20,
                fontSize: 16,
                color: "#858894",
              }}
            >
              Log in to your account
            </Text>

            <InputBox
              icon="person-outline"
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
            />

            <InputBox
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={21}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              }
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: -2,
                marginBottom: 18,
              }}
            >
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((current) => !current)}
                activeOpacity={0.75}
                style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}
              >
                <View
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: rememberMe ? "#ef5b42" : "#c7c9d0",
                    backgroundColor: rememberMe ? "#ef5b42" : "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                  }}
                >
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ color: "#666b76", fontSize: 12 }}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7}>
                <Text
                  style={{
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: "700",
                    textDecorationLine: "underline",
                  }}
                >
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                shadowColor: "#dc2626",
                shadowOpacity: 0.2,
                shadowRadius: 11,
                shadowOffset: { width: 0, height: 5 },
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={["#f47755", "#ed3e27"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginRight: 9 }}>
                      Login
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 18,
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color="#9b9eaa" />
              <Text style={{ color: "#8a8e99", fontSize: 12, marginLeft: 6 }}>
                Secure sign-in with your school account
              </Text>
            </View>
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
        backgroundColor: "#fff",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        paddingHorizontal: 14,
        height: 56,
        marginBottom: 14,
      }}
    >
      <Ionicons
        name={icon}
        size={22}
        color="#111827"
        style={{ marginRight: 14 }}
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
          fontSize: 15,
          color: colors.text,
          fontWeight: "600",
        }}
      />

      {rightIcon}
    </View>
  );
}
