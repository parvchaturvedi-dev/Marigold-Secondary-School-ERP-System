import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

const students = [
  { icon: "person", color: "#f7bd83", shirt: "#3868a7", left: 18 },
  { icon: "person", color: "#8f5134", shirt: "#e34636", left: 53 },
  { icon: "person", color: "#e8b786", shirt: "#315c93", left: 82 },
];

export default function OnboardingScreen({ onLogin }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1.08, minHeight: 300, maxHeight: 440 }}>
        <LinearGradient
          colors={["#ff6a1a", "#ff9b40"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderBottomLeftRadius: 48,
            borderBottomRightRadius: 48,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 26,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 44,
              left: -20,
              width: 110,
              height: 40,
              borderRadius: 28,
              backgroundColor: "rgba(255,239,210,0.55)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 70,
              right: -18,
              width: 120,
              height: 42,
              borderRadius: 28,
              backgroundColor: "rgba(255,239,210,0.48)",
            }}
          />

          <View
            style={{
              position: "absolute",
              top: 80,
              width: "78%",
              height: 146,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              backgroundColor: "#fff0d3",
              borderWidth: 4,
              borderColor: "#d97d36",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -20,
                width: "62%",
                height: 32,
                backgroundColor: "#fff8e9",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                borderWidth: 3,
                borderColor: "#d97d36",
              }}
            />
            <Text style={{ color: "#283047", fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>
              MARIGOLD
            </Text>
            <Text style={{ color: "#596071", fontSize: 8, fontWeight: "800", letterSpacing: 1 }}>
              SECONDARY SCHOOL
            </Text>
            <View style={{ flexDirection: "row", marginTop: 14, gap: 12 }}>
              {[0, 1, 2, 3].map((window) => (
                <View
                  key={window}
                  style={{
                    width: 24,
                    height: 35,
                    borderRadius: 5,
                    backgroundColor: "#75a7bd",
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />
              ))}
            </View>
          </View>

          <View
            style={{
              position: "absolute",
              bottom: 3,
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "center",
              width: "78%",
              height: 156,
            }}
          >
            {students.map((student, index) => (
              <View
                key={`${student.icon}-${index}`}
                style={{
                  width: 76,
                  height: 116 + (index === 1 ? 8 : 0),
                  marginHorizontal: -4,
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: student.color,
                    borderWidth: 3,
                    borderColor: "#fff2df",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person" size={31} color="#fff4e7" />
                </View>
                <View
                  style={{
                    width: 62,
                    height: 66,
                    marginTop: -2,
                    borderTopLeftRadius: 22,
                    borderTopRightRadius: 22,
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                    backgroundColor: student.shirt,
                    borderWidth: 3,
                    borderColor: "#fff2df",
                    alignItems: "center",
                    paddingTop: 10,
                  }}
                >
                  <View style={{ width: 4, height: 40, backgroundColor: "#f8e6c6" }} />
                </View>
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 30,
          paddingTop: 28,
          paddingBottom: 28,
          justifyContent: "space-between",
        }}
      >
        <View>
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 4,
              backgroundColor: "#f04427",
              marginBottom: 18,
            }}
          />
          <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "900", color: "#151a2c" }}>
            Manage Your{"\n"}School Life Easily
          </Text>
          <Text style={{ marginTop: 12, fontSize: 16, lineHeight: 24, color: "#606779" }}>
            Attendance, homework, results and more — all in one place.
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={onLogin}
          activeOpacity={0.85}
          style={{
            height: 58,
            borderRadius: 30,
            overflow: "hidden",
            shadowColor: "#dc2626",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}
        >
          <LinearGradient
            colors={["#ef4444", "#dc2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginRight: 10 }}>
              Log in
            </Text>
            <Ionicons name="arrow-forward" size={21} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
