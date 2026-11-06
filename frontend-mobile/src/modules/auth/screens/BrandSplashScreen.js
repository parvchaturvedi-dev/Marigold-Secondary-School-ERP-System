import React from "react";
import { View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

const logo = require("../../../../assets/images/logo.png");

export default function BrandSplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#ff641c" }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#ff4d12", "#ff761c", "#ff8c32"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 28,
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -96,
            left: -60,
            width: "125%",
            height: 230,
            borderRadius: 180,
            backgroundColor: "rgba(255,196,104,0.42)",
            transform: [{ rotate: "-8deg" }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -142,
            right: -80,
            width: "125%",
            height: 230,
            borderRadius: 180,
            backgroundColor: "rgba(255,224,161,0.28)",
            transform: [{ rotate: "9deg" }],
          }}
        />
        <View
          style={{
            width: 154,
            height: 154,
            borderRadius: 77,
            backgroundColor: "#fff",
            borderWidth: 7,
            borderColor: "rgba(255,255,255,0.55)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#7c2d12",
            shadowOpacity: 0.18,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <Image source={logo} resizeMode="contain" style={{ width: 138, height: 138 }} />
        </View>
        <Text style={{ marginTop: 24, color: "#fff", fontSize: 38, fontWeight: "900", letterSpacing: -1 }}>
          Marigold
        </Text>
        <Text style={{ marginTop: 7, color: "#fff8ed", fontSize: 15, fontWeight: "800", letterSpacing: 6 }}>
          SCHOOL ERP
        </Text>
      </LinearGradient>
    </View>
  );
}
