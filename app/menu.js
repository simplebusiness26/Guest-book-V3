import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
Pressable
} from "react-native";

import {router} from "expo-router";

import {supabase} from "../services/supabase";


export default function Menu(){

const [userType,setUserType]=useState(null);

const [loggedIn,setLoggedIn]=useState(false);

useEffect(()=>{

loadUser();

},[]);

async function loadUser(){

const {
data:{
user
}

}=await supabase.auth.getUser();

if(!user){

setLoggedIn(false);

return;

}

setLoggedIn(true);

const {
data

}=await supabase

.from("profiles")

.select("account_type,is_admin")

.eq("id",user.id)

.single();

if(data){

if(data.is_admin){

setUserType("admin");

}

else{

setUserType(data.account_type);

}

}

}

async function logout(){

await supabase.auth.signOut();

router.replace("/");

}

return(

<View style={styles.container}>

<Text style={styles.title}>
Menu
</Text>

<Pressable

style={styles.item}

onPress={()=>router.push("/map")}

>

<Text style={styles.text}>
🗺 Map
</Text>

</Pressable>

{
loggedIn &&

<Pressable

style={styles.item}

onPress={()=>router.push("/profile")}

>

<Text style={styles.text}>
👤 Profile
</Text>

</Pressable>

}

{
userType==="manager" &&

<Pressable

style={styles.item}

onPress={()=>router.push("/business/dashboard")}

>

<Text style={styles.text}>
📊 Manager Dashboard
</Text>

</Pressable>

}

{
userType==="admin" &&

<Pressable

style={styles.item}

onPress={()=>router.push("/admin/claims")}

>

<Text style={styles.text}>
⚙️ Admin Dashboard
</Text>

</Pressable>

}

{
!loggedIn &&

<>

<Pressable

style={styles.item}

onPress={()=>router.push("/auth/login")}

>

<Text style={styles.text}>
Login
</Text>

</Pressable>

<Pressable

style={styles.item}

onPress={()=>router.push("/auth/signup")}

>

<Text style={styles.text}>
Create Account
</Text>

</Pressable>

</>

}

{
loggedIn &&

<Pressable

style={styles.logout}

onPress={logout}

>

<Text style={styles.logoutText}>
Logout
</Text>

</Pressable>

}

</View>

);

}

const styles=StyleSheet.create({

container:{
flex:1,
padding:30
},

title:{
fontSize:32,
fontWeight:"bold",
marginBottom:30
},

item:{
backgroundColor:"#222",
padding:16,
borderRadius:10,
marginBottom:15
},

text:{
color:"white",
fontWeight:"bold",
textAlign:"center"
},

logout:{
backgroundColor:"#cc0000",
padding:16,
borderRadius:10,
marginTop:20
},

logoutText:{
color:"white",
fontWeight:"bold",
textAlign:"center"
}

});