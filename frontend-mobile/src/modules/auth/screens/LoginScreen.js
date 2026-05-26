import React, { useState } from "react";
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
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../shared/theme/colors";
import { useAuth } from "../../../auth/AuthContext";

const logo = require("../../../../assets/images/logo.png");

export default function LoginScreen() {
  const { login, loading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    try {
      await login(username, password);
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    }
  }

  return (
    <LinearGradient
      colors={["#EEF2FF", "#FFFFFF", "#E8EEFF"]}
      style={{ flex: 1 }}
    >
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
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
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
                color: colors.primary,
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

            <View
              style={{
                width: "100%",
                backgroundColor: "rgba(255,255,255,0.95)",
                borderRadius: 28,
                padding: 22,
                marginTop: 34,
                elevation: 8,
              }}
            >
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
                      color="#64748B"
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
                }}
              >
                <LinearGradient
                  colors={["#5577FF", "#3730A3"]}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
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
        borderColor: "#E2E8F0",
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
        placeholderTextColor="#94A3B8"
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
