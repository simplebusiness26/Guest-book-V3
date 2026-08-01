import React from "react";
import {Stack} from "expo-router";
import Header from "../components/Header";
import {FeedbackProvider} from "../context/FeedbackContext";

export default function Layout(){
  return(
    <FeedbackProvider>
      <Stack
        screenOptions={{
          headerShown:true,
          header:()=> <Header />
        }}
      >
        <Stack.Screen name="index" options={{headerShown:false}}/>
        <Stack.Screen name="menu"/>
        <Stack.Screen name="map"/>
        <Stack.Screen name="scan"/>
        <Stack.Screen name="saved"/>
        <Stack.Screen name="profile"/>

        <Stack.Screen name="auth/signup"/>
        <Stack.Screen name="auth/login"/>
        <Stack.Screen name="auth/verify"/>

        <Stack.Screen name="manager/dashboard"/>
        <Stack.Screen name="manager/qr/[type]/[id]"/>

        <Stack.Screen name="business/dashboard"/>
        <Stack.Screen name="business/add"/>
        <Stack.Screen name="business/reviews"/>

        <Stack.Screen name="property/dashboard"/>
        <Stack.Screen name="property/add"/>
        <Stack.Screen name="property/edit/[id]"/>
        <Stack.Screen name="property/reviews"/>

        <Stack.Screen name="activity-clubs/index"/>
        <Stack.Screen name="activity-clubs/[id]"/>
        <Stack.Screen name="activity-clubs/add"/>
        <Stack.Screen name="activity-clubs/edit/[id]"/>
        <Stack.Screen name="activity-clubs/message-board/[id]"/>

        <Stack.Screen name="admin/claims"/>
      </Stack>
    </FeedbackProvider>
  );
}
