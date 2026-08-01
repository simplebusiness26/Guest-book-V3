import { useColorScheme } from "react-native";

const light = {
  primary: "#2563EB",
  background: "#FFFFFF",
  card: "#F3F4F6",
  text: "#111827",
  subtext: "#6B7280",
  border: "#E5E7EB",
  danger: "#EF4444",
  success: "#22C55E",
};

const dark = {
  primary: "#3B82F6",
  background: "#111827",
  card: "#1F2937",
  text: "#F9FAFB",
  subtext: "#9CA3AF",
  border: "#374151",
  danger: "#EF4444",
  success: "#22C55E",
};

export function useColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
