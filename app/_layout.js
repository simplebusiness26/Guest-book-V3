import React from "react";

import { Stack } from "expo-router";

import Header from "../components/Header";


export default function Layout(){

return(

<Stack

screenOptions={{

headerShown:true,

header:()=> <Header />

}}

>


<Stack.Screen

name="index"

options={{

headerShown:false

}}

/>

<Stack.Screen name="menu" />

<Stack.Screen name="map" />


<Stack.Screen name="scan" />


<Stack.Screen name="saved" />


<Stack.Screen name="profile" />



{/* Authentication */}

<Stack.Screen name="auth/signup" />

<Stack.Screen name="auth/login" />

<Stack.Screen name="auth/verify" />



{/* Business */}

<Stack.Screen name="business/dashboard" />

<Stack.Screen name="business/add" />

<Stack.Screen name="business/reviews" />



{/* Property */}

<Stack.Screen name="property/dashboard" />

<Stack.Screen name="property/add" />

<Stack.Screen name="property/reviews" />



{/* Admin */}

<Stack.Screen name="admin/claims" />


</Stack>

);

}