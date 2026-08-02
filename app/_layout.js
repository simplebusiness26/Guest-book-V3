import React from "react";
import {Stack} from "expo-router";
import Header from "../components/Header";
import {FeedbackProvider} from "../context/FeedbackContext";
import {NotificationProvider} from "../context/NotificationContext";

export const unstable_settings={initialRouteName:"index"};

export default function Layout(){
  return(
    <FeedbackProvider>
      <NotificationProvider>
        <Stack screenOptions={{headerShown:true,header:()=> <Header />}}>
          <Stack.Screen name="index" options={{headerShown:false}}/>
          <Stack.Screen name="menu"/>
          <Stack.Screen name="map"/>
          <Stack.Screen name="scan"/>
          <Stack.Screen name="saved"/>
          <Stack.Screen name="profile"/>
          <Stack.Screen name="profile/[id]"/>
          <Stack.Screen name="profile/edit"/>
          <Stack.Screen name="leaderboards"/>
          <Stack.Screen name="notifications"/>

          <Stack.Screen name="auth/signup"/>
          <Stack.Screen name="auth/login"/>
          <Stack.Screen name="auth/verify"/>
          <Stack.Screen name="auth/forgot-password"/>
          <Stack.Screen name="auth/update-password"/>

          <Stack.Screen name="manager/dashboard"/>
          <Stack.Screen name="manager/requests"/>
          <Stack.Screen name="manager/qr/[type]/[id]"/>

          <Stack.Screen name="business/dashboard"/>
          <Stack.Screen name="business/add"/>
          <Stack.Screen name="business/reviews"/>
          <Stack.Screen name="business/review/[id]"/>

          <Stack.Screen name="property/dashboard"/>
          <Stack.Screen name="property/add"/>
          <Stack.Screen name="property/edit/[id]"/>
          <Stack.Screen name="property/reviews"/>
          <Stack.Screen name="property/review/[id]"/>

          <Stack.Screen name="activity-clubs/index"/>
          <Stack.Screen name="activity-clubs/[id]"/>
          <Stack.Screen name="activity-clubs/add"/>
          <Stack.Screen name="activity-clubs/edit/[id]"/>
          <Stack.Screen name="activity-clubs/message-board/[id]"/>
          <Stack.Screen name="activity-clubs/review/[id]"/>

          <Stack.Screen name="events/index"/>
          <Stack.Screen name="events/[id]"/>
          <Stack.Screen name="events/add"/>
          <Stack.Screen name="events/edit/[id]"/>
          <Stack.Screen name="events/review/[id]"/>

          <Stack.Screen name="admin/claims"/>
        </Stack>
      </NotificationProvider>
    </FeedbackProvider>
  );
}
