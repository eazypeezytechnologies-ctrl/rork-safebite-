import { Redirect, Href } from "expo-router";

export default function TabIndex() {
  return <Redirect href={"/(tabs)/(scan)" as Href} />;
}
